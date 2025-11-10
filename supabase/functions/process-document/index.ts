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

// MEMORANDUM extraction prompt - specialized for technical progress reports
const MEMORANDUM_EXTRACTION_PROMPT = `You are ContractOS — the MEMORANDUM extractor. 
SCOPE: Apply ONLY when document_type is "memorandum" or "technical_report". Do not modify or redefine rules for other document types (EDP, contract, SDI, etc.).

GOAL
Transform LlamaParse JSON of a memorandum/"Respaldo EdP" into STRICT JSON that feeds the contract's S-Curve and stores key entities. Return ONLY the JSON object in the defined schema.

INPUTS (runtime)
- parsed_json: LlamaParse JSON (text + tables/figures).
- contract_code: string.

OUTPUT SCHEMA (JSON only; no prose)
{
  "document_type": "technical_report",
  "contract_code": "<string>",
  "edp_number": <int|null>,
  "memo_ref": "<string|null>",
  "version": "<string|null>",
  "date_issued": "<YYYY-MM-DD|null>",
  "author": "<string|null>",
  "organization": "<string|null>",
  "period_start": "<YYYY-MM-DD|null>",
  "period_end": "<YYYY-MM-DD|null>",

  "activities_summary": ["<string>", "..."],

  "curve": {
    "unit": "HH" | "UF",
    "dates": ["YYYY-MM-DD", "..."],
    "planned": [<number>, ...],
    "executed": [<number>, ...],
    "source_section": "<string|null>",
    "notes": ["<string>", "..."]
  },

  "financial": {
    "contract_budget_uf": <number|null>,
    "progress_pct": <number|null>,
    "edp_amount_uf": <number|null>,
    "accumulated_total_uf": <number|null>
  },

  "figures": [
    {"label":"<string>", "page": <int>, "kind":"curve|table|image"}
  ],

  "attachments": ["<string>", "..."],

  "meta": {
    "extraction_checks": {
      "equal_lengths": true|false,
      "monotonic_increase": true|false,
      "units_consistent": true|false
    },
    "inferences": ["<string>", "..."],
    "missing": ["<field>", "..."],
    "review_required": true|false
  }
}

RULES
1) S-Curve: find sections named like "Curva S", "Horas acumuladas/ejecutadas", or "Plan vs Real". Prefer the largest table with explicit cumulative values. If per-period increments only, convert to cumulative by summing.
2) Units: if curve is in hours, set unit "HH". If in financial UF, set "UF". Never mix units in the same curve.
3) Dates: emit ISO YYYY-MM-DD. If only week labels exist, infer weekly dates from period_start spaced by 7 days to last reference. Arrays must have equal length.
4) Numbers: normalize locales ("1.234,56" → 1234.56; "16.479.349" → 16479349).
5) Activities: output up to 10 concise bullets of performed work.
6) Validation flags in meta.extraction_checks: 
   - equal_lengths: dates/planned/executed have same length.
   - monotonic_increase: planned/executed are non-decreasing.
   - units_consistent: single unit used across arrays.
7) Safety: If any field is missing, set it to null and list it under meta.missing. If checks fail, set meta.review_required=true. Do not invent values. Return only the JSON object above.

COMMON PATTERNS IN MEMORANDUMS:
- Carátula: contract code, date, author/organization, version (R0/R1/R2), internal reference
- Period covered: "Período: DD/MM/YYYY - DD/MM/YYYY"
- Activities summary: bullet points or paragraphs of work performed (reuniones, recopilación datos, modelación, simulaciones, campañas)
- S-Curve: usually titled "Curva S", "Plan vs Real", "Horas acumuladas", may be table or chart
- Hours or progress table: weekly or monthly breakdown (if incremental, convert to cumulative)
- Link to EDP: "Respaldo EdP N°X", sometimes repeats UF amounts
- Annexes/attachments: list of supporting documents or data sources

EXTRACTION PRIORITY:
1. Contract code (from header/footer)
2. EDP number (if memo accompanies an EDP)
3. Period dates (start/end)
4. S-Curve data (dates, planned, executed) - THIS IS CRITICAL
5. Activities summary
6. Financial references (budget, progress %, accumulated UF)
7. Attachments and figures

VALIDATION (non-blocking):
- If curve.dates.length != curve.planned.length != curve.executed.length → equal_lengths=false, review_required=true
- If planned or executed arrays are decreasing → monotonic_increase=false, review_required=true
- If mixing HH and UF in same curve → units_consistent=false, review_required=true
- If memo declares edp_number, note it for potential cross-validation (optional warning only)
- If accumulated_total_uf or progress_pct present, do NOT override accounting data from EDP - use for context only

Return ONLY the JSON object (no markdown, no \`\`\`json blocks, no explanatory text).`;

