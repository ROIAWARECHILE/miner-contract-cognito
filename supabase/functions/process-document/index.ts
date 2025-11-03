import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// EDP extraction prompt with FULL validation and task detection
const EDP_EXTRACTION_PROMPT = `You are ContractOS' EDP extractor specialized in Chilean mining payment statements.
Your job is to extract structured data from "Estados de Pago" (EDPs) with EXTREME precision.

CRITICAL REQUIREMENTS:
1. Extract ALL tasks from the payment table, even if some have 0 spent
2. NEVER invent data - if not found, use null
3. ALL numeric values use dot as decimal separator (e.g., 209.81)
4. Dates in ISO format (YYYY-MM-DD)
5. Currency is UF (Unidad de Fomento) unless specified
6. Return ONLY valid JSON (no markdown, no prose)

WHAT YOU MUST EXTRACT:

{
  "edp_number": <int>,
  "period": "<string>",  // MANDATORY - e.g., "Jul-25", "Ago-25", "Sep-25"
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "amount_uf": <number>,  // Total payment amount this EDP
  "uf_rate": <number>,    // UF exchange rate if present
  "amount_clp": <number>, // CLP amount if present
  "status": "approved|submitted|rejected|draft",
  "approval_date": "YYYY-MM-DD",  // If approved
  "tasks_executed": [
    {
      "task_number": "<string>",  // e.g., "1", "1.2", "2", "3", "9"
      "name": "<string>",
      "budget_uf": <number>,      // Original task budget from contract
      "spent_uf": <number>,       // Amount spent THIS EDP
      "progress_pct": <int>       // Cumulative progress %
    }
  ],
  "meta": {
    "extraction_confidence": <0.0-1.0>,
    "review_required": <boolean>,
    "warnings": ["<string>"],
    "missing_amount_uf": <number>  // If tasks sum doesn't match total
  }
}

PERIOD EXTRACTION RULES (MANDATORY):
- Look for: "Período:", "Periodo:", "MES:", "Month:", date range in header
- Common formats: "Julio 2025", "Jul-25", "07/2025", "Período: 21/07/2025 - 31/07/2025"
- Normalize to "MMM-YY" format (Jul-25, Ago-25, Sep-25, Oct-25, Nov-25, Dic-25)
- Spanish months: Enero→Ene, Febrero→Feb, Marzo→Mar, Abril→Abr, Mayo→May, Junio→Jun, Julio→Jul, Agosto→Ago, Septiembre→Sep, Octubre→Oct, Noviembre→Nov, Diciembre→Dic
- If period not found, set "meta.review_required": true and "meta.warnings": ["CRITICAL: Period not found"]

EXTRACTION RULES FOR TASKS (CRITICAL):
- Tasks appear in a table with columns typically: "TAREA" or "Nº", "Descripción", "Presupuesto UF", "Avance %", "UF Ejecutadas"
- **EXTRACT ALL TASKS FROM THE TABLE** even if spent_uf is 0 or blank
- Common task structure for this contract:
  * Task 1: "Recopilación y análisis de información"
  * Task 1.2: "Visita a terreno" (often without number in first column)
  * Task 2: "Actualización del estudio hidrológico"
  * Task 3: "Revisión experta del actual Modelo Hidrogeológico"
  * Task 4: "Actualización y calibración del modelo hidrogeológico"
  * Task 5: "Definición de condiciones desfavorables"
  * Task 6: "Simulaciones predictivas"
  * Task 7: "Asesoría técnica permanente"
  * Task 8: "Reuniones y presentaciones"
  * Task 9: "Costos de Administración y Operación"

SPECIAL RULE for Task 1.2 (Visita a terreno):
- May appear WITHOUT task number in first column
- Keywords: "visita", "terreno", "campo", "site visit"
- ALWAYS map to task_number "1.2"
- If you see "Visita a terreno" but no number, use "1.2"

SPECIAL RULE for Task 3 (Revisión experta):
- Keywords: "revisión experta", "modelo hidrogeológico", "peer review"
- ALWAYS map to task_number "3"

NORMALIZATION RULES for task_number:
- Preserve "1.2" exactly (never "1", never "12")
- Remove ".0" suffix (e.g., "3.0" → "3", "9.0" → "9")
- If blank but name matches known task, infer number

CRITICAL VALIDATION:
1. Sum all tasks[].spent_uf
2. Compare with amount_uf
3. If difference > 5%, set:
   - "meta.review_required": true
   - "meta.warnings": ["Tasks sum (XXX UF) differs from total (YYY UF) by ZZZ UF - some tasks may be missing"]
   - "meta.missing_amount_uf": <difference>
4. If Task 1 or Task 2 present but Task 1.2 missing, warn: "Task 1.2 (Visita a terreno) not detected"

Return ONLY the JSON object (no markdown, no prose).`;

