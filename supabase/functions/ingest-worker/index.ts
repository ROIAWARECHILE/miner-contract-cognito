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
    console.log('Downloading PDF from storage:', job.storage_path);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('contracts')
      .download(job.storage_path);

    if (downloadError) {
      console.error('Storage download error:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    if (!fileData) {
      throw new Error('No file data returned from storage');
    }

    console.log('File downloaded successfully, size:', fileData.size);

    const arrayBuffer = await fileData.arrayBuffer();
    const filename = job.storage_path.split('/').pop() || 'document.pdf';
    const docType = job.document_type || job.storage_path.split('/')[1]; // Use job.document_type or fallback to folder

    await supabase.from('ingest_logs').insert({
      job_id: job.id,
      step: 'classify',
      message: `Classified as ${docType}`,
      meta: { document_type: docType, filename }
    });

    // Step 1: Convert PDF to base64 for vision model
    console.log('Converting PDF to base64 for AI vision model, file size:', arrayBuffer.byteLength);
    
    // Convert ArrayBuffer to base64 in chunks to avoid call stack size exceeded
    const uint8Array = new Uint8Array(arrayBuffer);
    const chunkSize = 8192; // Process 8KB at a time
    let binaryString = '';
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64Pdf = btoa(binaryString);
    console.log('PDF converted to base64, length:', base64Pdf.length);
    
    await supabase.from('ingest_logs').insert({
      job_id: job.id,
      step: 'parse',
      message: `PDF converted to base64 (${base64Pdf.length} chars) for vision analysis`,
      meta: { pdf_size_bytes: arrayBuffer.byteLength }
    });

    // Step 2: Extract structured data directly from PDF using Gemini Vision
    console.log('Extracting structured data from PDF with Gemini Vision');
    const systemPrompt = buildSystemPrompt(docType);
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash', // Fast multimodal model for PDF analysis
        messages: [
          { 
            role: 'system', 
            content: systemPrompt 
          },
          { 
            role: 'user', 
            content: [
              {
                type: 'text',
                text: `Filename: ${filename}\n\nAnalyze this PDF document and extract structured data according to the schema. This is a ${docType.toUpperCase()} document.\n\nIMPORTANT: Pay special attention to Chilean number format (period for thousands, comma for decimals).`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64Pdf}`
                }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 8000 // Increased for complex tables and multiple tasks
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI extraction failed:', errorText);
      
      // Retry with gemini-2.5-pro if flash-thinking fails
      if (job.attempts < 2) {
        console.log('Retrying with gemini-2.5-pro...');
        const retryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-pro',
            messages: [
              { role: 'system', content: systemPrompt },
              { 
                role: 'user', 
                content: [
                  {
                    type: 'text',
                    text: `Filename: ${filename}\n\nAnalyze this PDF document and extract structured data. This is a ${docType.toUpperCase()} document.`
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:application/pdf;base64,${base64Pdf}`
                    }
                  }
                ]
              }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 8000
          }),
        });
        
        if (!retryResponse.ok) {
          throw new Error(`AI extraction failed even with retry: ${retryResponse.status}`);
        }
        
        const retryResult = await retryResponse.json();
        const extracted = JSON.parse(retryResult.choices[0].message.content);
        
        await supabase.from('ingest_logs').insert({
          job_id: job.id,
          step: 'extract',
          message: 'AI extraction completed with gemini-2.5-pro (retry)',
          meta: { document_type: extracted.document_type, model_used: 'gemini-2.5-pro' }
        });
        
        // Continue processing with retry result
        await processExtractedData(supabase, job, extracted, arrayBuffer, filename, docType);
        return new Response(
          JSON.stringify({ ok: true, job_id: job.id, result: extracted }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI extraction failed: ${aiResponse.status} ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    const extracted = JSON.parse(aiResult.choices[0].message.content);

        await supabase.from('ingest_logs').insert({
          job_id: job.id,
          step: 'extract',
          message: 'AI extraction completed',
          meta: { document_type: extracted.document_type, model_used: 'gemini-2.5-flash' }
        });

    await processExtractedData(supabase, job, extracted, arrayBuffer, filename, docType);

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

// Helper function to process extracted data (used for both main flow and retry)
async function processExtractedData(
  supabase: any, 
  job: any, 
  extracted: any, 
  arrayBuffer: ArrayBuffer, 
  filename: string, 
  docType: string
) {
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
}

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

CRITICAL INSTRUCTIONS FOR CHILEAN NUMBER FORMAT:
- Chilean PDFs use PERIOD (.) as thousands separator and COMMA (,) as decimal separator
- Example in PDF: "1.234,56" → Extract as: 1234.56
- Example in PDF: "209,81" → Extract as: 209.81
- Example in PDF: "39.179,01" → Extract as: 39179.01
- ALWAYS remove periods (thousands separators) and convert commas to dots
- Task numbers may appear as "1.1", "1.2", "2.0" (keep this format)
- If task numbers appear with dashes like "1-1", normalize to "1.1"

DOCUMENT STRUCTURE:
- Header: Contains contract code, EDP number, period (e.g., "Ago-2025")
- Main Table: Lists all tasks/activities with columns for:
  * Item/Task Number (e.g., 1.1, 1.2, 2.0, 3.0, 8.0, 9.0)
  * Description/Activity Name
  * Budget (Presupuesto) in UF
  * Current Period Amount (Monto Período) in UF
  * Progress % (Avance %)
- Footer: Contains accumulated totals, UF rate, CLP amounts

For EDP (Estado de Pago) documents, extract ALL these fields:
1. edp_number (integer) - EDP sequence number
2. period_label (string, e.g., "Ago-25", "Aug-2025") - reporting period
3. period_start, period_end (ISO dates YYYY-MM-DD) - convert from period_label
4. amount_uf (numeric) - total amount this EDP in UF (current period)
5. uf_rate (numeric) - UF to CLP conversion rate
6. amount_clp (numeric) - total amount in CLP
7. status (string) - "approved" if signed, else "submitted"
8. accumulated_prev_uf (numeric) - accumulated before this EDP
9. accumulated_total_uf (numeric) - accumulated after this EDP (must = prev + current)
10. contract_budget_uf (numeric) - total contract budget (usually 4501 UF)
11. contract_progress_pct (numeric) - overall contract progress %
12. tasks_executed (array) - each task must have:
    - task_number (string, e.g., "1.1", "1.2", "2.0", "3.0", "8.0", "9.0")
    - name (string) - task description in Spanish
    - spent_uf (numeric) - UF spent in this task THIS period only
    - budget_uf (numeric, optional) - task budget if mentioned
    - progress_pct (numeric, optional) - accumulated progress % for this task

EXAMPLE TASKS FROM REAL EDPs:
- Task 1.1: "Recopilación y análisis de información"
- Task 1.2: "Visita a terreno"
- Task 2.0: "Actualización del estudio hidrológico"
- Task 3.0: "Revisión experta"
- Task 8.0: "Reuniones y presentaciones"
- Task 9.0: "Costos de administración" or "Reuniones"

VALIDATION RULES:
1. accumulated_total_uf MUST equal accumulated_prev_uf + amount_uf (within 0.01 tolerance)
2. SUM(tasks_executed[].spent_uf) SHOULD equal amount_uf (within 1% tolerance)
3. All task_numbers must use dot notation (1.1, not 1-1)
4. All UF amounts MUST be positive numbers with exactly 2 decimal places
5. contract_progress_pct = ROUND((accumulated_total_uf / contract_budget_uf) * 100)
6. Convert Chilean number format: "1.234,56" → 1234.56

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
       "data": {
         "accumulated_prev_uf": <numeric>, 
         "accumulated_total_uf": <numeric>,
         "contract_progress_pct": <numeric>
       }
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
       "progress_percentage": <computed from spent/budget if available>
     }
   }

ANALYTICS:
{
  "spent_total_uf": <accumulated_total_uf>,
  "progress_pct": <round(accumulated_total_uf / 4501 * 100)>
}

RETURN ONLY VALID JSON, NO MARKDOWN, NO EXPLANATIONS.`;
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