// CONTRACT SUMMARY extraction prompt (FASE 2)
const CONTRACT_SUMMARY_EXTRACTION_PROMPT = `You are ContractOS — the CONTRACT SUMMARY extractor for mining service agreements.
Goal: read LlamaParse JSON (contract or addendum) and return STRICT JSON that powers an executive summary ("Ficha contractual") without modifying other extractors.

INPUTS
- parsed_json: LlamaParse JSON (text + tables).
- contract_code: string.
- doc_type: "contract" | "addendum".

OUTPUT — JSON ONLY (no prose)
{
  "contract_code": "<string>",
  "version_tag": "<string|null>",
  "date_issued": "<YYYY-MM-DD|null>",
  "validity_start": "<YYYY-MM-DD|null>",
  "validity_end": "<YYYY-MM-DD|null>",
  "currency": "UF|CLP|USD|null",
  "budget_total": <number|null>,
  "reajustabilidad": "<string|null>",
  "parties": {
    "client": {"name":"<string|null>","rut":"<string|null>"},
    "contractor": {"name":"<string|null>","rut":"<string|null>"},
    "signatories": [{"name":"<string>","role":"<string|null>"}]
  },
  "milestones": [
    { "name":"<string>", "due":"<YYYY-MM-DD|null>", "notes":"<string|null>" }
  ],
  "compliance_requirements": [
    { "type":"plan|report|insurance|guarantee|safety|quality", "name":"<string>", "periodicity":"<string|null>", "deadline_rule":"<string|null>" }
  ],
  "summary_md": "<max 180 words concise Spanish summary in markdown>",
  "provenance": [
    { "clause_ref":"<string|null>", "page": <int|null>, "text_span":"<string|null>" }
  ],
  "meta": {
    "missing": ["<field>", "..."],
    "notes": ["<string>", "..."]
  }
}

RULES
- Use dates in ISO (YYYY-MM-DD). If only month/year exist, set day = 01 and note it in meta.
- Normalize currency amounts (e.g., "4.501 UF" → 4501).
- Prefer explicit clauses for validity, reajustabilidad, guarantees/insurances, and reporting obligations.
- Do NOT hallucinate: if unsure, return null and record the field in meta.missing.
- Return only the JSON object.

CRITICAL: This extractor ONLY processes contract or addendum documents. Do NOT apply to EDP, SDI, memorandum, or plans.`;

// CONTRACT RISKS extraction prompt (FASE 2)
const CONTRACT_RISKS_EXTRACTION_PROMPT = `You are ContractOS — the CONTRACT RISKS & OBLIGATIONS extractor.
Goal: from a contract or addendum (LlamaParse JSON), return STRICT JSON listing actionable risks and obligations with provenance. Do not affect other extractors.

INPUTS
- parsed_json: LlamaParse JSON (text + tables).
- contract_code: string.
- doc_type: "contract" | "addendum".
- version_tag: e.g., "R0", "R1" (optional).

OUTPUT — JSON ONLY (no prose)
{
  "contract_code": "<string>",
  "version_tag": "<string|null>",
  "findings": [
    {
      "risk_type": "penalty|insurance|guarantee|report|deadline|safety|quality|termination|confidentiality|other",
      "title": "<short actionable title in Spanish>",
      "description": "<2-4 sentences, precise and verifiable>",
      "severity": "alta|media|baja",
      "probability": "alta|media|baja|null",
      "obligation": true|false,
      "deadline": "<YYYY-MM-DD|null>",
      "periodicity": "<string|null>",
      "clause_ref": "<string|null>",
      "page": <int|null>,
      "source_doc_type": "<contract|addendum>",
      "source_version": "<string|null>",
      "source_excerpt": "<short exact excerpt or null>"
    }
  ],
  "obligations": [
    {
      "name": "<string>",
      "type": "plan|report|insurance|guarantee|meeting|other",
      "periodicity": "<string|null>",
      "next_due_date": "<YYYY-MM-DD|null>",
      "related_clause_ref": "<string|null>",
      "page": <int|null>
    }
  ],
  "meta": {
    "missing": ["<field>", "..."],
    "notes": ["<string>", "..."]
  }
}

RULES
- Extract penalties (multas), guarantees (garantías), insurances (seguros), reporting obligations (reportes/planes), explicit deadlines, termination clauses, confidentiality, safety/quality compliance.
- If dates depend on relative rules (e.g., "5 días hábiles desde recepción"), do NOT resolve calendar math here — keep rule text in description and leave deadline null unless an absolute date is stated in the document.
- Keep titles short and actionable; severity is your best judgment based on impact described.
- Provide provenance: clause_ref and/or page plus a short excerpt (no more than 240 chars).
- No hallucinations: if unsure, omit or mark fields null and add to meta.missing.
- Return only the JSON object.

CRITICAL: This extractor ONLY processes contract or addendum documents. Do NOT apply to EDP, SDI, memorandum, or plans.`;

