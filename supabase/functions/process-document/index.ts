import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// EDP extraction prompt with canonical task mapping
const EDP_EXTRACTION_PROMPT = `You are ContractOS' EDP extractor. Your job is to transform the JSON parsed by LlamaParse for a mining payment statement (EDP) into a STRICT, canonical JSON that matches the contract's task catalog.

IMPORTANT PRINCIPLES
- Never invent task names or numbers.
- Always normalize each row to the contract's canonical task_number and name using the provided catalog.
- Only return VALID JSON (no prose). All numeric values are decimals with dot separator.

INPUTS PROVIDED
1) parsed_json: JSON from LlamaParse (contains text + tables).
2) contract_code: string.
3) tasks_map: an object mapping task_number → canonical_name for this contract.

WHAT YOU MUST EXTRACT
From parsed_json (table usually titled "TAREA" with a "Total" UF column, plus header/footer boxes), return exactly:

{
  "contract_code": "<contract_code>",
  "edp_number": <int>,
  "period": "<Mon-YYYY>",
  "uf_rate": <number>,
  "amount_uf": <number>,
  "amount_clp": <integer>,
  "accumulated_prev_uf": <number>,
  "accumulated_total_uf": <number>,
  "contract_progress_pct": <number>,
  "tasks_executed": [
    { "task_number":"<canonical>", "name":"<canonical>", "budget_uf": <number|null>, "spent_uf": <number> }
  ]
}

CANONICAL TASK NORMALIZATION RULES
1) The "tasks_map" is the source of truth for names. The output "name" MUST come from tasks_map[task_number].
2) Detect a row's raw number from the first cell if it starts with a number pattern: ^(\\d+(?:\\.\\d+)?)\\s*[-–]
   - If raw_number == "1" and there is another row with "1.2" in this EDP, normalize raw "1" to "1.1".
   - If raw_number is an integer X and tasks_map contains "X.0", normalize to "X.0".
3) If the row has no explicit number, resolve by semantic similarity against tasks_map values (high-confidence only, ≥0.90). If no confident match, EXCLUDE the row.
4) Omit rows where the "Total" UF equals zero.
5) budget_uf: if budget for that task appears in the header table or is known by context, include it; otherwise use null.
6) Merge duplicate rows that map to the same task_number by summing their UF in spent_uf.

VALIDATION & CONSISTENCY
- Perform two checks:
  a) |sum(tasks_executed[].spent_uf) - amount_uf| ≤ 0.5
  b) |(accumulated_prev_uf + amount_uf) - accumulated_total_uf| ≤ 0.5
- If either check fails, set "meta.review_required": true.

OUTPUT FORMAT
Return ONLY this JSON object (no markdown, no commentary):

{
  "contract_code": "...",
  "edp_number": 2,
  "period": "Ago-2025",
  "uf_rate": 39383.07,
  "amount_uf": 418.44,
  "amount_clp": 16479349,
  "accumulated_prev_uf": 209.8,
  "accumulated_total_uf": 628.2,
  "contract_progress_pct": 14,
  "tasks_executed": [...],
  "meta": {
    "checks": {
      "sum_tasks_equals_amount_uf": true|false,
      "accum_prev_plus_current_equals_total": true|false
    },
    "review_required": true|false,
    "notes": []
  }
}

ROBUSTNESS NOTES
- Normalize thousand/decimal separators (e.g., "16.479.349" → 16479349; "418,44" → 418.44).
- If multiple "TAREA" tables exist, choose the one with a "Total" UF column and largest number of non-zero rows.
- Ignore administrative footers, headers, watermarks, and logos.

Return only the final JSON object.`;

