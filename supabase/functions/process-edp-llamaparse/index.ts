import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
  const llamaApiKey = Deno.env.get('LLAMAPARSE_API_KEY');
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { contract_code, storage_path, edp_number } = await req.json();
    
    console.log(`📄 Processing EDP #${edp_number} for contract ${contract_code}`);
    console.log(`📁 Storage path: ${storage_path}`);

    // 1️⃣ Generate presigned URL
    const { data: urlData, error: urlError } = await supabase.storage
      .from('contracts')
      .createSignedUrl(storage_path, 600);
    
    if (urlError || !urlData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${urlError?.message}`);
    }
    
    console.log(`✅ Presigned URL generated`);

    // 2️⃣ Call LlamaParse
    if (!llamaApiKey) {
      throw new Error('LLAMAPARSE_API_KEY not configured');
    }

    console.log(`🦙 Calling LlamaParse API...`);
    
    const llamaResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${llamaApiKey}`,
        'Accept': 'application/json'
      },
      body: await fetch(urlData.signedUrl).then(r => r.blob())
    });

    if (!llamaResponse.ok) {
      const errorText = await llamaResponse.text();
      throw new Error(`LlamaParse upload failed: ${llamaResponse.status} ${errorText}`);
    }

    const llamaJob = await llamaResponse.json();
    const jobId = llamaJob.id;
    console.log(`🦙 LlamaParse job created: ${jobId}`);

    // Poll for completion
    let parsed: any = null;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(
        `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`,
        {
          headers: { 'Authorization': `Bearer ${llamaApiKey}` }
        }
      );

      if (statusResponse.ok) {
        const result = await statusResponse.json();
        
        if (result.status === 'SUCCESS') {
          parsed = result;
          console.log(`✅ LlamaParse completed in ${attempts * 2}s`);
          break;
        }
        
        if (result.status === 'ERROR') {
          throw new Error(`LlamaParse job failed: ${result.error}`);
        }
        
        console.log(`⏳ LlamaParse status: ${result.status}, attempt ${attempts}/${maxAttempts}`);
      }
    }

    if (!parsed) {
      throw new Error('LlamaParse timeout after 60s');
    }

    // 3️⃣ Save raw parsed data
    const { error: rawInsertError } = await supabase.from('edp_raw_parsed').insert({
      contract_code,
      edp_number,
      storage_path,
      llama_job_id: jobId,
      parsed_json: parsed
    });

    if (rawInsertError) {
      console.error('Failed to save raw parse:', rawInsertError);
    }

    // 4️⃣ Send to OpenAI for structured extraction
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log(`🤖 Calling OpenAI GPT-4o for extraction...`);

    const systemPrompt = `You are an expert data extractor for mining contract payment statements (EDP - Estado de Pago).

Extract financial data from the provided document and return ONLY valid JSON following this exact schema:

{
  "contract_code": "AIPD-CSI001-1000-MN-0001",
  "edp_number": 2,
  "period": "Ago-2025",
  "uf_rate": 39383.07,
  "amount_uf": 418.44,
  "amount_clp": 16479349,
  "accumulated_prev_uf": 209.8,
  "accumulated_total_uf": 628.2,
  "contract_progress_pct": 14,
  "tasks_executed": [
    {
      "task_number": "1.1",
      "name": "Recopilación y análisis de información",
      "budget_uf": 507,
      "spent_uf": 94.63
    }
  ]
}

CRITICAL INSTRUCTIONS:
- All UF amounts must be NUMERIC (not strings)
- Chilean format: "1.234,56" → convert to 1234.56
- Period format: extract as-is (e.g., "Ago-2025", "Jul-25")
- Task numbers: use dot notation ("1.1", "2.0", "3.0")
- Return ONLY the JSON object, no markdown, no explanations`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Extract structured data from this EDP document (contract: ${contract_code}, EDP #${edp_number}):\n\n${JSON.stringify(parsed).slice(0, 15000)}`
          }
        ]
      })
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API failed: ${openaiResponse.status} ${errorText}`);
    }

    const openaiResult = await openaiResponse.json();
    const content = openaiResult.choices?.[0]?.message?.content || '{}';
    const structured = JSON.parse(content);

    console.log(`✅ OpenAI extraction completed`);

    // 5️⃣ Save extracted data
    const { error: extractedInsertError } = await supabase.from('edp_extracted').insert({
      contract_code,
      edp_number,
      structured_json: structured
    });

    if (extractedInsertError) {
      console.error('Failed to save extracted data:', extractedInsertError);
    }

    // 6️⃣ Get contract ID
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id')
      .eq('code', structured.contract_code)
      .single();

    if (contractError || !contract) {
      throw new Error(`Contract not found: ${structured.contract_code}`);
    }

    const contract_id = contract.id;

    // 7️⃣ Upsert payment state
    const { error: paymentError } = await supabase.from('payment_states').upsert({
      contract_id,
      edp_number: structured.edp_number,
      period_label: structured.period,
      amount_uf: structured.amount_uf,
      amount_clp: structured.amount_clp,
      uf_rate: structured.uf_rate,
      status: 'approved',
      data: {
        accumulated_prev_uf: structured.accumulated_prev_uf,
        accumulated_total_uf: structured.accumulated_total_uf,
        contract_progress_pct: structured.contract_progress_pct
      }
    }, {
      onConflict: 'contract_id,edp_number'
    });

    if (paymentError) {
      throw new Error(`Failed to upsert payment state: ${paymentError.message}`);
    }

    console.log(`✅ Payment state upserted`);

    // 8️⃣ Upsert contract tasks
    for (const task of structured.tasks_executed || []) {
      const { error: taskError } = await supabase.from('contract_tasks').upsert({
        contract_id,
        task_number: task.task_number,
        task_name: task.name,
        spent_uf: task.spent_uf,
        budget_uf: task.budget_uf
      }, {
        onConflict: 'contract_id,task_number'
      });

      if (taskError) {
        console.error(`Failed to upsert task ${task.task_number}:`, taskError);
      }
    }

    console.log(`✅ ${structured.tasks_executed?.length || 0} tasks upserted`);

    // 9️⃣ Refresh contract metrics
    const { error: refreshError } = await supabase.rpc('refresh_contract_metrics', {
      contract_code: structured.contract_code
    });

    if (refreshError) {
      console.error('Failed to refresh contract metrics:', refreshError);
    }

    console.log(`✅ Contract metrics refreshed`);

    // 🔟 Return success response
    return new Response(
      JSON.stringify({
        ok: true,
        pipeline: 'upload→LlamaParse→OpenAI→Supabase',
        contract_code: structured.contract_code,
        edp_number: structured.edp_number,
        dashboard_updated: true,
        metrics: {
          spent_uf: structured.accumulated_total_uf,
          progress_pct: structured.contract_progress_pct,
          tasks_count: structured.tasks_executed?.length || 0
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Error in process-edp-llamaparse:', error);
    
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