// Document type specific prompts
const EXTRACTION_PROMPTS: Record<string, string> = {
  memorandum: MEMORANDUM_EXTRACTION_PROMPT,
  edp: EDP_EXTRACTION_PROMPT,
  contract_summary: CONTRACT_SUMMARY_EXTRACTION_PROMPT,
  contract_risks: CONTRACT_RISKS_EXTRACTION_PROMPT,
  
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

// FASE 3: Extract contract metadata (summary + risks)
async function extractContractMetadata(
  parsedJson: any,
  contractCode: string,
  docType: string
): Promise<{ summary: any; risks: any }> {
  console.log(`[extractContractMetadata] Processing ${docType} for contract: ${contractCode}`);
  
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");
  
  // Extract summary
  const summaryPrompt = EXTRACTION_PROMPTS.contract_summary;
  const summaryPayload = {
    model: "gpt-4o",
    temperature: 0,
    messages: [
      { role: "system", content: summaryPrompt },
      { 
        role: "user", 
        content: JSON.stringify({ 
          parsed_json: parsedJson, 
          contract_code: contractCode, 
          doc_type: docType 
        }) 
      }
    ]
  };
  
  const summaryRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(summaryPayload)
  });
  
  if (!summaryRes.ok) {
    const err = await summaryRes.text();
    throw new Error(`OpenAI summary error: ${err}`);
  }
  
  const summaryData = await summaryRes.json();
  const summaryJson = JSON.parse(summaryData.choices[0].message.content);
  console.log("[extractContractMetadata] Summary extracted successfully");
  
  // Extract risks
  const risksPrompt = EXTRACTION_PROMPTS.contract_risks;
  const risksPayload = {
    model: "gpt-4o",
    temperature: 0,
    messages: [
      { role: "system", content: risksPrompt },
      { 
        role: "user", 
        content: JSON.stringify({ 
          parsed_json: parsedJson, 
          contract_code: contractCode, 
          doc_type: docType,
          version_tag: summaryJson.version_tag || null
        }) 
      }
    ]
  };
  
  const risksRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(risksPayload)
  });
  
  if (!risksRes.ok) {
    const err = await risksRes.text();
    throw new Error(`OpenAI risks error: ${err}`);
  }
  
  const risksData = await risksRes.json();
  const risksJson = JSON.parse(risksData.choices[0].message.content);
  console.log("[extractContractMetadata] Risks extracted successfully");
  
  return { summary: summaryJson, risks: risksJson };
}

