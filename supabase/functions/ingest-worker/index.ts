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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if a specific job_id was provided
    const body = req.method === 'POST' ? await req.json() : {};
    const specificJobId = body.job_id;

    let job;
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
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Classify document type from path
    const pathParts = job.storage_path.split('/');
    const folderType = pathParts[pathParts.length - 2]; // e.g., 'edp', 'contract', etc.
    const filename = pathParts[pathParts.length - 1];

    await supabase.from('ingest_logs').insert({
      job_id: job.id,
      step: 'classify',
      message: `Classified as ${folderType}`,
      meta: { folder: folderType, filename }
    });

    // Extract with AI (Lovable AI Gateway - Gemini 2.5 Pro)
    const systemPrompt = buildSystemPrompt(folderType);
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Filename: ${filename}\n\nExtract data from this PDF according to the schema.` },
          { 
            role: 'user', 
            content: [
              { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64}` } }
            ]
          }
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
      doc_type: docTypeMap[folderType] || 'original',
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
  "upserts": [{"table": "...", "values": {...}}],
  "analytics": {},
  "alerts": [],
  "log": []
}

Contract code is always: "AIPD-CSI001-1000-MN-0001"
Client: "Andes Iron SpA"
Contractor: "Itasca Chile SpA"

CRITICAL: All amounts must preserve decimal precision. Use numeric types for UF/CLP amounts.
Include provenance: {filename, page_spans, extracted_fields, confidence_by_field}`;

  if (docType === 'edp') {
    return `${basePrompt}

For EDP documents, extract:
- edp_number (integer)
- period_label (e.g., "Jul-25")
- period_start, period_end (ISO dates)
- amount_uf, uf_rate, amount_clp (numeric with 2 decimals)
- status ("approved", "submitted", "draft")
- tasks_executed: array of {task_number, name, budget_uf, spent_uf, progress_pct}

Return upserts for payment_states and contract_tasks tables.`;
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
      await supabase.from('contract_tasks').upsert(payload, { onConflict: 'contract_id,task_number' });
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