// Document type specific prompts
const EXTRACTION_PROMPTS: Record<string, string> = {
  edp: EDP_EXTRACTION_PROMPT,
  
  contract: `You are ContractOS' contract extractor specialized in Chilean mining contracts. Your job is to extract ALL critical contract data with EXTREME precision.

CRITICAL REQUIREMENTS:
1. NEVER invent data - if not found, use null
2. ALL numeric values use dot as decimal separator (e.g., 4501.00)
3. Dates in ISO format (YYYY-MM-DD)
4. Currency is UF (Unidad de Fomento) unless specified
5. Return ONLY valid JSON (no markdown, no prose)

WHAT YOU MUST EXTRACT:

{
  "contract_code": "<string>",  // CRITICAL: Usually starts with "AIPD", "CSI", etc.
  "title": "<string>",
  "client": "<string>",  // Entity hiring the contractor
  "contractor": "<string>",  // Entity providing the service
  "start_date": "YYYY-MM-DD",  // Contract start date
  "end_date": "YYYY-MM-DD",  // Contract end date (if defined)
  "budget_uf": <number>,  // Total contract budget in UF
  "currency": "UF",
  "payment_terms": {
    "type": "monthly|milestone|upon_completion",
    "conditions": "<string>"
  },
  "tasks": [
    {
      "task_number": "<string>",  // e.g., "1", "1.2", "2", "3"
      "name": "<string>",  // Full canonical task name
      "budget_uf": <number>,  // Individual task budget
      "deliverables": ["<string>"],  // Key deliverables for this task
      "timeline": "<string>"  // If specified
    }
  ],
  "key_deliverables": ["<string>"],  // High-level deliverables
  "milestones": [
    {
      "name": "<string>",
      "date": "YYYY-MM-DD",
      "description": "<string>"
    }
  ],
  "contacts": [
    {
      "name": "<string>",
      "role": "client_representative|contractor_pm|technical_lead",
      "email": "<string>",
      "phone": "<string>"
    }
  ],
  "special_clauses": [
    {
      "type": "warranty|penalty|bonus|termination|liability",
      "description": "<string>",
      "value": "<string>"  // If monetary value involved
    }
  ],
  "meta": {
    "document_pages": <int>,
    "extraction_confidence": <0.0-1.0>,
    "review_required": <boolean>,
    "warnings": ["<string>"]
  }
}

EXTRACTION RULES FOR TASKS:
- Tasks usually appear in a table with columns: "TAREA" or "Nº", "Descripción", "Presupuesto UF"
- Common task structure for mining projects:
  * Task 1: "Recopilación y análisis de información"
  * Task 1.2: "Visita a terreno"
  * Task 2-9: Various technical and administrative tasks
- ALWAYS preserve the original task_number (e.g., "1.2" not "1" or "12")
- Sum individual task budgets and verify against total budget_uf
- If mismatch >5%, set "meta.review_required": true

EXTRACTION RULES FOR DATES:
- Look for: "Fecha de Inicio:", "Plazo:", "Vigencia:", "Fecha de Término:"
- Common formats: "DD/MM/YYYY", "DD-MM-YYYY", "DD de MMMM de YYYY"
- Convert Spanish months: Enero→01, Febrero→02, ..., Diciembre→12
- If end date is expressed as duration (e.g., "6 meses"), calculate from start date

EXTRACTION RULES FOR BUDGET:
- Look for: "Presupuesto Total:", "Monto del Contrato:", "Valor Total:"
- Usually expressed in UF (Unidad de Fomento)
- May have both UF and CLP amounts - prioritize UF
- Format: remove thousand separators, use dot for decimals (e.g., "4.501,00 UF" → 4501.00)

EXTRACTION RULES FOR PARTIES:
- Client: Usually "Mandante:", "Cliente:", or appears after "entre" clause
- Contractor: Usually "Contratista:", "Consultor:", or second party in "entre" clause
- Extract full legal names (e.g., "Andes Iron SpA", "Itasca Chile SpA")

VALIDATION CHECKS:
1. contract_code must be present (CRITICAL)
2. client and contractor must be present
3. budget_uf must be >0
4. If tasks array is not empty, sum(tasks[].budget_uf) should ≈ budget_uf (tolerance ±5%)
5. start_date must be valid ISO date
6. If any CRITICAL field is missing or confidence <0.80, set "meta.review_required": true

CONFIDENCE SCORING:
- 1.0: All critical fields extracted with high certainty
- 0.8-0.99: Most fields extracted, minor ambiguities
- 0.6-0.79: Some fields missing or uncertain
- <0.6: Major extraction issues, manual review required

Return ONLY the JSON object (no markdown, no prose).`,

  sdi: `You are ContractOS' SDI (Solicitud de Información) extractor for mining projects.

CRITICAL: Extract ALL required fields with precision. Return ONLY valid JSON.

{
  "sdi_number": "<string>",  // e.g., "SDI-001", "SDI-2025-042"
  "contract_code": "<string>",  // Associated contract
  "topic": "<string>",  // Subject/topic of the information request
  "description": "<string>",  // Detailed description
  "requested_by": {
    "name": "<string>",
    "entity": "client|contractor|third_party",
    "email": "<string>"
  },
  "requested_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",  // Usually 5 business days from requested_date
  "priority": "low|medium|high|critical",
  "status": "open|in_progress|answered|closed",
  "response_date": "YYYY-MM-DD",  // If already answered
  "response_summary": "<string>",  // If already answered
  "attachments": ["<string>"],  // List of referenced documents
  "meta": {
    "extraction_confidence": <0.0-1.0>,
    "review_required": <boolean>,
    "warnings": ["<string>"]
  }
}

EXTRACTION RULES:
- SDI number is CRITICAL - usually in header or title
- Due date calculation: requested_date + 5 business days (Mon-Fri)
- Status: if response is present → "answered", else → "open"
- Priority: extract from document or infer from keywords (urgente→critical, importante→high)
- If sdi_number or requested_date missing, set "meta.review_required": true

Return ONLY the JSON object.`,

  quality: `You are ContractOS' quality plan extractor for mining projects.

Extract comprehensive quality assurance and control requirements. Return ONLY valid JSON.

{
  "document_code": "<string>",  // Plan code/number
  "contract_code": "<string>",  // Associated contract
  "title": "<string>",
  "version": "<string>",  // e.g., "R0", "Rev. 1"
  "effective_date": "YYYY-MM-DD",
  "quality_standards": [
    {
      "standard_name": "<string>",  // e.g., "ISO 9001", "NCh 2909"
      "scope": "<string>",
      "compliance_level": "mandatory|recommended"
    }
  ],
  "inspection_points": [
    {
      "point_id": "<string>",
      "description": "<string>",
      "frequency": "<string>",  // e.g., "daily", "per milestone"
      "responsible": "<string>",
      "acceptance_criteria": "<string>"
    }
  ],
  "deliverables": [
    {
      "name": "<string>",
      "type": "report|test|certificate|checklist",
      "frequency": "<string>",
      "due_date": "YYYY-MM-DD"
    }
  ],
  "responsible_parties": [
    {
      "name": "<string>",
      "role": "quality_manager|inspector|reviewer",
      "responsibilities": ["<string>"]
    }
  ],
  "review_schedule": {
    "frequency": "<string>",  // e.g., "monthly", "quarterly"
    "next_review_date": "YYYY-MM-DD"
  },
  "non_conformance_procedures": "<string>",
  "meta": {
    "extraction_confidence": <0.0-1.0>,
    "review_required": <boolean>
  }
}

Return ONLY the JSON object.`,

  sso: `You are ContractOS' SSO (Safety & Health) plan extractor for mining projects.

Extract comprehensive safety protocols and requirements. Return ONLY valid JSON.

{
  "document_code": "<string>",
  "contract_code": "<string>",
  "title": "<string>",
  "version": "<string>",
  "effective_date": "YYYY-MM-DD",
  "safety_protocols": [
    {
      "protocol_id": "<string>",
      "name": "<string>",
      "description": "<string>",
      "compliance_requirement": "mandatory|recommended",
      "applicable_tasks": ["<string>"]
    }
  ],
  "risk_assessments": [
    {
      "risk_id": "<string>",
      "description": "<string>",
      "probability": "low|medium|high",
      "impact": "low|medium|high|critical",
      "mitigation_measures": ["<string>"],
      "responsible": "<string>"
    }
  ],
  "ppe_requirements": [
    {
      "equipment": "<string>",
      "applicable_tasks": ["<string>"],
      "certification_required": <boolean>
    }
  ],
  "training_requirements": [
    {
      "training_name": "<string>",
      "target_audience": "<string>",
      "duration": "<string>",
      "frequency": "<string>",
      "certification": <boolean>
    }
  ],
  "emergency_procedures": [
    {
      "scenario": "<string>",  // e.g., "fire", "chemical spill", "injury"
      "response_steps": ["<string>"],
      "emergency_contacts": ["<string>"]
    }
  ],
  "responsible_parties": [
    {
      "name": "<string>",
      "role": "safety_manager|safety_officer|first_responder",
      "responsibilities": ["<string>"]
    }
  ],
  "meta": {
    "extraction_confidence": <0.0-1.0>,
    "review_required": <boolean>
  }
}

Return ONLY the JSON object.`,

  tech: `You are ContractOS' technical study extractor for mining/engineering projects.

Extract comprehensive technical specifications and requirements. Return ONLY valid JSON.

{
  "document_code": "<string>",
  "contract_code": "<string>",
  "title": "<string>",
  "version": "<string>",
  "study_type": "hydrology|hydrogeology|geotechnical|environmental|other",
  "objectives": ["<string>"],
  "scope": {
    "description": "<string>",
    "geographic_area": "<string>",
    "exclusions": ["<string>"]
  },
  "methodology": {
    "approach": "<string>",
    "techniques": ["<string>"],
    "software_tools": ["<string>"]
  },
  "deliverables": [
    {
      "name": "<string>",
      "type": "report|model|map|dataset",
      "format": "<string>",  // e.g., "PDF", "GIS", "Excel"
      "due_date": "YYYY-MM-DD"
    }
  ],
  "milestones": [
    {
      "name": "<string>",
      "description": "<string>",
      "planned_date": "YYYY-MM-DD",
      "dependencies": ["<string>"]
    }
  ],
  "technical_specifications": [
    {
      "parameter": "<string>",
      "value": "<string>",
      "unit": "<string>",
      "tolerance": "<string>"
    }
  ],
  "data_sources": [
    {
      "source_name": "<string>",
      "type": "field_data|literature|previous_studies|database",
      "reliability": "high|medium|low"
    }
  ],
  "timeline": {
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "phases": [
      {
        "phase_name": "<string>",
        "duration": "<string>",
        "activities": ["<string>"]
      }
    ]
  },
  "meta": {
    "extraction_confidence": <0.0-1.0>,
    "review_required": <boolean>
  }
}

Return ONLY the JSON object.`,

  addendum: `You are ContractOS' addendum/change order extractor for mining contracts.

Extract ALL modifications to the original contract. Return ONLY valid JSON.

{
  "addendum_number": "<string>",  // e.g., "Addendum 1", "Modificación N°2"
  "contract_code": "<string>",  // Original contract code
  "effective_date": "YYYY-MM-DD",
  "approval_date": "YYYY-MM-DD",
  "change_type": "scope|budget|timeline|terms|other",
  "justification": "<string>",  // Reason for the change
  "changes": [
    {
      "section": "<string>",  // Which part of the contract is modified
      "original_value": "<string>",
      "new_value": "<string>",
      "impact": "critical|significant|minor"
    }
  ],
  "budget_impact": {
    "original_budget_uf": <number>,
    "added_budget_uf": <number>,
    "new_total_budget_uf": <number>,
    "justification": "<string>"
  },
  "timeline_impact": {
    "original_end_date": "YYYY-MM-DD",
    "extension_days": <int>,
    "new_end_date": "YYYY-MM-DD",
    "justification": "<string>"
  },
  "scope_changes": [
    {
      "type": "addition|removal|modification",
      "task_number": "<string>",
      "description": "<string>",
      "budget_uf": <number>
    }
  ],
  "new_terms": [
    {
      "clause_type": "<string>",
      "description": "<string>"
    }
  ],
  "approval_signatures": [
    {
      "name": "<string>",
      "role": "client|contractor",
      "signature_date": "YYYY-MM-DD"
    }
  ],
  "meta": {
    "extraction_confidence": <0.0-1.0>,
    "review_required": <boolean>
  }
}

CRITICAL VALIDATION:
- If budget_impact exists, new_total_budget_uf MUST be calculated correctly
- If timeline_impact exists, new_end_date MUST be calculated correctly
- All changes MUST have clear justification
- If any critical field is missing, set "meta.review_required": true

Return ONLY the JSON object.`
};