// FASE 3: Upsert contract metadata into database
async function upsertContractMetadata(
  supabase: any,
  contractId: string,
  contractCode: string,
  summary: any,
  risks: any
): Promise<void> {
  console.log(`[upsertContractMetadata] Upserting for contract: ${contractCode}`);
  
  // 1. Upsert contract_summaries
  const { error: summaryErr } = await supabase
    .from('contract_summaries')
    .upsert({
      contract_id: contractId,
      contract_code: contractCode,
      version_tag: summary.version_tag,
      date_issued: summary.date_issued,
      validity_start: summary.validity_start,
      validity_end: summary.validity_end,
      currency: summary.currency,
      budget_total: summary.budget_total,
      reajustabilidad: summary.reajustabilidad,
      milestones: summary.milestones,
      compliance_requirements: summary.compliance_requirements,
      parties: summary.parties,
      summary_md: summary.summary_md,
      provenance: summary.provenance,
      raw_json: summary,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'contract_id',
      ignoreDuplicates: false
    });
  
  if (summaryErr) {
    console.error("[upsertContractMetadata] Error upserting summary:", summaryErr);
    throw new Error(`Failed to upsert contract summary: ${summaryErr.message}`);
  }
  
  console.log("[upsertContractMetadata] ✓ Summary upserted");
  
  // 2. Insert contract_risks (findings)
  for (const finding of (risks.findings || [])) {
    // Check for duplicates using title + clause_ref
    const { data: existing } = await supabase
      .from('contract_risks')
      .select('id')
      .eq('contract_code', contractCode)
      .eq('title', finding.title)
      .eq('clause_ref', finding.clause_ref || null)
      .maybeSingle();
    
    if (existing) {
      console.log(`[upsertContractMetadata] Skipping duplicate risk: ${finding.title}`);
      continue;
    }
    
    const { error: riskErr } = await supabase
      .from('contract_risks')
      .insert({
        contract_id: contractId,
        contract_code: contractCode,
        risk_type: finding.risk_type,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        probability: finding.probability,
        obligation: finding.obligation,
        deadline: finding.deadline,
        periodicity: finding.periodicity,
        clause_ref: finding.clause_ref,
        page: finding.page,
        source_doc_type: finding.source_doc_type,
        source_version: risks.version_tag || finding.source_version,
        source_excerpt: finding.source_excerpt
      });
    
    if (riskErr) {
      console.error(`[upsertContractMetadata] Error inserting risk: ${finding.title}`, riskErr);
      // Continue with next risk instead of throwing
    }
  }
  
  console.log(`[upsertContractMetadata] ✓ ${risks.findings?.length || 0} risks inserted`);
  
  // 3. Insert contract_obligations
  for (const obligation of (risks.obligations || [])) {
    const { error: obligationErr } = await supabase
      .from('contract_obligations')
      .insert({
        contract_id: contractId,
        contract_code: contractCode,
        name: obligation.name,
        type: obligation.type,
        periodicity: obligation.periodicity,
        next_due_date: obligation.next_due_date,
        notes: obligation.related_clause_ref ? `Cláusula: ${obligation.related_clause_ref}` : null
      });
    
    if (obligationErr) {
      console.error(`[upsertContractMetadata] Error inserting obligation: ${obligation.name}`, obligationErr);
      // Continue with next obligation
    }
  }
  
  console.log(`[upsertContractMetadata] ✓ ${risks.obligations?.length || 0} obligations inserted`);
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

  // Timeout configuration (2 hours)
  const PROCESSING_TIMEOUT_MS = 2 * 60 * 60 * 1000;
  const jobStartTime = Date.now();

  // Helper to check timeout
  const checkTimeout = () => {
    if (Date.now() - jobStartTime > PROCESSING_TIMEOUT_MS) {
      throw new Error('Processing timeout exceeded (2 hours)');
    }
  };

  try {
    // Parse request body
    const requestBody = await req.json();
    console.log("[process-document] Request body:", JSON.stringify(requestBody, null, 2));

    const { contract_id, contract_code, storage_path, document_type, edp_number } = requestBody;

    if (!storage_path) {
      throw new Error("storage_path is required");
    }

    // FASE 2: Check for duplicate jobs (últimos 15 minutos)
    const { data: existingJobs } = await supabase
      .from('document_processing_jobs')
      .select('id, status')
      .eq('storage_path', storage_path)
      .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .in('status', ['queued', 'processing']);

    if (existingJobs && existingJobs.length > 0) {
      console.log(`[process-document] ⚠️ Job already exists for ${storage_path}, skipping`);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Job already in progress',
          existing_job_id: existingJobs[0].id 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 409 
        }
      );
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

    // Check timeout before LlamaParse
    checkTimeout();

    // Step 4: Parse with LlamaParse
    if (!llamaApiKey) {
      console.warn("[process-document] ❌ LlamaParse API key not found");
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

    // Check timeout before OpenAI
    checkTimeout();

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

    // ===== VALIDACIÓN ESPECÍFICA PARA MEMORANDUMS =====
    if (document_type === "memorandum" && structured.curve) {
      console.log(`[process-document] 🔍 Validating S-Curve data for memorandum`);
      
      const curve = structured.curve;
      const dates = curve.dates || [];
      const planned = curve.planned || [];
      const executed = curve.executed || [];
      
      // Inicializar checks si no existen
      if (!structured.meta) structured.meta = {};
      if (!structured.meta.extraction_checks) {
        structured.meta.extraction_checks = {
          equal_lengths: true,
          monotonic_increase: true,
          units_consistent: true
        };
      }
      
      const checks = structured.meta.extraction_checks;
      const warnings = structured.meta.warnings || [];
      const missing = structured.meta.missing || [];
      
      // CHECK 1: Equal lengths
      if (dates.length !== planned.length || dates.length !== executed.length) {
        checks.equal_lengths = false;
        warnings.push(
          `S-Curve arrays have unequal lengths: dates(${dates.length}), planned(${planned.length}), executed(${executed.length})`
        );
        structured.meta.review_required = true;
      }
      
      // CHECK 2: Monotonic increase (cumulative values)
      const isMonotonic = (arr: number[]) => {
        for (let i = 1; i < arr.length; i++) {
          if (arr[i] < arr[i-1]) return false;
        }
        return true;
      };
      
      if (!isMonotonic(planned) || !isMonotonic(executed)) {
        checks.monotonic_increase = false;
        warnings.push("S-Curve values are not monotonically increasing (should be cumulative)");
        structured.meta.review_required = true;
      }
      
      // CHECK 3: Units consistent
      if (!curve.unit || (curve.unit !== "HH" && curve.unit !== "UF")) {
        checks.units_consistent = false;
        warnings.push(`S-Curve unit is invalid or missing: "${curve.unit}" (expected "HH" or "UF")`);
        structured.meta.review_required = true;
      }
      
      // CHECK 4: Missing critical fields
      if (!structured.period_start) missing.push("period_start");
      if (!structured.period_end) missing.push("period_end");
      if (!structured.contract_code) missing.push("contract_code");
      if (dates.length === 0) missing.push("curve.dates");
      
      if (missing.length > 0) {
        warnings.push(`Missing critical fields: ${missing.join(", ")}`);
        structured.meta.review_required = true;
      }
      
      // Actualizar meta
      structured.meta.warnings = warnings;
      structured.meta.missing = missing;
      structured.meta.extraction_checks = checks;
      
      console.log(`[process-document] Validation results:`, {
        equal_lengths: checks.equal_lengths,
        monotonic_increase: checks.monotonic_increase,
        units_consistent: checks.units_consistent,
        review_required: structured.meta.review_required,
        warnings: warnings.length
      });
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
        console.log(`[process-document] Contract already exists: ${extractedCode}, updating with latest data`);
        
        // ✅ ACTUALIZAR el contrato con los datos más recientes
        const { data: updatedContract, error: updateError } = await supabase
          .from("contracts")
          .update({
            title: extractedTitle,
            metadata: structured,  // Actualizar metadata con datos frescos
            updated_at: new Date().toISOString()
          })
          .eq("id", existingContract.id)
          .select()
          .single();
        
        if (updateError) {
          console.error(`[process-document] Failed to update contract:`, updateError);
          // No lanzar error, continuar con el contrato existente
          contract = existingContract;
        } else {
          console.log(`[process-document] Contract updated successfully: ${extractedCode}`);
          contract = updatedContract;
        }
        
        // Update job with contract_id
        await supabase
          .from("document_processing_jobs")
          .update({ contract_id: contract.id })
          .eq("id", job.id);
        
        // FASE 3: Extract and upsert contract metadata (summary + risks)
        try {
          console.log("[process-document] Extracting contract metadata (summary + risks)...");
          const { summary, risks } = await extractContractMetadata(
            parsedJson,
            extractedCode,
            document_type
          );
          
          await upsertContractMetadata(
            supabase,
            contract.id,
            extractedCode,
            summary,
            risks
          );
          
          console.log("[process-document] ✅ Contract metadata extracted and upserted");
        } catch (metaErr) {
          console.error("[process-document] ⚠️ Error extracting contract metadata:", metaErr);
          // Don't fail the whole job, just log warning
          console.warn("[process-document] Continuing without metadata extraction");
        }
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
        
        // FASE 3: Extract and upsert contract metadata (summary + risks) for new contract
        try {
          console.log("[process-document] Extracting contract metadata (summary + risks)...");
          const { summary, risks } = await extractContractMetadata(
            parsedJson,
            extractedCode,
            document_type
          );
          
          await upsertContractMetadata(
            supabase,
            contract.id,
            extractedCode,
            summary,
            risks
          );
          
          console.log("[process-document] ✅ Contract metadata extracted and upserted");
        } catch (metaErr) {
          console.error("[process-document] ⚠️ Error extracting contract metadata:", metaErr);
          // Don't fail the whole job, just log warning
          console.warn("[process-document] Continuing without metadata extraction");
        }
      }
      
      // FASE 5: Validar que el contrato tenga datos completos
      if (contract) {
        const hasClient = contract.metadata?.client || structured.client;
        const hasContractor = contract.metadata?.contractor || structured.contractor;
        const hasBudget = contract.metadata?.budget_uf || structured.budget_uf;
        
        if (!hasClient || !hasContractor || !hasBudget) {
          console.warn(
            `[process-document] ⚠️ Contract ${contract.code || extractedCode} has incomplete data:`,
            { hasClient: !!hasClient, hasContractor: !!hasContractor, hasBudget: !!hasBudget }
          );
          
          // Marcar en metadata que requiere revisión
          await supabase
            .from("contracts")
            .update({
              metadata: {
                ...(contract.metadata || {}),
                incomplete_data: true,
                missing_fields: [
                  !hasClient && 'client',
                  !hasContractor && 'contractor',
                  !hasBudget && 'budget_uf'
                ].filter(Boolean)
              }
            })
            .eq("id", contract.id);
        }
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

    console.log(`[process-document] ✅ Documento guardado en 'documents'`);

    // ===== GUARDAR EN TECHNICAL_REPORTS SI ES MEMORANDUM =====
    if (document_type === "memorandum" && structured) {
      console.log(`[process-document] 📊 Saving memorandum to technical_reports table`);
      
      let memoData: any = null;
      
      try {
        // PRIORIDAD 1: EDP seleccionado manualmente por el usuario
        let finalEdpNumber = structured.edp_number || null;
        const aiExtractedEdp = structured.edp_number;
        
        if (edp_number && typeof edp_number === 'number') {
          console.log(`[process-document] ✓ Using user-selected EDP: ${edp_number}`);
          finalEdpNumber = edp_number;
          
          // VALIDACIÓN CRUZADA: Si el AI también extrajo un EDP, comparar
          if (aiExtractedEdp && aiExtractedEdp !== edp_number) {
            console.warn(`[process-document] ⚠️ EDP mismatch: user selected ${edp_number}, AI extracted ${aiExtractedEdp}`);
            if (!structured.meta) structured.meta = {};
            if (!structured.meta.warnings) structured.meta.warnings = [];
            structured.meta.warnings.push(
              `Usuario seleccionó EDP #${edp_number}, pero el contenido sugiere EDP #${aiExtractedEdp}. Se usó el seleccionado manualmente.`
            );
            structured.meta.review_required = true;
          }
        } else {
          // PRIORIDAD 2: EDP extraído por el AI del contenido
          if (aiExtractedEdp) {
            console.log(`[process-document] ℹ️ Using AI-extracted EDP: ${aiExtractedEdp}`);
          } else {
            console.warn(`[process-document] ⚠️ No EDP number found (neither manual nor extracted)`);
            if (!structured.meta) structured.meta = {};
            if (!structured.meta.warnings) structured.meta.warnings = [];
            structured.meta.warnings.push('No se pudo identificar el número de EDP ni manualmente ni del contenido');
            structured.meta.review_required = true;
          }
        }
      
        memoData = {
          contract_id: contract?.id || null,
          contract_code: contract_code || structured.contract_code || null,
          edp_number: finalEdpNumber,
          memo_ref: structured.memo_ref || null,
          version: structured.version || null,
          date_issued: structured.date_issued || null,
          author: structured.author || null,
          organization: structured.organization || null,
          period_start: structured.period_start || null,
          period_end: structured.period_end || null,
          activities_summary: structured.activities_summary || [],
          curve: structured.curve || {},
          financial: structured.financial || {},
          figures: structured.figures || [],
          attachments: structured.attachments || [],
          extraction_meta: structured.meta || {},
          parsed_json: structured
        };
        
        // FASE 3: Validación pre-guardado
        if (!memoData.contract_code) {
          console.warn(`[process-document] ⚠️ Memorandum missing contract_code, cannot save to technical_reports`);
          throw new Error("Memorandum extraction failed: contract_code is required");
        }

        // Si tiene edp_number pero no version, asignar "R0" por defecto
        if (memoData.edp_number && !memoData.version) {
          console.log(`[process-document] ℹ️ Memorandum has edp_number but no version, defaulting to R0`);
          memoData.version = "R0";
        }

        console.log(`[process-document] 📊 Memo data prepared:`, {
          contract_code: memoData.contract_code,
          edp_number: memoData.edp_number,
          source: edp_number ? 'user_selected' : 'ai_extracted',
          version: memoData.version,
          has_curve: !!memoData.curve?.dates,
          curve_unit: memoData.curve?.unit
        });
        
        // FASE 1: Lógica manual de INSERT/UPDATE para manejar NULL correctamente
        // Si tiene edp_number, version y contract_code, buscar duplicado manualmente
        let existingMemo = null;
        if (memoData.contract_code && memoData.edp_number && memoData.version) {
          const { data } = await supabase
            .from("technical_reports")
            .select("id")
            .eq("contract_code", memoData.contract_code)
            .eq("edp_number", memoData.edp_number)
            .eq("version", memoData.version)
            .maybeSingle();
          
          existingMemo = data;
        }

        let savedMemo, memoError;

        if (existingMemo) {
          // UPDATE del registro existente
          console.log(`[process-document] 🔄 Updating existing memorandum: ${existingMemo.id}`);
          const { data, error } = await supabase
            .from("technical_reports")
            .update(memoData)
            .eq("id", existingMemo.id)
            .select()
            .single();
          
          savedMemo = data;
          memoError = error;
        } else {
          // INSERT nuevo registro
          console.log(`[process-document] ➕ Inserting new memorandum`);
          const { data, error } = await supabase
            .from("technical_reports")
            .insert(memoData)
            .select()
            .single();
          
          savedMemo = data;
          memoError = error;
        }
        
        if (memoError) {
          console.error(`[process-document] ❌ Failed to save to technical_reports:`, memoError);
        } else {
          console.log(`[process-document] ✅ Saved to technical_reports: ${savedMemo.id}`);
          
          // Validar curva S si existe
          if (savedMemo.curve && savedMemo.curve.dates) {
            const curveChecks = savedMemo.extraction_meta?.extraction_checks || {};
            
            if (!curveChecks.equal_lengths) {
              console.warn(`[process-document] ⚠️ S-Curve arrays have unequal lengths`);
            }
            
            if (!curveChecks.monotonic_increase) {
              console.warn(`[process-document] ⚠️ S-Curve values are not monotonically increasing`);
            }
            
            if (!curveChecks.units_consistent) {
              console.warn(`[process-document] ⚠️ S-Curve units are inconsistent`);
            }
            
            if (savedMemo.extraction_meta?.review_required) {
              console.warn(`[process-document] ⚠️ Memorandum requires manual review due to extraction issues`);
            }
          }
        }
      } catch (memoSaveError: any) {
        // FASE 4: Logging mejorado
        console.error(`[process-document] ❌ Exception saving memorandum:`, {
          error: memoSaveError.message,
          stack: memoSaveError.stack,
          memoData: {
            contract_code: memoData?.contract_code,
            edp_number: memoData?.edp_number,
            version: memoData?.version
          }
        });
        
        // NO re-lanzar el error, solo loggearlo
        // El documento ya se guardó en 'documents', esto es solo metadata adicional
      }
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

      // ✅ Validar task_numbers conocidos del contrato
      const validTaskNumbers = new Set(['1', '1.2', '2', '3', '4', '5', '6', '7', '8', '9']);
      const unknownTasks: string[] = [];

      for (const task of structured.tasks_executed || []) {
        const normalizedNum = normalizeTaskNumber(task.task_number || '', task.name || '');
        if (normalizedNum && !validTaskNumbers.has(normalizedNum)) {
          unknownTasks.push(`${task.task_number} (${task.name})`);
        }
      }

      if (unknownTasks.length > 0) {
        console.warn(
          `[process-document] ⚠️ EDP #${structured.edp_number} contains ${unknownTasks.length} unknown task(s): ` +
          unknownTasks.join(', ')
        );
      }

      // ✅ FASE 2: Recalcular contract_tasks desde TODOS los EDPs
      console.log(`[process-document] Recalculating contract_tasks from ALL EDPs for contract ${contract.id}...`);
      
      // 1. Obtener TODOS los EDPs del contrato (approved + submitted)
      const { data: allEdps, error: edpsFetchError } = await supabase
        .from("payment_states")
        .select("data")
        .eq("contract_id", contract.id)
        .in("status", ["approved", "submitted"]);
      
      if (edpsFetchError) {
        console.error(`[process-document] Error fetching EDPs for accumulation:`, edpsFetchError);
        throw new Error(`Failed to fetch EDPs: ${edpsFetchError.message}`);
      }
      
      // 2. Acumular spent_uf por tarea desde todos los EDPs
      const taskAccumulator: Record<string, { 
        spent_uf: number; 
        budget_uf: number; 
        name: string 
      }> = {};
      
      for (const edp of allEdps || []) {
        const tasks = (edp.data as any)?.tasks_executed || [];
        for (const task of tasks) {
          const taskNum = normalizeTaskNumber(task.task_number || '', task.name || '');
          
          if (!taskNum) continue;
          
          if (!taskAccumulator[taskNum]) {
            taskAccumulator[taskNum] = {
              spent_uf: 0,
              budget_uf: parseFloat(task.budget_uf) || 0,
              name: task.name || ''
            };
          }
          taskAccumulator[taskNum].spent_uf += parseFloat(task.spent_uf) || 0;
        }
      }
      
      // 3. Actualizar contract_tasks con totales acumulados
      // El trigger automáticamente calculará progress_percentage
      for (const [taskNumber, totals] of Object.entries(taskAccumulator)) {
        const { error: taskError } = await supabase
          .from("contract_tasks")
          .upsert({
            contract_id: contract.id,
            task_number: taskNumber,
            task_name: totals.name,
            budget_uf: totals.budget_uf,
            spent_uf: totals.spent_uf,
            // progress_percentage se calcula automáticamente por el trigger
          }, {
            onConflict: "contract_id,task_number",
            ignoreDuplicates: false
          });
        
        if (taskError) {
          console.error(`[process-document] Error upserting task ${taskNumber}:`, taskError);
          
          // ✅ Lanzar error crítico para constraints
          if (taskError.code === '23514' || taskError.code === '23505') {
            throw new Error(
              `Failed to upsert task ${taskNumber}: ${taskError.message}. ` +
              `This indicates a database constraint violation.`
            );
          }
        }
      }
      
      console.log(`[process-document] Successfully recalculated ${Object.keys(taskAccumulator).length} tasks from ${allEdps?.length || 0} EDPs`);

      // Check timeout before final operations
      checkTimeout();

      // Refresh contract metrics with enhanced error handling
      console.log(`[process-document] 🔄 Refreshing contract metrics for ${contract.code}...`);
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc("refresh_contract_metrics", { 
        contract_code: contract.code
      });

      if (rpcError) {
        console.error(`[process-document] ❌ Error refreshing metrics:`, rpcError);
        throw new Error(`Failed to refresh contract metrics: ${rpcError.message}`);
      }

      console.log(`[process-document] ✅ Metrics refreshed successfully`);
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

  } catch (error: any) {
    // FASE 2: Enhanced error classification
    let errorType = 'unknown';
    let errorDetails = error?.message || String(error);
    
    // Clasificar tipos de error
    if (errorDetails.includes('LLAMAPARSE_API_KEY')) {
      errorType = 'missing_api_key_llamaparse';
      errorDetails = 'LlamaParse API key not configured';
    } else if (errorDetails.includes('OPENAI_API_KEY')) {
      errorType = 'missing_api_key_openai';
      errorDetails = 'OpenAI API key not configured';
    } else if (error?.status === 400) {
      errorType = 'bad_request_ai';
      errorDetails = 'AI extraction failed: Invalid request format or content';
    } else if (error?.status === 429) {
      errorType = 'rate_limit';
      errorDetails = 'Rate limit exceeded, retry in 60s';
    } else if (errorDetails.includes('timeout')) {
      errorType = 'timeout';
      errorDetails = 'Processing timeout exceeded (2 hours)';
    } else if (errorDetails.includes('Job already in progress')) {
      errorType = 'duplicate_job';
    } else if (errorDetails.includes('Contract not found')) {
      errorType = 'contract_not_found';
    }
    
    console.error(`[process-document] ❌ Error [${errorType}]:`, errorDetails);

    // Try to update job status with error type
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
          await supabase
            .from("document_processing_jobs")
            .update({ 
              status: "failed", 
              error: JSON.stringify({ type: errorType, details: errorDetails }),
              updated_at: new Date().toISOString() 
            })
            .eq("storage_path", storage_path)
            .eq("status", "processing");

          console.log(`[process-document] Job status updated to failed (${errorType})`);
        }
      }
    } catch (updateError) {
      console.error("[process-document] Failed to update job status:", updateError);
    }

    return new Response(JSON.stringify({
      ok: false,
      error: errorDetails,
      error_type: errorType
    }), {
      status: errorType === 'duplicate_job' ? 409 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
