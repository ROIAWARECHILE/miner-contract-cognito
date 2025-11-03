import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  let job: any = null;

  try {
    // Check if a specific job_id was provided
    const body = req.method === 'POST' ? await req.json() : {};
    const specificJobId = body.job_id;
    if (specificJobId) {
      // Process specific job
      const { data: specificJob, error: specificError } = await supabase
        .from('ingest_jobs')
        .select('*')
        .eq('id', specificJobId)
        .single();
      
      if (specificError) throw specificError;
      job = specificJob;
    } else {
      // Get next job from queue
      const { data: nextJob, error: jobError } = await supabase.rpc('get_next_ingest_job');
      
      if (jobError) throw jobError;
      if (!nextJob) {
        return new Response(
          JSON.stringify({ ok: true, idle: true, message: 'No pending jobs' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      job = nextJob;
    }

    console.log(`Processing job ${job.id}: ${job.storage_path}`);

    // Update job status to working
    await supabase
      .from('ingest_jobs')
      .update({ 
        status: 'working', 
        attempts: job.attempts + 1,
        updated_at: new Date().toISOString() 
      })
      .eq('id', job.id);

    // Log start
    await supabase.from('ingest_logs').insert({
      job_id: job.id,
      step: 'start',
      message: `Started processing ${job.storage_path}`,
      meta: { project_prefix: job.project_prefix }
    });

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('contracts')
      .download(job.storage_path);

    if (downloadError) throw downloadError;

    const arrayBuffer = await fileData.arrayBuffer();
    const filename = job.storage_path.split('/').pop() || 'document.pdf';
    const docType = job.document_type || job.storage_path.split('/')[1]; // Use job.document_type or fallback to folder

    await supabase.from('ingest_logs').insert({
      job_id: job.id,
      step: 'classify',
      message: `Classified as ${docType}`,
      meta: { document_type: docType, filename }
    });

    // Step 1: Parse PDF with Lovable's document parser
    const formData = new FormData();
    formData.append('file', new Blob([arrayBuffer], { type: 'application/pdf' }), filename);
    
    const parseResponse = await fetch('https://ai.gateway.lovable.dev/v1/documents/parse', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: formData,
    });

    if (!parseResponse.ok) {
      throw new Error(`PDF parsing failed: ${parseResponse.status}`);
    }

    const parseResult = await parseResponse.json();
    const parsedText = parseResult.text || '';

    await supabase.from('ingest_logs').insert({
      job_id: job.id,
      step: 'parse',
      message: `Parsed ${parsedText.length} characters from PDF`,
      meta: { text_length: parsedText.length, pages: parseResult.pages }
    });

    // Step 2: Extract structured data from parsed text with AI
    const systemPrompt = buildSystemPrompt(docType);
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Filename: ${filename}\n\nParsed text from PDF:\n\n${parsedText}\n\nExtract structured data according to the schema.` }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI extraction failed: ${aiResponse.status} ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    const extracted = JSON.parse(aiResult.choices[0].message.content);

    await supabase.from('ingest_logs').insert({
      job_id: job.id,
      step: 'extract',
      message: 'AI extraction completed',
      meta: { document_type: extracted.document_type }
    });

    // Apply upserts
    if (extracted.upserts && extracted.upserts.length > 0) {
      for (const upsert of extracted.upserts) {
        await applyUpsert(supabase, upsert, job.project_prefix);
      }
    }

    await supabase.from('ingest_logs').insert({
      job_id: job.id,
      step: 'upsert',
      message: `Applied ${extracted.upserts?.length || 0} upserts`,
      meta: {}
    });

    // Update contract totals if EDP
    if (docType === 'edp' && extracted.contract_code) {
      await supabase.from('ingest_logs').insert({
        job_id: job.id,
        step: 'aggregate',
        message: 'Updating contract totals',
        meta: { contract_code: extracted.contract_code }
      });
      await updateContractTotals(supabase, extracted.contract_code);
      await supabase.from('ingest_logs').insert({
        job_id: job.id,
        step: 'aggregate',
        message: 'Contract totals updated',
        meta: {}
      });
    }

    // Register document in documents table
    const docTypeMap: Record<string, string> = {
      'contract': 'original',
      'edp': 'original',
      'quality': 'analysis',
      'sso': 'analysis',
      'tech': 'analysis',
      'sdi': 'original',
      'addendum': 'original'
    };

    const { error: docError } = await supabase.from('documents').upsert({
      contract_id: job.contract_id,
      filename: filename,
      file_url: job.storage_path,
      doc_type: docTypeMap[docType] || 'original',
      file_size: arrayBuffer.byteLength,
      checksum: job.file_hash,
      processing_status: 'completed',
      extracted_data: extracted
    }, { 
      onConflict: 'contract_id,filename' 
    });

    if (docError) {
      console.error('Error registering document:', docError);
    }

    // Mark job as done
    await supabase
      .from('ingest_jobs')
      .update({ 
        status: 'done',
        updated_at: new Date().toISOString() 
      })
      .eq('id', job.id);

    await supabase.from('ingest_logs').insert({
      job_id: job.id,
      step: 'complete',
      message: 'Job completed successfully',
      meta: { analytics: extracted.analytics }
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        job_id: job.id, 
        result: extracted 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ingest-worker:', error);
    
    // Mark job as failed if we have job info
    if (job?.id) {
      try {
        await supabase
          .from('ingest_jobs')
          .update({ 
            status: 'failed',
            last_error: error instanceof Error ? error.message : String(error),
            updated_at: new Date().toISOString() 
          })
          .eq('id', job.id);
        
        await supabase.from('ingest_logs').insert({
          job_id: job.id,
          step: 'error',
          message: error instanceof Error ? error.message : String(error),
          meta: { error: true }
        });
      } catch (updateError) {
        console.error('Failed to update job status:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function buildSystemPrompt(docType: string): string {
  const basePrompt = `You are ContractOS AI parser. Extract structured data from mining contract PDFs.
Return ONLY valid JSON with this structure:
{
  "document_type": "${docType}",
  "contract_code": "AIPD-CSI001-1000-MN-0001",
  "upserts": [{"table": "...", "values": {...}}],
  "analytics": {"spent_total_uf": 0, "progress_pct": 0},
  "alerts": [],
  "log": []
}

Contract context:
- Code: "AIPD-CSI001-1000-MN-0001"
- Client: "Andes Iron SpA"
- Contractor: "Itasca Chile SpA"
- Total Budget: 4501 UF

CRITICAL: All amounts must preserve decimal precision. Use numeric types for UF/CLP amounts.
Include provenance: {filename, page_spans, extracted_fields, confidence_by_field}`;

  if (docType === 'edp') {
    return `${basePrompt}

For EDP (Estado de Pago) documents, extract ALL these fields:
1. edp_number (integer) - EDP sequence number
2. period_label (string, e.g., "Ago-25") - reporting period
3. period_start, period_end (ISO dates YYYY-MM-DD)
4. amount_uf (numeric) - total amount this EDP in UF
5. uf_rate (numeric) - UF to CLP conversion rate
6. amount_clp (numeric) - total amount in CLP
7. status (string) - "approved" if signed, else "submitted"
8. accumulated_prev_uf (numeric) - accumulated before this EDP
9. accumulated_total_uf (numeric) - accumulated after this EDP
10. tasks_executed (array) - each task must have:
    - task_number (string, e.g., "1.1", "2.0", "9.0")
    - name (string) - task description
    - spent_uf (numeric) - UF spent in this task THIS period only
    - budget_uf (numeric, optional) - task budget if mentioned

UPSERTS REQUIRED:
1. payment_states table:
   {
     "table": "payment_states",
     "values": {
       "contract_code": "AIPD-CSI001-1000-MN-0001",
       "edp_number": <integer>,
       "period_label": "<string>",
       "period_start": "<ISO date>",
       "period_end": "<ISO date>",
       "amount_uf": <numeric>,
       "uf_rate": <numeric>,
       "amount_clp": <numeric>,
       "status": "approved",
       "data": {"accumulated_prev_uf": <numeric>, "accumulated_total_uf": <numeric>}
     }
   }

2. contract_tasks table (one per task_executed):
   {
     "table": "contract_tasks",
     "values": {
       "contract_code": "AIPD-CSI001-1000-MN-0001",
       "task_number": "<string>",
       "task_name": "<string>",
       "spent_uf": <numeric>, // INCREMENT by this amount
       "budget_uf": <numeric if found>,
       "progress_percentage": <computed from spent/budget>
     }
   }

ANALYTICS:
{
  "spent_total_uf": <accumulated_total_uf>,
  "progress_pct": <round(accumulated_total_uf / 4501 * 100)>
}`;
  }

  if (docType === 'contract') {
    return `${basePrompt}

For Contract documents, extract:
- code, title, client, contractor
- budget_uf (total: 4501 UF)
- start_date (ISO)
- tasks: array of 10 tasks with task_number, name, budget_uf
- kpis_plan.s_curve_plan: monthly cumulative percentages

Return upserts for contracts and contract_tasks tables.`;
  }

  return basePrompt;
}

async function applyUpsert(supabase: any, upsert: any, projectPrefix: string) {
  const { table, values } = upsert;
  
  // Get contract_id if needed
  let contractId = values.contract_id;
  if (!contractId && values.contract_code) {
    const { data } = await supabase
      .from('contracts')
      .select('id')
      .eq('code', values.contract_code)
      .single();
    contractId = data?.id;
  }

  const payload = { ...values, contract_id: contractId };
  delete payload.contract_code;

  switch (table) {
    case 'contracts':
      await supabase.from('contracts').upsert(payload, { onConflict: 'code' });
      break;
    
    case 'contract_tasks':
      // For tasks, we need to INCREMENT spent_uf, not replace it
      const existingTask = await supabase
        .from('contract_tasks')
        .select('spent_uf, budget_uf')
        .eq('contract_id', contractId)
        .eq('task_number', payload.task_number)
        .maybeSingle();
      
      if (existingTask.data) {
        // Task exists - increment spent_uf
        const newSpent = (existingTask.data.spent_uf || 0) + (payload.spent_uf || 0);
        const budget = payload.budget_uf || existingTask.data.budget_uf || 0;
        const progress = budget > 0 ? Math.round((newSpent / budget) * 100) : 0;
        
        await supabase.from('contract_tasks')
          .update({
            spent_uf: newSpent,
            progress_percentage: Math.min(100, progress),
            ...(payload.budget_uf && { budget_uf: payload.budget_uf }),
            ...(payload.task_name && { task_name: payload.task_name }),
            updated_at: new Date().toISOString()
          })
          .eq('contract_id', contractId)
          .eq('task_number', payload.task_number);
      } else {
        // New task - insert
        const budget = payload.budget_uf || 0;
        const progress = budget > 0 ? Math.round((payload.spent_uf / budget) * 100) : 0;
        await supabase.from('contract_tasks').insert({
          ...payload,
          progress_percentage: Math.min(100, progress)
        });
      }
      break;
    
    case 'payment_states':
      await supabase.from('payment_states').upsert(payload, { onConflict: 'contract_id,edp_number' });
      break;
    
    case 'documents':
      await supabase.from('documents').upsert(payload, { onConflict: 'contract_id,filename' });
      break;
    
    case 'sla_alerts':
      await supabase.from('sla_alerts').insert(payload);
      break;
    
    default:
      console.warn(`Unknown table: ${table}`);
  }
}

async function updateContractTotals(supabase: any, contractCode: string) {
  // Get contract and all payment states
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, metadata, contract_value')
    .eq('code', contractCode)
    .single();
  
  if (!contract) return;

  const { data: payments } = await supabase
    .from('payment_states')
    .select('amount_uf, status')
    .eq('contract_id', contract.id);
  
  // Calculate totals
  const spentUf = (payments || [])
    .filter((p: any) => ['approved', 'submitted'].includes(p.status))
    .reduce((sum: any, p: any) => sum + (p.amount_uf || 0), 0);
  
  const budgetUf = (contract.metadata as any)?.budget_uf || contract.contract_value || 4501;
  const availableUf = budgetUf - spentUf;
  const progressPct = Math.min(100, Math.round((spentUf / budgetUf) * 100));
  const edpsPaid = (payments || []).filter((p: any) => p.status === 'approved').length;

  // Update contract metadata
  await supabase.from('contracts')
    .update({
      metadata: {
        ...(contract.metadata || {}),
        budget_uf: budgetUf,
        spent_uf: spentUf,
        available_uf: availableUf,
        overall_progress_pct: progressPct,
        edps_paid: edpsPaid,
        last_updated: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', contract.id);
  
  console.log(`✅ Contract totals updated: ${spentUf} UF spent, ${progressPct}% progress`);
}