// Document type specific prompts
const EXTRACTION_PROMPTS: Record<string, string> = {
  edp: EDP_EXTRACTION_PROMPT,
  
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

  // Parse body once at the start for use in error handler
  let requestBody: any;
  try {
    requestBody = await req.json();
  } catch (parseError) {
    console.error("[process-document] Failed to parse request body:", parseError);
    return new Response(JSON.stringify({
      ok: false,
      error: "Invalid request body"
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { contract_code, storage_path, document_type, metadata = {}, edp_number } = requestBody;

  try {
    console.log(`[process-document] Processing ${document_type}: ${storage_path}`);

    // Get or create contract
    let contract;
    
    if (document_type === "contract" && !contract_code) {
      // For contract documents without a code, we'll extract it and create the contract later
      console.log(`[process-document] Contract document without code, will extract and create`);
      contract = null;
    } else {
      // Get existing contract
      const { data: existingContract, error: contractError } = await supabase
        .from("contracts")
        .select("id")
        .eq("code", contract_code)
        .single();

      if (contractError || !existingContract) {
        throw new Error(`Contract not found: ${contract_code}`);
      }
      
      contract = existingContract;
    }

    // Create processing job (contract_id may be null for new contracts)
    const { data: job, error: jobError } = await supabase
      .from("document_processing_jobs")
      .insert({
        contract_id: contract?.id || null,
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

    // Step 1: Generate presigned URL (3600 seconds = 1 hour for LlamaParse processing)
    await supabase
      .from("document_processing_jobs")
      .update({ progress: { step: "generating_url", percent: 10 } })
      .eq("id", job.id);

    const { data: urlData, error: urlError } = await supabase.storage
      .from("contracts")
      .createSignedUrl(storage_path, 3600);

    if (urlError || !urlData) {
      console.error(`[process-document] Signed URL error:`, urlError);
      throw new Error(`Failed to generate signed URL: ${urlError?.message}`);
    }

    console.log(`[process-document] Signed URL generated:`, urlData.signedUrl.substring(0, 100) + "...");

    // Step 2: Download file from Supabase Storage and prepare for LlamaParse
    if (!llamaApiKey) {
      throw new Error("LLAMAPARSE_API_KEY not configured");
    }

    await supabase
      .from("document_processing_jobs")
      .update({ progress: { step: "downloading_file", percent: 15 } })
      .eq("id", job.id);

    // Download the file from Supabase Storage
    console.log(`[process-document] Downloading file from storage: ${storage_path}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("contracts")
      .download(storage_path);

    if (downloadError || !fileData) {
      console.error(`[process-document] Download error:`, downloadError);
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    console.log(`[process-document] File downloaded, size: ${fileData.size} bytes`);

    await supabase
      .from("document_processing_jobs")
      .update({ progress: { step: "llamaparse_submit", percent: 20 } })
      .eq("id", job.id);

    // Prepare multipart/form-data
    const formData = new FormData();
    formData.append("file", fileData, storage_path.split('/').pop() || "document.pdf");
    formData.append("parsing_instruction", "Extract all text, tables, and structure from this document. Preserve formatting and numerical data.");
    formData.append("result_type", "json");
    formData.append("fast_mode", "false");
    formData.append("do_not_cache", "false");
    formData.append("continuous_mode", "true");
    formData.append("invalidate_cache", "false");
    formData.append("skip_diagonal_text", "false");
    formData.append("page_separator", "\n\n---PAGE_BREAK---\n\n");

    console.log(`[process-document] Uploading to LlamaParse...`);

    const llamaResponse = await fetch("https://api.cloud.llamaindex.ai/api/parsing/upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${llamaApiKey}`,
        "Accept": "application/json",
      },
      body: formData
    });

    if (!llamaResponse.ok) {
      const errorText = await llamaResponse.text();
      console.error(`[process-document] LlamaParse API error (${llamaResponse.status}):`, errorText);
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

    let systemPrompt = EXTRACTION_PROMPTS[document_type] || EXTRACTION_PROMPTS.contract;
    const parsedText = JSON.stringify(parsed).slice(0, 100000); // Limit to 100k chars
    
    let userPrompt = `Document content:\n\n${parsedText}`;

    // For EDP documents, fetch and include the contract's task catalog
    if (document_type === "edp" && contract) {
      const { data: tasks, error: tasksError } = await supabase
        .from("contract_tasks")
        .select("task_number, task_name")
        .eq("contract_id", contract.id)
        .order("task_number");

      if (!tasksError && tasks && tasks.length > 0) {
        const tasksMap: Record<string, string> = {};
        tasks.forEach(t => {
          tasksMap[t.task_number] = t.task_name;
        });
        
        userPrompt = `Contract Code: ${contract_code}

Tasks Map (canonical catalog):
${JSON.stringify(tasksMap, null, 2)}

Document content:
${parsedText}`;
      } else {
        console.log("[process-document] No tasks found for contract, proceeding without tasks_map");
      }
    }

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
          { role: "user", content: userPrompt }
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

    // Step 4.5: For contract documents, create the contract if it doesn't exist
    if (document_type === "contract" && !contract) {
      const extractedCode = structured.contract_code || structured.code || `CONTRACT-${Date.now()}`;
      const extractedTitle = structured.title || structured.name || "Contrato sin título";
      
      console.log(`[process-document] Creating new contract: ${extractedCode}`);
      
      const { data: newContract, error: contractCreateError } = await supabase
        .from("contracts")
        .insert({
          code: extractedCode,
          title: extractedTitle,
          type: "service",
          status: "draft",
          metadata: structured
        })
        .select()
        .single();
      
      if (contractCreateError) {
        console.error(`[process-document] Failed to create contract:`, contractCreateError);
        throw new Error(`Failed to create contract: ${contractCreateError.message}`);
      }
      
      contract = newContract;
      
      // Update job with contract_id
      await supabase
        .from("document_processing_jobs")
        .update({ contract_id: contract.id })
        .eq("id", job.id);
      
      console.log(`[process-document] Contract created: ${contract.id}`);
    }

    // Save structured extraction
    if (document_type === "edp") {
      await supabase.from("edp_extracted").insert({
        contract_code: contract_code || structured.contract_code,
        edp_number: structured.edp_number || edp_number || null,
        structured_json: structured
      });

      console.log(`[process-document] Structured data saved to edp_extracted`);
    }

    // Step 5: Upsert into business tables (document_type specific)
    if (document_type === "edp" && contract && contract.id) {
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
          task_name: task.name,
          spent_uf: task.spent_uf,
          budget_uf: task.budget_uf,
          progress_percentage: task.progress_pct || 0
        }, { onConflict: "contract_id,task_number" });
      }

      console.log(`[process-document] Tasks upserted: ${structured.tasks_executed?.length || 0}`);

      // Refresh contract metrics
      const finalContractCode = contract_code || structured.contract_code;
      if (finalContractCode) {
        await supabase.rpc("refresh_contract_metrics", { contract_code: finalContractCode });
        console.log(`[process-document] Contract metrics refreshed`);
      }
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
    console.error("[process-document] Error stack:", error instanceof Error ? error.stack : "No stack");

    // Try to update job status using stored request body
    try {
      if (requestBody?.contract_code && requestBody?.storage_path) {
        const { data: contract } = await supabase
          .from("contracts")
          .select("id")
          .eq("code", requestBody.contract_code)
          .single();

        if (contract) {
          const updateResult = await supabase
            .from("document_processing_jobs")
            .update({
              status: "failed",
              error: error instanceof Error ? error.message : String(error)
            })
            .eq("contract_id", contract.id)
            .eq("storage_path", requestBody.storage_path)
            .eq("status", "processing");

          console.log("[process-document] Job status updated to failed:", updateResult);
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