// Helper: normalize task numbers intelligently
function normalizeTaskNumber(taskNumber: string, taskName: string): string {
  // Caso especial: Tarea 1.2 (preserve exactamente)
  if (taskNumber === '1.2') return '1.2';
  
  // Si no hay task_number pero el nombre indica Tarea 1.2
  if (!taskNumber || taskNumber === '') {
    if (taskName.toLowerCase().includes('visita') &&
        (taskName.toLowerCase().includes('terreno') || taskName.toLowerCase().includes('campo'))) {
      return '1.2';
    }
  }
  
  // Si taskName contiene keywords de Tarea 1.2, forzar a 1.2
  if (taskName.toLowerCase().includes('visita') && taskName.toLowerCase().includes('terreno')) {
    return '1.2';
  }
  
  // Eliminar .0 excepto para 1.2
  if (taskNumber.endsWith('.0')) {
    return taskNumber.replace('.0', '');
  }
  
  // Mapeos por nombre para tareas comunes
  const nameToNumber: Record<string, string> = {
    'recopilación y análisis': '1',
    'visita a terreno': '1.2',
    'actualización del estudio hidrológico': '2',
    'revisión experta': '3',
    'modelo hidrogeológico': '3',
    'actualización y calibración': '4',
    'condiciones desfavorables': '5',
    'simulaciones predictivas': '6',
    'asesoría técnica': '7',
    'reuniones y presentaciones': '8',
    'costos administración': '9',
    'administración y operación': '9'
  };
  
  const nameLower = taskName.toLowerCase();
  for (const [key, value] of Object.entries(nameToNumber)) {
    if (nameLower.includes(key)) {
      return value;
    }
  }
  
  return taskNumber;
}

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
    // Parse request body
    const requestBody = await req.json();
    console.log("[process-document] Request body:", JSON.stringify(requestBody, null, 2));

    const { contract_id, contract_code, storage_path, document_type } = requestBody;

    if (!storage_path) {
      throw new Error("storage_path is required");
    }

    // Step 1: Create a processing job
    const { data: job, error: jobError } = await supabase
      .from("document_processing_jobs")
      .insert({
        storage_path,
        status: "processing",
        contract_id: contract_id || null,
        document_type: document_type || "unknown"
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("[process-document] Failed to create job:", jobError);
      throw new Error(`Failed to create processing job: ${jobError?.message}`);
    }

    console.log(`[process-document] Created job: ${job.id} for ${storage_path}`);

    // Step 2: Get contract if contract_id provided
    let contract = null;
    if (contract_id) {
      const { data: contractData, error: contractError } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", contract_id)
        .single();

      if (contractError) {
        console.error(`[process-document] Contract not found:`, contractError);
        throw new Error(`No contract found with id ${contract_id}`);
      }

      contract = contractData;
      console.log(`[process-document] Using contract: ${contract.code}`);
    } else if (contract_code) {
      const { data: contractData, error: contractError } = await supabase
        .from("contracts")
        .select("*")
        .eq("code", contract_code)
        .single();

      if (contractError) {
        console.warn(`[process-document] Contract not found by code: ${contract_code}`);
      } else {
        contract = contractData;
        console.log(`[process-document] Found contract by code: ${contract.code}`);
      }
    }

    // Step 3: Download from Supabase Storage
    const signedUrlResponse = await supabase.storage
      .from("contracts")
      .createSignedUrl(storage_path, 3600);

    if (signedUrlResponse.error || !signedUrlResponse.data?.signedUrl) {
      throw new Error(`Failed to generate signed URL: ${signedUrlResponse.error?.message}`);
    }

    const fileUrl = signedUrlResponse.data.signedUrl;
    console.log(`[process-document] Generated signed URL`);

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.statusText}`);
    }

    const fileBlob = await fileResponse.blob();
    console.log(`[process-document] Downloaded file, size: ${fileBlob.size} bytes`);

    // Step 4: Parse with LlamaParse
    if (!llamaApiKey) {
      console.warn("[process-document] LlamaParse API key not found, using fallback");
      await supabase
        .from("document_processing_jobs")
        .update({ 
          status: "failed", 
          error_message: "LlamaParse API key not configured",
          updated_at: new Date().toISOString() 
        })
        .eq("id", job.id);
      
      throw new Error("LLAMAPARSE_API_KEY not configured in environment");
    }

    if (!openaiApiKey) {
      console.warn("[process-document] OpenAI API key not found");
      await supabase
        .from("document_processing_jobs")
        .update({ 
          status: "failed", 
          error_message: "OpenAI API key not configured",
          updated_at: new Date().toISOString() 
        })
        .eq("id", job.id);
      
      throw new Error("OPENAI_API_KEY not configured in environment");
    }

    const formData = new FormData();
    formData.append("file", fileBlob, storage_path.split("/").pop() || "document.pdf");
    
    const uploadResponse = await fetch("https://api.cloud.llamaindex.ai/api/parsing/upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${llamaApiKey}`,
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`LlamaParse upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadData = await uploadResponse.json();
    const jobId = uploadData.id;
    console.log(`[process-document] LlamaParse job created: ${jobId}`);

    // Poll for completion
    let result;
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
        headers: {
          "Authorization": `Bearer ${llamaApiKey}`
        }
      });

      if (!statusResponse.ok) {
        throw new Error(`Failed to check status: ${statusResponse.statusText}`);
      }

      result = await statusResponse.json();
      console.log(`[process-document] LlamaParse status: ${result.status}`);

      if (result.status === "SUCCESS") {
        break;
      } else if (result.status === "ERROR") {
        throw new Error(`LlamaParse failed: ${JSON.stringify(result)}`);
      }

      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error("LlamaParse timeout");
    }

    // Get parsed result
    const resultResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/json`, {
      headers: {
        "Authorization": `Bearer ${llamaApiKey}`
      }
    });

    if (!resultResponse.ok) {
      throw new Error(`Failed to get result: ${resultResponse.statusText}`);
    }

    const parsedJson = await resultResponse.json();
    console.log(`[process-document] LlamaParse completed, pages: ${parsedJson.pages?.length || 0}`);

    // Save raw parsed JSON
    await supabase.from("parsed_documents").insert({
      contract_id: contract?.id || null,
      storage_path,
      parsed_json: parsedJson,
      parser: "llamaparse"
    });

    // Step 4.5: Extract with OpenAI
    const parsedText = JSON.stringify(parsedJson);
    const systemPrompt = EXTRACTION_PROMPTS[document_type] || EXTRACTION_PROMPTS.contract;
    
    let userPrompt = `Extract structured data from this document:\n\n${parsedText}`;

    // For EDPs, add tasks_map context
    if (document_type === "edp" && contract) {
      const { data: tasks, error: tasksError } = await supabase
        .from("contract_tasks")
        .select("task_number, task_name")
        .eq("contract_id", contract.id)
        .order("task_number");

      if (!tasksError && tasks && tasks.length > 0) {
        const tasksMap: Record<string, string> = {};
        tasks.forEach((t) => {
          tasksMap[t.task_number] = t.task_name;
        });

        userPrompt = `Contract code: ${contract.code}\n\nTasks Map (canonical catalog):\n${JSON.stringify(tasksMap, null, 2)}\n\nDocument content:\n${parsedText}`;
      } else {
        console.log("[process-document] No tasks found for contract, proceeding without tasks_map");
      }
    }

    console.log(`[process-document] Sending to OpenAI for extraction (${document_type})...`);

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

    // Enhanced validation for EDPs
    if (document_type === "edp") {
      const warnings = structured.meta?.warnings || [];
      
      // Validar periodo (CRÍTICO)
      if (!structured.period) {
        warnings.push("CRITICAL: Period not extracted");
        structured.meta = structured.meta || {};
        structured.meta.review_required = true;
      }
      
      // Validar suma de tareas vs total del EDP
      if (structured.tasks_executed && structured.tasks_executed.length > 0) {
        const tasksSum = structured.tasks_executed.reduce(
          (sum: number, t: any) => sum + (parseFloat(t.spent_uf) || 0), 
          0
        );
        const totalUf = parseFloat(structured.amount_uf) || 0;
        const diff = Math.abs(tasksSum - totalUf);
        
        if (diff > totalUf * 0.05) {  // >5% diferencia
          warnings.push(
            `WARNING: Tasks sum (${tasksSum.toFixed(2)} UF) differs from total (${totalUf.toFixed(2)} UF) by ${diff.toFixed(2)} UF. ` +
            `Some tasks may be missing from extraction.`
          );
          structured.meta = structured.meta || {};
          structured.meta.review_required = true;
          structured.meta.missing_amount_uf = diff;
        }
        
        // Validar que Tarea 1.2 existe si hay Tarea 1 o 2
        const hasTask1 = structured.tasks_executed.some((t: any) => t.task_number === '1');
        const hasTask12 = structured.tasks_executed.some((t: any) => t.task_number === '1.2');
        const hasTask2 = structured.tasks_executed.some((t: any) => t.task_number === '2');
        
        if ((hasTask1 || hasTask2) && !hasTask12) {
          warnings.push("WARNING: Task 1.2 (Visita a terreno) not detected - verify manually");
        }
      }
      
      if (warnings.length > 0) {
        structured.meta = structured.meta || {};
        structured.meta.warnings = warnings;
        console.warn(`[process-document] EDP #${structured.edp_number} validation warnings:`, warnings);
      }
    }
    
    // Enhanced validation for CONTRACTS
    if (document_type === "contract") {
      const warnings = structured.meta?.warnings || [];
      
      if (!structured.contract_code) {
        warnings.push("CRITICAL: Contract code not extracted");
        structured.meta = structured.meta || {};
        structured.meta.review_required = true;
      }
      
      if (!structured.client || !structured.contractor) {
        warnings.push("CRITICAL: Parties (client/contractor) not identified");
        structured.meta = structured.meta || {};
        structured.meta.review_required = true;
      }
      
      if (!structured.budget_uf || structured.budget_uf <= 0) {
        warnings.push("CRITICAL: Budget not extracted or invalid");
        structured.meta = structured.meta || {};
        structured.meta.review_required = true;
      }
      
      if (structured.tasks && structured.tasks.length > 0) {
        const tasksSum = structured.tasks.reduce((sum: number, t: any) => sum + (parseFloat(t.budget_uf) || 0), 0);
        const budgetDiff = Math.abs(tasksSum - structured.budget_uf);
        if (budgetDiff > structured.budget_uf * 0.05) {  // >5% difference
          warnings.push(`WARNING: Tasks sum (${tasksSum} UF) differs from total budget (${structured.budget_uf} UF) by ${budgetDiff.toFixed(2)} UF`);
          structured.meta = structured.meta || {};
          structured.meta.review_required = true;
        }
      }
      
      if (warnings.length > 0) {
        structured.meta = structured.meta || {};
        structured.meta.warnings = warnings;
        console.warn(`[process-document] Contract extraction validation warnings:`, warnings);
      }
    }
    
    // Log extraction completion
    console.log(`[process-document] OpenAI extraction complete:`, {
      document_type,
      contract_code: structured.contract_code || structured.contract_id || contract_code || 'N/A',
      edp_number: structured.edp_number || 'N/A',
      fields_extracted: Object.keys(structured).length,
      warnings: structured.meta?.warnings?.length || 0,
      review_required: structured.meta?.review_required || false
    });

    // Step 4.5: For contract documents, get or create the contract
    if (document_type === "contract" && !contract) {
      const extractedCode = structured.contract_code || structured.code || `CONTRACT-${Date.now()}`;
      const extractedTitle = structured.title || structured.name || "Contrato sin título";
      
      console.log(`[process-document] Extracted contract code: ${extractedCode}`);
      
      // First, check if contract already exists
      const { data: existingContract, error: existingError } = await supabase
        .from("contracts")
        .select("id")
        .eq("code", extractedCode)
        .single();
      
      if (existingContract) {
        console.log(`[process-document] Contract already exists: ${extractedCode}, using existing`);
        contract = existingContract;
        
        // Update job with contract_id
        await supabase
          .from("document_processing_jobs")
          .update({ contract_id: contract.id })
          .eq("id", job.id);
      } else {
        // Contract doesn't exist, create it
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
    }

    // Save structured extraction
    if (document_type === "edp") {
      await supabase.from("edp_extracted").insert({
        contract_code: contract_code || structured.contract_code,
        edp_number: structured.edp_number || null,
        structured_json: structured
      });

      console.log(`[process-document] Structured data saved to edp_extracted`);
    }

    console.log(`[process-document] Saving ${document_type} to database for contract ${contract_code || contract?.code || 'N/A'}...`);

    // Save extracted data to documents table
    const { error: docError } = await supabase
      .from("documents")
      .insert({
        contract_id: contract?.id || null,
        doc_type: document_type,
        filename: storage_path.split("/").pop() || "unknown",
        file_url: storage_path,
        processing_status: "completed",
        extracted_data: structured
      });

    if (docError) {
      console.error(`[process-document] Failed to save document:`, docError);
      throw new Error(`Failed to save document: ${docError.message}`);
    }

    // Step 5: Upsert into business tables (document_type specific)
    if (document_type === "edp" && contract && contract.id) {
      // Upsert payment state with period_label
      await supabase.from("payment_states").upsert({
        contract_id: contract.id,
        edp_number: structured.edp_number,
        period_label: structured.period || null,
        period_start: structured.period_start || null,
        period_end: structured.period_end || null,
        amount_uf: structured.amount_uf,
        uf_rate: structured.uf_rate,
        amount_clp: structured.amount_clp,
        status: structured.status || "submitted",
        approval_date: structured.approval_date || null,
        data: structured
      }, { onConflict: "contract_id,edp_number" });

      // Upsert contract_tasks with normalized task_number
      if (structured.tasks_executed && Array.isArray(structured.tasks_executed)) {
        for (const task of structured.tasks_executed) {
          const normalizedNumber = normalizeTaskNumber(task.task_number || '', task.name || '');
          
          if (normalizedNumber) {
            await supabase.from("contract_tasks").upsert({
              contract_id: contract.id,
              task_number: normalizedNumber,
              task_name: task.name,
              budget_uf: task.budget_uf || 0,
              spent_uf: task.spent_uf || 0,
              progress_percentage: task.progress_pct || 0
            }, { onConflict: "contract_id,task_number", ignoreDuplicates: false });
          }
        }
      }

      // Refresh contract metrics
      await supabase.rpc("refresh_contract_metrics", { 
        p_contract_id: contract.id 
      });

      console.log(`[process-document] Payment state and tasks upserted for contract ${contract.code}`);
    }

    // Mark job as completed
    await supabase
      .from("document_processing_jobs")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", job.id);

    console.log(`[process-document] ✅ Successfully processed ${document_type} (job ${job.id}) for contract ${contract_code || contract?.code || 'N/A'}`);

    return new Response(JSON.stringify({
      ok: true,
      job_id: job.id,
      document_type,
      structured_data: structured
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[process-document] Fatal error:", error);

    // Try to update job status
    try {
      const requestBody = await req.json();
      const { storage_path } = requestBody;
      
      if (storage_path) {
        const { data: jobs } = await supabase
          .from("document_processing_jobs")
          .select("id")
          .eq("storage_path", storage_path)
          .eq("status", "processing")
          .limit(1);

        if (jobs && jobs.length > 0) {
          const updateResult = await supabase
            .from("document_processing_jobs")
            .update({ 
              status: "failed", 
              error_message: error instanceof Error ? error.message : String(error),
              updated_at: new Date().toISOString() 
            })
            .eq("storage_path", storage_path)
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
