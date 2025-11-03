import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Document type specific prompts
const EXTRACTION_PROMPTS: Record<string, string> = {
  edp: `You are an expert data extractor for mining contract payment statements (EDP - Estado de Pago).

Parse the following JSON extracted from a PDF and return normalized JSON with numeric fields for the payment statement.

Target schema:
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
      "spent_uf": 94.63,
      "progress_pct": 19
    }
  ]
}

Return ONLY valid JSON, no markdown formatting.`,
  
  contract: `You are an expert at extracting contract metadata from legal documents.

Extract the following information from the document:
- Contract code/number
- Parties involved (client and contractor)
- Start date and end date
- Total budget (in UF if available)
- Key deliverables and milestones
- Payment terms

Return the data as structured JSON with clear field names. Return ONLY valid JSON, no markdown.`,
  
  sdi: `You are an expert at extracting information requests (SDI - Solicitud de Información).

Extract:
- SDI number
- Topic/subject
- Requested by (person/entity)
- Request date
- Due date (usually 5 business days from request)
- Current status

Return ONLY valid JSON, no markdown.`,
  
  quality: `You are an expert at extracting quality plan requirements.

Extract:
- Quality standards and compliance requirements
- Inspection points and deliverables
- Responsible parties
- Review schedules

Return ONLY valid JSON, no markdown.`,
  
  sso: `You are an expert at extracting safety and health plan requirements.

Extract:
- Safety protocols and requirements
- Risk assessments
- Responsible parties
- Training requirements
- Emergency procedures

Return ONLY valid JSON, no markdown.`,
  
  tech: `You are an expert at extracting technical study information.

Extract:
- Study objectives and scope
- Deliverables and milestones
- Technical specifications
- Timelines

Return ONLY valid JSON, no markdown.`,
  
  addendum: `You are an expert at extracting contract modifications and change orders.

Extract:
- Addendum number
- Effective date
- Changes to scope, budget, or timeline
- Justification for changes
- New contract terms

Return ONLY valid JSON, no markdown.`
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const llamaApiKey = Deno.env.get("LLAMAPARSE_API_KEY");
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { contract_code, storage_path, document_type, metadata = {}, edp_number } = body;

    console.log(`[process-document] Processing ${document_type}: ${storage_path}`);

    // Get contract
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("id")
      .eq("code", contract_code)
      .single();

    if (contractError || !contract) {
      throw new Error(`Contract not found: ${contract_code}`);
    }

    // Create processing job
    const { data: job, error: jobError } = await supabase
      .from("document_processing_jobs")
      .insert({
        contract_id: contract.id,
        storage_path,
        document_type,
        status: "processing",
        progress: { step: "started", percent: 0 }
      })
      .select()
      .single();

    if (jobError) {
      console.error("[process-document] Job creation error:", jobError);
      throw new Error("Failed to create processing job");
    }

    console.log(`[process-document] Job created: ${job.id}`);

    // Step 1: Generate presigned URL
    await supabase
      .from("document_processing_jobs")
      .update({ progress: { step: "generating_url", percent: 10 } })
      .eq("id", job.id);

    const { data: urlData, error: urlError } = await supabase.storage
      .from("contracts")
      .createSignedUrl(storage_path, 600);

    if (urlError || !urlData) {
      throw new Error(`Failed to generate signed URL: ${urlError?.message}`);
    }

    console.log(`[process-document] Signed URL generated`);

    // Step 2: Call LlamaParse
    if (!llamaApiKey) {
      throw new Error("LLAMAPARSE_API_KEY not configured");
    }

    await supabase
      .from("document_processing_jobs")
      .update({ progress: { step: "llamaparse_submit", percent: 20 } })
      .eq("id", job.id);

    const llamaResponse = await fetch("https://api.cloud.llamaindex.ai/api/parsing/upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${llamaApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify({
        "url": urlData.signedUrl,
        "parsing_instruction": "Extract all text, tables, and structure from this document. Preserve formatting and numerical data.",
        "result_type": "json",
        "fast_mode": false,
        "do_not_cache": false,
        "continuous_mode": true,
        "invalidate_cache": false,
        "skip_diagonal_text": false,
        "page_separator": "\n\n---PAGE_BREAK---\n\n"
      })
    });

    if (!llamaResponse.ok) {
      const errorText = await llamaResponse.text();
      console.error(`[process-document] LlamaParse API error:`, errorText);
      throw new Error(`LlamaParse API error: ${llamaResponse.status} ${errorText}`);
    }

    const llamaData = await llamaResponse.json();
    const jobId = llamaData.id;

    console.log(`[process-document] LlamaParse job submitted: ${jobId}`);

    await supabase
      .from("document_processing_jobs")
      .update({ 
        llama_job_id: jobId,
        progress: { step: "llamaparse_polling", percent: 30 }
      })
      .eq("id", job.id);

    // Step 3: Poll LlamaParse until complete
    let parsed;
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
        headers: { "Authorization": `Bearer ${llamaApiKey}` }
      });

      if (!statusResponse.ok) {
        console.error(`[process-document] LlamaParse status check failed: ${statusResponse.status}`);
        continue;
      }

      const statusData = await statusResponse.json();
      console.log(`[process-document] LlamaParse status (attempt ${attempts}):`, statusData.status);

      const progressPercent = 30 + Math.min(50, (attempts / maxAttempts) * 50);
      await supabase
        .from("document_processing_jobs")
        .update({ progress: { step: "llamaparse_polling", percent: Math.round(progressPercent), attempts } })
        .eq("id", job.id);

      if (statusData.status === "SUCCESS") {
        // Fetch result
        const resultResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/json`, {
          headers: { "Authorization": `Bearer ${llamaApiKey}` }
        });

        if (!resultResponse.ok) {
          throw new Error(`Failed to fetch LlamaParse result: ${resultResponse.status}`);
        }

        parsed = await resultResponse.json();
        console.log(`[process-document] LlamaParse completed successfully`);
        break;
      } else if (statusData.status === "ERROR" || statusData.status === "FAILED") {
        throw new Error(`LlamaParse job failed: ${statusData.error || "Unknown error"}`);
      }
    }

    if (!parsed) {
      throw new Error("LlamaParse polling timeout after 2 minutes");
    }

    // Save raw parse
    await supabase.from("edp_raw_parsed").insert({
      contract_code,
      edp_number: edp_number || null,
      storage_path,
      llama_job_id: jobId,
      parsed_json: parsed
    });

    console.log(`[process-document] Raw parse saved to edp_raw_parsed`);

    // Step 4: Extract with OpenAI
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    await supabase
      .from("document_processing_jobs")
      .update({ progress: { step: "openai_extraction", percent: 85 } })
      .eq("id", job.id);

    const systemPrompt = EXTRACTION_PROMPTS[document_type] || EXTRACTION_PROMPTS.contract;
    const parsedText = JSON.stringify(parsed).slice(0, 100000); // Limit to 100k chars

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Document content:\n\n${parsedText}` }
        ]
      })
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error(`[process-document] OpenAI API error:`, errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    let content = openaiData.choices?.[0]?.message?.content || "{}";

    // Clean markdown formatting if present
    content = content.replace(/^```json\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    const structured = JSON.parse(content);

    console.log(`[process-document] OpenAI extraction completed`);

    // Save structured extraction
    await supabase.from("edp_extracted").insert({
      contract_code,
      edp_number: structured.edp_number || edp_number || null,
      structured_json: structured
    });

    console.log(`[process-document] Structured data saved to edp_extracted`);

    // Step 5: Upsert into business tables (document_type specific)
    if (document_type === "edp") {
      // Upsert payment state
      await supabase.from("payment_states").upsert({
        contract_id: contract.id,
        edp_number: structured.edp_number,
        amount_uf: structured.amount_uf,
        amount_clp: structured.amount_clp,
        uf_rate: structured.uf_rate,
        status: "approved",
        data: structured
      }, { onConflict: "contract_id,edp_number" });

      console.log(`[process-document] Payment state upserted`);

      // Upsert tasks
      for (const task of structured.tasks_executed || []) {
        await supabase.from("contract_tasks").upsert({
          contract_id: contract.id,
          task_number: task.task_number,
          name: task.name,
          spent_uf: task.spent_uf,
          budget_uf: task.budget_uf,
          progress_pct: task.progress_pct || 0
        }, { onConflict: "contract_id,task_number" });
      }

      console.log(`[process-document] Tasks upserted: ${structured.tasks_executed?.length || 0}`);

      // Refresh contract metrics
      await supabase.rpc("refresh_contract_metrics", { contract_code });

      console.log(`[process-document] Contract metrics refreshed`);
    }

    // Mark job as completed
    await supabase
      .from("document_processing_jobs")
      .update({
        status: "completed",
        progress: { step: "completed", percent: 100 },
        result: structured
      })
      .eq("id", job.id);

    console.log(`[process-document] Job completed: ${job.id}`);

    return new Response(JSON.stringify({
      ok: true,
      job_id: job.id,
      contract_code,
      document_type,
      extracted_data: structured
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[process-document] Error:", error);

    // Try to update job status if we have context
    try {
      const body = await req.clone().json();
      const { contract_code, storage_path } = body;
      
      if (contract_code && storage_path) {
        const { data: contract } = await supabase
          .from("contracts")
          .select("id")
          .eq("code", contract_code)
          .single();

        if (contract) {
          await supabase
            .from("document_processing_jobs")
            .update({
              status: "failed",
              error: error instanceof Error ? error.message : String(error)
            })
            .eq("contract_id", contract.id)
            .eq("storage_path", storage_path)
            .eq("status", "processing");
        }
      }
    } catch (updateError) {
      console.error("[process-document] Failed to update job status:", updateError);
    }

    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
