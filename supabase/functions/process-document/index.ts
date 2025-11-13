import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zod schemas for executive summary validation
const SummaryCardFieldSchema = z.record(z.any());

const SummaryCardSchema = z.object({
  category: z.enum([
    "General",
    "Legal y Administrativa", 
    "Alcance Técnico",
    "Equipo y Experiencia",
    "Seguridad y Calidad",
    "Programa y Avance"
  ]),
  title: z.string().min(1),
  fields: SummaryCardFieldSchema
});

const ProvenanceSchema = z.object({
  contract_file: z.string().optional(),
  annexes: z.array(z.string()).optional()
});

const MetaSchema = z.object({
  confidence: z.number().min(0).max(1).optional(),
  source_pages: z.array(z.number()).optional(),
  last_updated: z.string().optional()
});

const ContractExecutiveSummarySchema = z.object({
  contract_code: z.string().min(1),
  summary_version: z.string().default("v1.0"),
  cards: z.array(SummaryCardSchema).min(1).max(6),
  provenance: ProvenanceSchema,
  meta: MetaSchema
});

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

// CONTRACT EXECUTIVE SUMMARY extraction prompt - Generates dashboard cards
const CONTRACT_EXECUTIVE_SUMMARY_PROMPT = `Eres un asistente experto en administración de contratos mineros, especializado en interpretación documental técnica, legal y económica. 
Analizas contratos, anexos técnicos, planes y propuestas para construir un **gemelo digital del contrato**, estructurado en información crítica, indicadores y responsables.

Tu misión:
1. **Extraer entidades y hechos clave** del contrato y sus anexos.
2. **Consolidar y complementar** la información existente en Supabase sin sobrescribir campos previos.
3. **Generar un resumen ejecutivo estructurado** en formato JSON, con tarjetas (cards) temáticas, listo para renderizar en el dashboard del contrato.
4. **Guardar los datos procesados** en la tabla contract_summaries y actualizar las tablas relacionadas.
5. **Reconocer documentos relacionados** (Contrato, Anexos, Plan SSO, Plan Calidad, Propuesta Técnica) y extraer información incremental para cada card.

REGLAS DE EXTRACCIÓN POR TIPO DE DOCUMENTO:

**CONTRATO PROFORMA:**
- Extrae: General (datos básicos del contrato), Legal y Administrativa (administradores, leyes), Programa y Avance (fechas, duración)

**ANEXOS TÉCNICOS / PROPUESTA TÉCNICA:**
- Extrae: Alcance Técnico (tareas, documentos de referencia), Equipo y Experiencia (personal clave, empresa, experiencia)

**PLAN SSO:**
- Extrae: Seguridad y Calidad → plan_sso (nombre del archivo), normas_aplicadas (normas de seguridad mencionadas)

**PLAN DE CALIDAD:**
- Extrae: Seguridad y Calidad → plan_calidad (nombre del archivo), normas_aplicadas (normas ISO, certificaciones)

ESQUEMA DE SALIDA JSON:

{
  "contract_code": "<extraer del documento o usar el proporcionado>",
  "summary_version": "v1.0",
  "cards": [
    {
      "category": "General|Legal y Administrativa|Alcance Técnico|Equipo y Experiencia|Seguridad y Calidad|Programa y Avance",
      "title": "<título descriptivo>",
      "fields": {
        "<key>": "<value>",
        // Usar nombres de campos en español, snake_case
        // Ejemplos: contrato, mandante, fecha_firma, valor_total_uf, administrador_mandante, etc.
      }
    }
  ],
  "provenance": {
    "contract_file": "<filename si es contrato principal>",
    "annexes": ["<array de filenames de anexos/planes procesados>"]
  },
  "meta": {
    "confidence": <0.0-1.0>,  // Calidad de la extracción
    "source_pages": [<páginas procesadas>],
    "last_updated": "<timestamp>"
  }
}

REGLAS DE CALIDAD:

1. **Nombres de campos consistentes:**
   - Usar siempre los mismos nombres (contrato, mandante, contratista, valor_total_uf, etc.)
   - Formato: snake_case en español

2. **Valores estructurados:**
   - Arrays para listas (tareas, equipo, experiencia_clave, leyes_aplicables)
   - Objetos para entidades complejas (miembros del equipo con {nombre, cargo})
   - Números sin separadores de miles (4501, no "4.501")
   - Fechas en formato ISO cuando sea posible, o formato legible ("28-07-2025 al 29-12-2025")

3. **Completitud incremental:**
   - NUNCA sobrescribir campos existentes
   - Solo agregar nuevos campos o complementar arrays
   - Si un campo ya tiene valor en DB, NO lo reemplaces a menos que el nuevo documento sea más autoritativo

4. **Confianza (confidence):**
   - 0.95-1.0: Información extraída directamente del documento sin ambigüedad
   - 0.80-0.94: Información inferida con alta certeza
   - 0.60-0.79: Información parcial o con ambigüedades menores
   - <0.60: Información faltante o muy ambigua (requiere revisión manual)

5. **Provenance tracking:**
   - Siempre registra el filename en contract_file o annexes según corresponda
   - Registra las páginas de donde se extrajo información crítica

VALIDACIÓN FINAL:
- Mínimo 1 card, máximo 6 cards
- Cada card debe tener al menos 1 field
- contract_code es OBLIGATORIO
- Si no puedes extraer contract_code del documento, usa el que te proporcionan como contexto

Return ONLY the JSON object (no markdown, no prose, no \`\`\`json blocks).`;

// CONTRACT SUMMARY extraction prompt - OPTIMIZED for Chilean mining contracts
const CONTRACT_SUMMARY_EXTRACTION_PROMPT = `You are ContractOS — CONTRACT SUMMARY extractor for Chilean mining service agreements.

DOCUMENT STRUCTURE (Chilean contracts):
- Numbered clauses: "PRIMERO:", "SEGUNDO:", "TERCERO:", "CUARTO:", "QUINTO:", etc.
- Standard sections:
  * COMPARECENCIA: parties (client, contractor)
  * PRIMERO: contract object/scope
  * SEGUNDO: deliverables and budget
  * TERCERO: validity period
  * CUARTO: execution timeline
  * QUINTO: price and payment terms
  * SEXTO: legal compliance (Ley 20.393, Ley 21.643, etc.)
  * SÉPTIMO-DÉCIMO: various obligations, warranties, special clauses
- Tables: "Partidas" table with columns: ITEM, Partida, Unidad, Precio Total (UF)

CRITICAL PATTERNS:

VIGENCIA (CLAUSE TERCERO):
- Pattern: "El plazo de vigencia del Contrato se extenderá entre el DD-MM-YYYY y el DD-MM-YYYY"
- Complex dates: "entre el 28-07-2025 y el 29-12-2025 más 20 días corridos"
  → validity_start: 2025-07-28, validity_end: calculate 2025-12-29 + 20 days = 2026-01-18
- If "más X días" appears, ADD those days to end date and note in meta

PRESUPUESTO (CLAUSE SEGUNDO or QUINTO):
- Pattern: "El precio de este Contrato es de X UF" or "Presupuesto Total: X UF"
- Format: "4.501 UF" → 4501 (remove dots, no decimals in UF)
- Validate against PARTIDAS table sum

REAJUSTABILIDAD (CLAUSE QUINTO):
- Pattern: "El contrato no contempla reajustes" → "Sin reajuste"
- Pattern: "reajuste según IPC" → "IPC"
- Pattern: "reajuste según UF" → "UF indexada"
- Pattern: "reajuste según dólar" → "Dólar"

PARTES (COMPARECENCIA):
- Client pattern: "de una parte, [NAME], RUT [RUT], representada por [PERSON]"
- Contractor pattern: "de la otra parte, [NAME], RUT [RUT], representado por [PERSON]"
- Extract full names: "ANDES IRON SpA", "ITASCA CHILE SPA"
- Extract RUTs: "76.097.570-4", "96.684.920-7"

PARTIDAS TABLE (usually in CLAUSE SEGUNDO):
- Structure: | ITEM | Partida | Unidad | Cantidad | ... | Precio Total (UF) |
- Example: "1.1 | Recopilación y análisis de información | GL | ... | 507"
- Each row is a milestone
- Task numbers: preserve "1.1", "1.2", etc. (never "11", "12")
- Sum amounts and validate against budget_total

COMPLIANCE (CLAUSE SEXTO typically):
- "Ley N°20.393" → {type: "safety", name: "Modelo de Prevención de Delitos", periodicity: "continuo"}
- "Ley N°21.643" or "Ley Karin" → {type: "safety", name: "Protocolo Ley Karin", periodicity: "continuo"}
- "Plan de SSO" → {type: "plan", name: "Plan de Seguridad y Salud Ocupacional", periodicity: "inicial", deadline_rule: "Antes del inicio"}
- "Plan de Calidad" → {type: "plan", name: "Plan de Aseguramiento de Calidad", periodicity: "inicial"}

OUTPUT SCHEMA:
{
  "contract_code": "<string>",
  "version_tag": "<R0|R1|null>",
  "date_issued": "<YYYY-MM-DD|null>",
  "validity_start": "<YYYY-MM-DD|null>",
  "validity_end": "<YYYY-MM-DD|null>",
  "currency": "UF|CLP|USD",
  "budget_total": <number>,
  "reajustabilidad": "<string>",
  "parties": {
    "client": {"name":"<string>","rut":"<string|null>"},
    "contractor": {"name":"<string>","rut":"<string|null>"},
    "signatories": [{"name":"<string>","role":"<string>"}]
  },
  "milestones": [
    { "name":"<string>", "budget_uf": <number>, "notes":"<from partidas table>" }
  ],
  "compliance_requirements": [
    { "type":"plan|report|insurance|guarantee|safety|quality", "name":"<string>", "periodicity":"<continuo|inicial|mensual|trimestral|null>", "deadline_rule":"<string|null>" }
  ],
  "summary_md": "<max 180 words executive summary in Spanish>",
  "provenance": [
    { "clause_ref":"<PRIMERO|SEGUNDO|etc>", "page": <int>, "text_span":"<excerpt max 200 chars>" }
  ],
  "meta": {
    "date_calculations": ["<if complex dates, show math>"],
    "budget_validation": "<sum of milestones vs budget_total>",
    "missing": ["<field>"],
    "warnings": ["<string>"],
    "review_required": <boolean>
  }
}

VALIDATION:
1. If validity_end calculation required (e.g., "+ 20 días"), show in meta.date_calculations
2. Sum milestones[].budget_uf and compare with budget_total. If diff >1%, warn in meta
3. If parties.client or parties.contractor missing → meta.review_required = true
4. If budget_total missing or 0 → meta.review_required = true

Return ONLY valid JSON (no markdown, no prose).`;

// CONTRACT RISKS extraction prompt - OPTIMIZED for Chilean mining contracts
const CONTRACT_RISKS_EXTRACTION_PROMPT = `You are ContractOS — CONTRACT RISKS & OBLIGATIONS extractor for Chilean mining contracts.

RISK PATTERNS (Chilean contracts):

PATRÓN 1: TÉRMINO ANTICIPADO (Clause DÉCIMO typically)
- Keywords: "poner término anticipado", "sin expresión de causa", "sola opción y conveniencia"
- Example: "AI tendrá el derecho de poner término anticipado al Contrato sin expresión de causa a su sola opción y conveniencia"
- Output:
  {
    "risk_type": "termination",
    "title": "Término anticipado sin causa por el cliente",
    "description": "El cliente puede terminar el contrato en cualquier momento sin necesidad de justificación ni indemnización. Riesgo financiero alto para el contratista.",
    "severity": "alta",
    "probability": "media",
    "obligation": false,
    "clause_ref": "DÉCIMO",
    "source_excerpt": "tendrá el derecho de poner término anticipado sin expresión de causa"
  }

PATRÓN 2: EXCESO SOBRE PRESUPUESTO (Clause QUINTO typically)
- Keywords: "exceso sobre el valor máximo", "exclusiva responsabilidad", "total costo"
- Example: "Cualquier exceso sobre el valor máximo no garantizado será de su exclusiva responsabilidad y a su total costo"
- Output:
  {
    "risk_type": "penalty",
    "title": "Responsabilidad financiera por excesos de presupuesto",
    "description": "Cualquier gasto que exceda el presupuesto acordado será asumido completamente por el contratista sin posibilidad de cobro adicional.",
    "severity": "media",
    "probability": "media",
    "obligation": false,
    "clause_ref": "QUINTO"
  }

PATRÓN 3: LEY 20.393 - PREVENCIÓN DE DELITOS (Clause SEXTO typically)
- Keywords: "Ley N°20.393", "Modelo de Prevención de Delitos", "responsabilidad penal"
- Output:
  {
    "risk_type": "safety",
    "title": "Cumplimiento Ley 20.393 - Modelo de Prevención de Delitos",
    "description": "Obligación legal de mantener implementado y actualizado un Modelo de Prevención de Delitos según Ley 20.393. Incumplimiento puede resultar en responsabilidad penal.",
    "severity": "alta",
    "probability": null,
    "obligation": true,
    "periodicity": "continuo",
    "clause_ref": "SEXTO"
  }

PATRÓN 4: LEY 21.643 - LEY KARIN (Clause SEXTO typically)
- Keywords: "Ley N°21.643", "Ley Karin", "acoso sexual", "violencia", "protocolos"
- Output:
  {
    "risk_type": "safety",
    "title": "Cumplimiento Ley 21.643 (Ley Karin) - Protocolo contra acoso",
    "description": "Obligación de implementar protocolos de prevención contra acoso sexual, laboral y violencia en el trabajo según Ley Karin.",
    "severity": "alta",
    "probability": null,
    "obligation": true,
    "periodicity": "continuo",
    "clause_ref": "SEXTO"
  }

PATRÓN 5: REPORTE DE DENUNCIAS (Clause SEXTO typically)
- Keywords: "mantener informado", "denuncia", "investigación", "cualquier proceso"
- Example: "mantener informado a AI a demanda sobre cualquier denuncia que se encuentre bajo investigación"
- Output:
  {
    "risk_type": "report",
    "title": "Obligación de reporte de denuncias bajo investigación",
    "description": "Deber de informar al cliente inmediatamente y a demanda sobre cualquier denuncia o proceso de investigación relacionado con las leyes 20.393 o 21.643.",
    "severity": "media",
    "probability": null,
    "obligation": true,
    "periodicity": "a demanda",
    "clause_ref": "SEXTO"
  }

PATRÓN 6: IMPUESTOS A CARGO DEL CONTRATISTA (Clause OCTAVO typically)
- Keywords: "impuestos", "excepto el IVA", "exclusivo cargo del CONTRATISTA"
- Output:
  {
    "risk_type": "other",
    "title": "Responsabilidad tributaria - Todos los impuestos excepto IVA",
    "description": "Todos los impuestos generados por la prestación de servicios son de cargo exclusivo del contratista, salvo el IVA que es de cargo del cliente.",
    "severity": "baja",
    "probability": null,
    "obligation": true,
    "clause_ref": "OCTAVO"
  }

PATRÓN 7: PLANES OBLIGATORIOS (Clause SEXTO typically)
- Keywords: "Plan de SSO", "Plan de Calidad", "Plan de Prevención"
- Output OBLIGATIONS:
  {
    "name": "Presentar Plan de SSO",
    "type": "plan",
    "periodicity": "inicial",
    "next_due_date": "<contract start_date or null>",
    "related_clause_ref": "SEXTO"
  }

PATRÓN 8: REVISIÓN POR EXPERTOS (Clause SEXTO)
- Keywords: "revisión por terceros expertos", "auditoría externa", "verificación independiente"
- Output:
  {
    "risk_type": "quality",
    "title": "Auditoría externa posible para verificación de cumplimiento",
    "description": "El cliente se reserva el derecho de solicitar revisión por terceros expertos independientes para verificar el cumplimiento de obligaciones legales y contractuales.",
    "severity": "media",
    "probability": "baja",
    "obligation": false,
    "clause_ref": "SEXTO"
  }

RIESGOS IMPLÍCITOS (detect from context):
- If "plazo de ejecución" defined but NO explicit penalties for delays:
  → Finding: "Sin multas explícitas por retraso, pero término anticipado es posible" (severity: media)
- If budget is "valor máximo no garantizado" (non-guaranteed maximum):
  → Finding already covered by PATRÓN 2

OUTPUT SCHEMA:
{
  "contract_code": "<string>",
  "version_tag": "<string|null>",
  "findings": [
    {
      "risk_type": "penalty|insurance|guarantee|report|deadline|safety|quality|termination|confidentiality|other",
      "title": "<actionable title 5-10 words Spanish>",
      "description": "<2-4 sentences, concrete impact>",
      "severity": "alta|media|baja",
      "probability": "alta|media|baja|null",
      "obligation": true|false,
      "deadline": "<YYYY-MM-DD|null>",
      "periodicity": "<continuo|inicial|mensual|a demanda|null>",
      "clause_ref": "<PRIMERO|SEGUNDO|etc>",
      "page": <int|null>,
      "source_doc_type": "contract|addendum",
      "source_version": "<string|null>",
      "source_excerpt": "<excerpt max 240 chars>"
    }
  ],
  "obligations": [
    {
      "name": "<string>",
      "type": "plan|report|insurance|guarantee|meeting|other",
      "periodicity": "<continuo|inicial|mensual|trimestral|a demanda|null>",
      "next_due_date": "<YYYY-MM-DD|null>",
      "related_clause_ref": "<string|null>",
      "page": <int|null>
    }
  ],
  "meta": {
    "patterns_detected": ["<PATRÓN X>"],
    "implicit_risks": ["<string>"],
    "missing": ["<field>"],
    "review_required": <boolean>
  }
}

EXTRACTION PRIORITY:
1. Termination clauses (highest severity)
2. Legal compliance (Ley 20.393, Ley 21.643)
3. Financial risks (budget overruns, penalties)
4. Reporting obligations
5. Plans and deliverables (SSO, Quality)
6. Insurance/guarantees
7. Tax responsibilities
8. Other obligations

VALIDATION:
- If NO termination clause found → meta.review_required = true, meta.missing = ["termination_clause"]
- If NO legal compliance (20.393 or 21.643) found → warn in meta.notes
- findings.length should be >= 4 for typical Chilean mining contracts
- obligations.length should be >= 2 (at minimum SSO plan + legal compliance)

Return ONLY valid JSON (no markdown, no prose).`;

// Executive summary prompt for dashboard cards
const PROMPT_CONTRACT_EXEC_SUMMARY = `
You are ContractOS — the CONTRACT executive-summary extractor.
Goal: read LlamaParse JSON of a mining services contract and return STRICT JSON with the key executive data to render cards on the dashboard. Do not affect other extractors.

INPUTS (runtime)
- parsed_json: LlamaParse JSON (text+tables)
- contract_code: string

OUTPUT — JSON ONLY (no prose)
{
  "contract_code": "<string>",
  "title": "<string|null>",
  "dates": {
    "signed_at": "<YYYY-MM-DD|null>",
    "valid_from": "<YYYY-MM-DD|null>",
    "valid_to": "<YYYY-MM-DD|null>",
    "grace_days": <int|null>
  },
  "parties": {
    "client": { "name":"<string|null>", "rut":"<string|null>", "rep":"<string|null>", "email":"<string|null>" },
    "contractor": { "name":"<string|null>", "rut":"<string|null>", "rep":"<string|null>", "email":"<string|null>" }
  },
  "commercials": {
    "currency": "UF|CLP|USD|null",
    "budget_total": <number|null>,
    "price_model": "<string|null>",
    "reajustabilidad": "<string|null>",
    "tax_notes": "<string|null>"
  },
  "scope": {
    "objective": "<string|null>",
    "documents_order": ["<string>", "..."]
  },
  "value_items": [
    { "item":"<string>", "unit":"<string|null>", "unit_price": <number|null>, "notes":"<string|null>" }
  ],
  "admins": {
    "client_admin": { "name":"<string|null>", "email":"<string|null>" },
    "contractor_admin": { "name":"<string|null>", "email":"<string|null>" }
  },
  "legal": {
    "termination": "<string|null>",
    "jurisdiction": "<string|null>",
    "laws": ["<string>", "..."],
    "compliance": ["<string>", "..."]
  },
  "provenance": [
    { "field":"<path>", "page": <int|null>, "clause_ref":"<string|null>", "excerpt":"<<=240 chars|null>" }
  ],
  "meta": { "missing": ["<field>", "..."], "notes": ["<string>", "..."] }
}

RULES
- Normalize numbers ("4.501 UF" → 4501). Use ISO dates (YYYY-MM-DD).
- If multiple totals appear, choose the formal adjudicated total (not optional scopes).
- Keep "objective" concise (≤ 300 chars). Prefer explicit "Objeto/Alcance".
- "documents_order" only if an order of precedence list appears.
- "value_items" only if there is a price/partidas table; otherwise empty.
- No hallucinations: unknown → null and add to meta.missing.
- Return only the JSON object.
`;

// Document type specific prompts
const EXTRACTION_PROMPTS: Record<string, string> = {
  memorandum: MEMORANDUM_EXTRACTION_PROMPT,
  edp: EDP_EXTRACTION_PROMPT,
  contract_summary: CONTRACT_SUMMARY_EXTRACTION_PROMPT,
  contract_risks: CONTRACT_RISKS_EXTRACTION_PROMPT,
  contract_exec_summary: PROMPT_CONTRACT_EXEC_SUMMARY,
  contract_executive_summary: CONTRACT_EXECUTIVE_SUMMARY_PROMPT,  // NEW: For dashboard cards
  
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

// Helper: OpenAI call with retry logic and exponential backoff
async function callOpenAIWithRetry(
  payload: any,
  apiKey: string,
  maxRetries: number = 3
): Promise<any> {
  const url = "https://api.openai.com/v1/chat/completions";
  let attempt = 0;
  let lastError: any;
  
  while (attempt < maxRetries) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const data = await res.json();
        return data;
      }
      
      // Si es rate limit (429), hacer retry con backoff
      if (res.status === 429) {
        const errorData = await res.json();
        const retryAfter = errorData.error?.message?.match(/try again in ([\d.]+)s/)?.[1];
        const waitTime = retryAfter ? parseFloat(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
        
        console.warn(`[OpenAI] Rate limit hit, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime + 200)); // +200ms buffer
        attempt++;
        continue;
      }
      
      // Otro error, lanzar excepción
      const err = await res.text();
      throw new Error(`OpenAI error (${res.status}): ${err}`);
      
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries - 1) break;
      
      // Exponential backoff: 1s, 2s, 4s
      const waitTime = Math.pow(2, attempt) * 1000;
      console.warn(`[OpenAI] Attempt ${attempt + 1} failed, retrying in ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      attempt++;
    }
  }
  
  throw new Error(`OpenAI call failed after ${maxRetries} attempts: ${lastError?.message || lastError}`);
}

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

// ========================================
// SPRINT 2: 4 SPECIALIZED EXTRACTION FUNCTIONS WITH GPT-4O
// ========================================

// Validation function with completeness score
function validateExtractedData(summary: any, risks: any, obligations: any[], executive: any): {
  isValid: boolean;
  completeness: number;
  warnings: string[];
  critical_missing: string[];
} {
  const warnings: string[] = [];
  const critical_missing: string[] = [];
  let totalFields = 0;
  let populatedFields = 0;

  // Validate summary (weight: 40%)
  const summaryFields = ['contract_code', 'validity_start', 'validity_end', 'budget_total', 'parties', 'currency'];
  summaryFields.forEach(field => {
    totalFields++;
    if (summary && summary[field] !== null && summary[field] !== undefined) {
      populatedFields++;
    } else {
      critical_missing.push(`summary.${field}`);
    }
  });

  // Validate risks (weight: 20%)
  totalFields += 5;
  if (risks?.findings && risks.findings.length >= 3) {
    populatedFields += 3;
  } else {
    warnings.push(`Expected at least 3 risks, found ${risks?.findings?.length || 0}`);
  }
  if (risks?.findings && risks.findings.length >= 5) {
    populatedFields += 2;
  }

  // Validate obligations (weight: 20%)
  totalFields += 5;
  if (obligations && obligations.length >= 2) {
    populatedFields += 3;
  } else {
    warnings.push(`Expected at least 2 obligations, found ${obligations?.length || 0}`);
  }
  if (obligations && obligations.length >= 4) {
    populatedFields += 2;
  }

  // Validate executive summary (weight: 20%)
  const execFields = ['title', 'dates', 'parties', 'commercials', 'admins'];
  execFields.forEach(field => {
    totalFields++;
    if (executive && executive[field] !== null && executive[field] !== undefined) {
      populatedFields++;
    }
  });

  const completeness = Math.round((populatedFields / totalFields) * 100);
  const isValid = completeness >= 60 && critical_missing.length === 0;

  return { isValid, completeness, warnings, critical_missing };
}

// Extract core contract data (Ficha Técnica)
async function extractContractCore(
  parsedJson: any,
  contractCode: string
): Promise<{ data: any; tokens: number }> {
  console.log(`[extractContractCore] Processing contract: ${contractCode}`);
  
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");
  
  const relevantContent = {
    text: parsedJson.text?.split(' ').slice(0, 8000).join(' ') || '',
    pages: parsedJson.pages?.length || 0,
    tables: parsedJson.tables ? true : false
  };
  
  const payload = {
    model: "gpt-4o",  // UPGRADE: GPT-4o for maximum accuracy
    temperature: 0,
    max_tokens: 4000,
    messages: [
      { role: "system", content: EXTRACTION_PROMPTS.contract_summary },
      { 
        role: "user", 
        content: JSON.stringify({ 
          content: relevantContent,
          contract_code: contractCode
        }) 
      }
    ]
  };
  
  console.log("[extractContractCore] Calling GPT-4o for core extraction...");
  const response = await callOpenAIWithRetry(payload, openaiKey);
  const data = JSON.parse(response.choices[0].message.content);
  const tokens = response.usage?.total_tokens || 0;
  
  console.log(`[extractContractCore] ✅ Core extracted - Tokens: ${tokens}`);
  return { data, tokens };
}

// Extract risks
async function extractContractRisks(
  parsedJson: any,
  contractCode: string,
  summaryContext: any
): Promise<{ data: any; tokens: number }> {
  console.log(`[extractContractRisks] Processing contract: ${contractCode}`);
  
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");
  
  // Extract relevant clauses for risk analysis
  const riskRelevantSections = parsedJson.text?.match(
    /(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SÉPTIMO|OCTAVO|NOVENO|DÉCIMO|CLÁUSULA)[^\n]+(?:\n[^\n]+){0,25}/gi
  ) || [];
  
  const payload = {
    model: "gpt-4o",  // UPGRADE: GPT-4o for maximum accuracy
    temperature: 0,
    max_tokens: 3500,
    messages: [
      { role: "system", content: EXTRACTION_PROMPTS.contract_risks },
      { 
        role: "user", 
        content: JSON.stringify({ 
          clauses: riskRelevantSections.slice(0, 25),
          contract_code: contractCode,
          summary: summaryContext
        }) 
      }
    ]
  };
  
  console.log("[extractContractRisks] Calling GPT-4o for risks extraction...");
  const response = await callOpenAIWithRetry(payload, openaiKey);
  const data = JSON.parse(response.choices[0].message.content);
  const tokens = response.usage?.total_tokens || 0;
  
  console.log(`[extractContractRisks] ✅ Risks extracted - Tokens: ${tokens}, Findings: ${data.findings?.length || 0}`);
  return { data, tokens };
}

// Extract obligations
async function extractContractObligations(
  parsedJson: any,
  contractCode: string,
  risksContext: any
): Promise<{ data: any[]; tokens: number }> {
  console.log(`[extractContractObligations] Processing contract: ${contractCode}`);
  
  // Obligations are included in risks extraction, extract from risks.obligations
  const obligations = risksContext?.obligations || [];
  
  console.log(`[extractContractObligations] ✅ Extracted ${obligations.length} obligations from risks context`);
  return { data: obligations, tokens: 0 }; // No additional API call needed
}

// Detect document type based on filename and content
function detectDocumentType(filename: string, content: string): string {
  const lower = filename.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // SSO Plans - Prioridad alta
  if (
    lower.includes('sso') || 
    lower.includes('seguridad') ||
    lower.includes('plan de sso') ||
    lower.match(/pla-.*sso/i) ||  // Pattern: ITASCA-PLA-xxx-Plan de SSO
    contentLower.includes('plan de seguridad y salud ocupacional') ||
    contentLower.includes('prevención de riesgos')
  ) {
    return 'plan_sso';
  }
  
  // Quality Plans - Prioridad alta
  if (
    lower.includes('calidad') ||
    lower.includes('quality') ||
    lower.includes('aseguramiento de calidad') ||
    lower.match(/pla-.*calidad/i) ||  // Pattern: ITASCA-PLA-xxx-Calidad
    contentLower.includes('plan de aseguramiento de calidad') ||
    contentLower.includes('plan de calidad')
  ) {
    return 'plan_calidad';
  }
  
  // Contract - Prioridad muy alta
  if (
    lower.includes('contrato') || 
    lower.includes('contract') ||
    lower.includes('proforma') ||
    contentLower.includes('contrato de prestación de servicios') ||
    contentLower.includes('entre') && contentLower.includes('mandante') && contentLower.includes('contratista')
  ) {
    return 'contract';
  }
  
  // Technical Proposal - Alta prioridad
  if (
    lower.includes('propuesta') || 
    lower.includes('proposal') ||
    lower.match(/pte-.*estudio/i) ||  // Pattern: ITASCA-PTE-xxx-Estudio
    contentLower.includes('propuesta técnica') ||
    contentLower.includes('oferta técnica')
  ) {
    return 'propuesta';
  }
  
  // Annex - Media prioridad
  if (
    lower.includes('anexo') || 
    lower.includes('annex') ||
    lower.includes('appendix')
  ) {
    return 'annex';
  }
  
  // EDP - Prioridad específica
  if (lower.includes('edp') || lower.includes('estado de pago')) {
    return 'edp';
  }
  
  // Memorandum - Prioridad específica
  if (lower.includes('memo') || lower.includes('minuta')) {
    return 'memorandum';
  }
  
  // Default para estudios técnicos generales
  if (lower.includes('estudio') || lower.includes('study') || 
      lower.includes('técnico') || lower.includes('technical')) {
    return 'propuesta';
  }
  
  return 'unknown';
}

// Extract executive summary for dashboard cards with CONTRACT_EXECUTIVE_SUMMARY_PROMPT
async function extractExecutiveSummary(
  parsedJson: any,
  contractCode: string
): Promise<{ data: any; tokens: number }> {
  console.log(`[extractExecutiveSummary] Processing contract: ${contractCode}`);
  
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");
  
  const relevantContent = {
    text: parsedJson.text?.split(' ').slice(0, 10000).join(' ') || '',
    tables: parsedJson.tables || [],
    pages: parsedJson.pages?.length || 0
  };
  
  const payload = {
    model: "gpt-4o",  // UPGRADE: GPT-4o for maximum accuracy
    temperature: 0,
    max_tokens: 5000,
    messages: [
      { role: "system", content: EXTRACTION_PROMPTS.contract_exec_summary },
      { 
        role: "user", 
        content: JSON.stringify({ 
          parsed_json: relevantContent,
          contract_code: contractCode
        }) 
      }
    ]
  };
  
  console.log("[extractExecutiveSummary] Calling GPT-4o for executive summary...");
  const response = await callOpenAIWithRetry(payload, openaiKey);
  const data = JSON.parse(response.choices[0].message.content);
  const tokens = response.usage?.total_tokens || 0;
  
  console.log(`[extractExecutiveSummary] ✅ Executive extracted - Tokens: ${tokens}`);
  return { data, tokens };
}

// NEW: Extract dashboard cards with CONTRACT_EXECUTIVE_SUMMARY_PROMPT
async function extractDashboardCards(
  parsedJson: any,
  contractCode: string,
  filename: string,
  detectedType: string
): Promise<{ data: any; tokens: number }> {
  console.log(`[extractDashboardCards] Processing ${detectedType}: ${filename}`);
  
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");
  
  const relevantContent = {
    text: parsedJson.text || '',
    tables: parsedJson.tables || [],
    pages: parsedJson.pages?.length || 0
  };
  
  const userPrompt = `Document type: ${detectedType}
Filename: ${filename}
Contract code: ${contractCode}

Document content:
${JSON.stringify(relevantContent)}

Extract information relevant to this document type and generate cards accordingly.`;
  
  const payload = {
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 6000,
    messages: [
      { role: "system", content: CONTRACT_EXECUTIVE_SUMMARY_PROMPT },
      { role: "user", content: userPrompt }
    ]
  };
  
  console.log("[extractDashboardCards] Calling GPT-4o for dashboard cards extraction...");
  const response = await callOpenAIWithRetry(payload, openaiKey);
  let content = response.choices[0].message.content;
  
  // Clean markdown formatting
  content = content.replace(/^```json\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  
  const data = JSON.parse(content);
  const tokens = response.usage?.total_tokens || 0;
  
  // Validate schema with Zod
  try {
    const validated = ContractExecutiveSummarySchema.parse(data);
    console.log(`[extractDashboardCards] ✅ Schema validation passed`);
    console.log(`[extractDashboardCards] ✅ Cards extracted - Tokens: ${tokens}, Cards: ${validated.cards?.length || 0}`);
    return { data: validated, tokens };
  } catch (error) {
    console.error(`[extractDashboardCards] ❌ Schema validation failed:`, error);
    throw new Error(`Invalid executive summary schema: ${(error as Error).message}`);
  }
}

// NEW: Merge incremental data into contract_summaries.summary_json
async function mergeDashboardCards(
  supabase: any,
  contractId: string,
  contractCode: string,
  newCards: any,
  filename: string
): Promise<void> {
  console.log(`[mergeDashboardCards] Merging cards for contract: ${contractCode}`);
  
  // 1. Fetch existing summary
  const { data: existing, error: fetchError } = await supabase
    .from('contract_summaries')
    .select('summary_json')
    .eq('contract_code', contractCode)
    .maybeSingle();
  
  if (fetchError) {
    console.error("[mergeDashboardCards] Error fetching existing summary:", fetchError);
    throw new Error(`Failed to fetch existing summary: ${fetchError.message}`);
  }
  
  let mergedSummary: any;
  
  if (!existing || !existing.summary_json) {
    // No existing summary - use new data as-is
    console.log("[mergeDashboardCards] No existing summary, creating new");
    mergedSummary = newCards;
  } else {
    // Merge existing with new data
    console.log("[mergeDashboardCards] Merging with existing summary");
    const existingSummary = existing.summary_json as any;
    
    // Merge cards by category
    const existingCards = existingSummary.cards || [];
    const newCardsList = newCards.cards || [];
    
    const cardsByCategory: Record<string, any> = {};
    
    // Add existing cards
    for (const card of existingCards) {
      cardsByCategory[card.category] = card;
    }
    
    // Merge new cards (deep merge fields)
    for (const newCard of newCardsList) {
      const category = newCard.category;
      
      if (cardsByCategory[category]) {
        // Merge fields without overwriting existing non-null values
        const existingFields = cardsByCategory[category].fields || {};
        const newFields = newCard.fields || {};
        
        cardsByCategory[category].fields = {
          ...existingFields,
          ...Object.fromEntries(
            Object.entries(newFields).filter(([key, value]) => {
              // Only add if field doesn't exist or is null/empty
              return !existingFields[key] || 
                     existingFields[key] === null || 
                     (Array.isArray(existingFields[key]) && existingFields[key].length === 0);
            })
          )
        };
        
        // For arrays, merge them
        for (const [key, value] of Object.entries(newFields)) {
          if (Array.isArray(value) && Array.isArray(existingFields[key])) {
            // Merge arrays, removing duplicates
            cardsByCategory[category].fields[key] = [
              ...existingFields[key],
              ...value.filter((item: any) => 
                !existingFields[key].some((existing: any) => 
                  JSON.stringify(existing) === JSON.stringify(item)
                )
              )
            ];
          }
        }
      } else {
        // New category - add as-is
        cardsByCategory[category] = newCard;
      }
    }
    
    // Update provenance
    const existingProvenance = existingSummary.provenance || {};
    const newProvenance = newCards.provenance || {};
    
    const mergedProvenance = {
      contract_file: existingProvenance.contract_file || newProvenance.contract_file,
      annexes: [
        ...(existingProvenance.annexes || []),
        ...(newProvenance.annexes || []).filter((a: string) => 
          !(existingProvenance.annexes || []).includes(a)
        ),
        filename
      ].filter((a: string) => a !== existingProvenance.contract_file)
    };
    
    // Update meta
    mergedSummary = {
      contract_code: contractCode,
      summary_version: existingSummary.summary_version || newCards.summary_version || "v1.0",
      cards: Object.values(cardsByCategory),
      provenance: mergedProvenance,
      meta: {
        confidence: Math.max(
          existingSummary.meta?.confidence || 0,
          newCards.meta?.confidence || 0
        ),
        source_pages: [
          ...(existingSummary.meta?.source_pages || []),
          ...(newCards.meta?.source_pages || [])
        ],
        last_updated: new Date().toISOString()
      }
    };
  }
  
  // 2. Save with explicit SELECT -> UPDATE or INSERT (robust approach)
  const { data: existingRecord, error: selectError } = await supabase
    .from('contract_summaries')
    .select('id, summary_json')
    .eq('contract_code', contractCode)
    .maybeSingle();
  
  if (selectError) {
    console.error("[mergeDashboardCards] Error fetching existing summary:", selectError);
    throw new Error(`Failed to fetch existing summary: ${selectError.message}`);
  }
  
  let result;
  
  if (existingRecord) {
    // UPDATE existing record
    console.log(`[mergeDashboardCards] Updating existing summary ID: ${existingRecord.id}`);
    result = await supabase
      .from('contract_summaries')
      .update({
        summary_json: mergedSummary,
        updated_at: new Date().toISOString()
      })
      .eq('contract_code', contractCode)
      .select();
  } else {
    // INSERT new record
    console.log(`[mergeDashboardCards] Inserting new summary`);
    result = await supabase
      .from('contract_summaries')
      .insert({
        contract_id: contractId,
        contract_code: contractCode,
        summary_json: mergedSummary,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
  }
  
  // 3. Validate save operation
  if (result.error) {
    console.error("[mergeDashboardCards] ❌ FAILED to save:", result.error);
    throw new Error(`Failed to save summary: ${result.error.message}`);
  }
  
  if (!result.data || result.data.length === 0) {
    throw new Error("Save operation returned no data");
  }
  
  console.log(`[mergeDashboardCards] ✅ Summary saved successfully - ID: ${result.data[0].id}`);
  
  // 4. VERIFY that the JSON was saved correctly
  const { data: verification, error: verifyError } = await supabase
    .from('contract_summaries')
    .select('id, summary_json')
    .eq('contract_code', contractCode)
    .single();
  
  if (verifyError || !verification?.summary_json) {
    console.error("[mergeDashboardCards] ❌ VERIFICATION FAILED:", verifyError);
    throw new Error("Verification failed: summary_json is null after save");
  }
  
  console.log(`[mergeDashboardCards] ✅ VERIFIED: Cards count = ${verification.summary_json.cards?.length || 0}`);
  console.log(`[mergeDashboardCards] ✅ Merge complete:`, {
    totalCards: mergedSummary.cards.length,
    categories: mergedSummary.cards.map((c: any) => c.category),
    provenanceFiles: mergedSummary.provenance.annexes?.length || 0,
    confidence: mergedSummary.meta.confidence,
    savedAt: new Date().toISOString()
  });
  
  // 5. Log to audit table
  const newCategories = mergedSummary.cards.map((c: any) => c.category);
  const oldCategories = existing?.summary_json?.cards?.map((c: any) => c.category) || [];
  const addedCategories = newCategories.filter((c: string) => !oldCategories.includes(c));
  
  await supabase.from('contract_summaries_audit').insert({
    contract_code: contractCode,
    operation: existing ? 'merge' : 'insert',
    old_cards_count: oldCategories.length,
    new_cards_count: mergedSummary.cards.length,
    cards_added: addedCategories,
    cards_updated: newCategories.filter((c: string) => oldCategories.includes(c)),
    triggered_by: filename,
    confidence_score: mergedSummary.meta?.confidence || null
  });
  
  console.log(`[mergeDashboardCards] 📋 Audit log created`);
}

// Main extraction orchestrator with parallel execution
async function extractContractMetadata(
  parsedJson: any,
  contractCode: string,
  docType: string
): Promise<{ 
  summary: any; 
  risks: any; 
  obligations: any[];
  executive: any;
  validation: any;
  totalTokens: number;
}> {
  console.log(`[extractContractMetadata] 🚀 Starting PARALLEL extraction for: ${contractCode}`);
  
  const startTime = Date.now();
  
  // PHASE 1: Extract core summary and executive in parallel (no dependencies)
  const [coreResult, execResult] = await Promise.allSettled([
    extractContractCore(parsedJson, contractCode),
    extractExecutiveSummary(parsedJson, contractCode)
  ]);
  
  let summary: any = null;
  let executive: any = null;
  let tokensPhase1 = 0;
  
  if (coreResult.status === 'fulfilled') {
    summary = coreResult.value.data;
    tokensPhase1 += coreResult.value.tokens;
  } else {
    console.error('[extractContractMetadata] ❌ Core extraction failed:', coreResult.reason);
  }
  
  if (execResult.status === 'fulfilled') {
    executive = execResult.value.data;
    tokensPhase1 += execResult.value.tokens;
  } else {
    console.error('[extractContractMetadata] ❌ Executive extraction failed:', execResult.reason);
  }
  
  console.log(`[extractContractMetadata] ✅ Phase 1 complete - Tokens: ${tokensPhase1}`);
  
  // PHASE 2: Extract risks and obligations (risks need summary context)
  const risksResult = await extractContractRisks(parsedJson, contractCode, summary).catch(err => {
    console.error('[extractContractMetadata] ❌ Risks extraction failed:', err);
    return { data: { findings: [], obligations: [] }, tokens: 0 };
  });
  
  const risks = risksResult.data;
  const tokensPhase2 = risksResult.tokens;
  
  console.log(`[extractContractMetadata] ✅ Phase 2 complete - Tokens: ${tokensPhase2}`);
  
  // PHASE 3: Extract obligations from risks context
  const obligationsResult = await extractContractObligations(parsedJson, contractCode, risks);
  const obligations = obligationsResult.data;
  
  // Calculate totals
  const totalTokens = tokensPhase1 + tokensPhase2;
  const elapsed = Date.now() - startTime;
  
  // Validate extracted data
  const validation = validateExtractedData(summary, risks, obligations, executive);
  
  console.log(`[extractContractMetadata] 🎉 EXTRACTION COMPLETE:`, {
    elapsed_ms: elapsed,
    total_tokens: totalTokens,
    completeness: `${validation.completeness}%`,
    summary_ok: !!summary,
    risks_count: risks?.findings?.length || 0,
    obligations_count: obligations.length,
    executive_ok: !!executive,
    review_required: !validation.isValid
  });
  
  return { summary, risks, obligations, executive, validation, totalTokens };
}

// Upsert contract metadata into database with enhanced error handling
async function upsertContractMetadata(
  supabase: any,
  contractId: string,
  contractCode: string,
  extractionResult: {
    summary: any;
    risks: any;
    obligations: any[];
    executive: any;
    validation: any;
  }
): Promise<void> {
  console.log(`[upsertContractMetadata] Upserting for contract: ${contractCode}`);
  
  const { summary, risks, obligations, executive, validation } = extractionResult;
  
  // Prepare raw_json with all extracted data
  const fullRawJson = {
    ...summary,
    executive_summary: executive,
    extraction_quality: {
      completeness: validation.completeness,
      warnings: validation.warnings,
      critical_missing: validation.critical_missing,
      review_required: !validation.isValid
    }
  };
  
  // 1. Upsert contract_summaries with UNIQUE constraint on contract_id
  const { error: summaryErr } = await supabase
    .from('contract_summaries')
    .upsert({
      contract_id: contractId,
      contract_code: contractCode,
      version_tag: summary?.version_tag || null,
      date_issued: summary?.date_issued || null,
      validity_start: summary?.validity_start || null,
      validity_end: summary?.validity_end || null,
      currency: summary?.currency || null,
      budget_total: summary?.budget_total || null,
      reajustabilidad: summary?.reajustabilidad || null,
      milestones: summary?.milestones || [],
      compliance_requirements: summary?.compliance_requirements || [],
      parties: summary?.parties || {},
      summary_md: summary?.summary_md || null,
      provenance: summary?.provenance || [],
      raw_json: fullRawJson,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'contract_id',
      ignoreDuplicates: false
    });
  
  if (summaryErr) {
    console.error("[upsertContractMetadata] Error upserting summary:", summaryErr);
    throw new Error(`Failed to upsert contract summary: ${summaryErr.message}`);
  }
  
  console.log(`[upsertContractMetadata] ✅ Summary upserted (completeness: ${validation.completeness}%)`);
  
  // 2. Delete existing risks before inserting new ones (full refresh)
  const { error: deleteRisksErr } = await supabase
    .from('contract_risks')
    .delete()
    .eq('contract_id', contractId);
  
  if (deleteRisksErr) {
    console.warn("[upsertContractMetadata] Warning deleting old risks:", deleteRisksErr);
  }
  
  // 3. Insert new risks
  let risksInserted = 0;
  for (const finding of (risks?.findings || [])) {
    const { error: riskErr } = await supabase
      .from('contract_risks')
      .insert({
        contract_id: contractId,
        contract_code: contractCode,
        risk_type: finding.risk_type,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        probability: finding.probability || null,
        obligation: finding.obligation || false,
        deadline: finding.deadline || null,
        periodicity: finding.periodicity || null,
        clause_ref: finding.clause_ref || null,
        page: finding.page || null,
        source_doc_type: finding.source_doc_type || 'contract',
        source_version: finding.source_version || null,
        source_excerpt: finding.source_excerpt || null
      });
    
    if (!riskErr) {
      risksInserted++;
    } else {
      console.error(`[upsertContractMetadata] Error inserting risk: ${finding.title}`, riskErr);
    }
  }
  
  console.log(`[upsertContractMetadata] ✅ ${risksInserted}/${risks?.findings?.length || 0} risks inserted`);
  
  // 4. Delete existing obligations before inserting new ones (full refresh)
  const { error: deleteObligationsErr } = await supabase
    .from('contract_obligations')
    .delete()
    .eq('contract_id', contractId);
  
  if (deleteObligationsErr) {
    console.warn("[upsertContractMetadata] Warning deleting old obligations:", deleteObligationsErr);
  }
  
  // 5. Insert new obligations
  let obligationsInserted = 0;
  for (const obligation of (obligations || [])) {
    const { error: obligationErr } = await supabase
      .from('contract_obligations')
      .insert({
        contract_id: contractId,
        contract_code: contractCode,
        name: obligation.name,
        type: obligation.type,
        periodicity: obligation.periodicity || null,
        next_due_date: obligation.next_due_date || null,
        notes: obligation.related_clause_ref ? `Cláusula: ${obligation.related_clause_ref}` : null
      });
    
    if (!obligationErr) {
      obligationsInserted++;
    } else {
      console.error(`[upsertContractMetadata] Error inserting obligation: ${obligation.name}`, obligationErr);
    }
  }
  
  console.log(`[upsertContractMetadata] ✅ ${obligationsInserted}/${obligations?.length || 0} obligations inserted`);
  console.log(`[upsertContractMetadata] 🎉 Full metadata upsert complete!`);
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

    const { contract_id, contract_code, storage_path, document_type, edp_number, reprocessing, job_id } = requestBody;

    if (!storage_path) {
      throw new Error("storage_path is required");
    }

    // FASE 2: Check for duplicate jobs (últimos 15 minutos)
    // Skip check if reprocessing flag is true
    if (!reprocessing) {
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
    } else {
      console.log(`[process-document] 🔄 Reprocessing mode - cancelling existing jobs for ${storage_path}`);
      
      // Cancel any existing jobs for this storage_path
      await supabase
        .from('document_processing_jobs')
        .update({ status: 'cancelled', error: 'Superseded by reprocessing request' })
        .eq('storage_path', storage_path)
        .in('status', ['queued', 'processing']);
    }


    // Step 1: Get or create a processing job
    let job;
    if (reprocessing && job_id) {
      // Use existing job from reprocess-contract
      console.log(`[process-document] 🔄 Using existing job: ${job_id}`);
      
      const { data: existingJob, error: fetchError } = await supabase
        .from("document_processing_jobs")
        .select()
        .eq('id', job_id)
        .single();
      
      if (fetchError || !existingJob) {
        console.error("[process-document] Failed to fetch job:", fetchError);
        throw new Error(`Failed to fetch job ${job_id}: ${fetchError?.message}`);
      }
      
      // Update status to processing
      const { data: updatedJob, error: updateError } = await supabase
        .from("document_processing_jobs")
        .update({ status: "processing" })
        .eq('id', job_id)
        .select()
        .single();
      
      if (updateError) {
        console.error("[process-document] Failed to update job:", updateError);
        throw new Error(`Failed to update job: ${updateError?.message}`);
      }
      
      job = updatedJob;
    } else {
      // Create new job
      const { data: newJob, error: jobError } = await supabase
        .from("document_processing_jobs")
        .insert({
          storage_path,
          status: "processing",
          contract_id: contract_id || null,
          document_type: document_type || "unknown"
        })
        .select()
        .single();

      if (jobError || !newJob) {
        console.error("[process-document] Failed to create job:", jobError);
        throw new Error(`Failed to create processing job: ${jobError?.message}`);
      }
      
      job = newJob;
      console.log(`[process-document] Created job: ${job.id} for ${storage_path}`);
    }


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

    // Step 4.5: Extract with OpenAI - OPTIMIZED for large documents
    const systemPrompt = EXTRACTION_PROMPTS[document_type] || EXTRACTION_PROMPTS.contract;
    
    // Smart truncation based on document type
    let parsedText: string;
    const MAX_CHARS_BY_TYPE: Record<string, number> = {
      edp: 50000,           // EDPs are usually ~5-10 pages
      memorandum: 80000,    // Memos are ~10-20 pages
      contract: 100000,     // Contracts ~20-40 pages
      sso: 40000,           // SSO plans can be huge, limit to ~30 pages
      quality: 40000,       // Quality plans can be huge, limit to ~30 pages
      tech: 60000,          // Technical docs
      sdi: 30000,           // SDIs are usually short
      addendum: 40000,      // Addenda are usually short
      annex: 60000,
      plan_sso: 40000,
      plan_calidad: 40000,
      propuesta: 60000
    };
    
    const maxChars = MAX_CHARS_BY_TYPE[document_type] || 80000;
    const fullText = JSON.stringify(parsedJson);
    
    if (fullText.length > maxChars) {
      console.log(`[process-document] ⚠️ Document too large (${fullText.length} chars), truncating to ${maxChars} for ${document_type}`);
      
      // For plans (SSO/Quality), prioritize structured sections
      if (document_type === 'sso' || document_type === 'quality' || document_type === 'plan_sso' || document_type === 'plan_calidad') {
        // Extract first pages (cover, objectives) + tables + last pages (responsibilities)
        const pages = parsedJson.pages || [];
        const firstPages = pages.slice(0, 5);  // First 5 pages
        const lastPages = pages.slice(-3);     // Last 3 pages
        const tables = parsedJson.tables || [];
        
        parsedText = JSON.stringify({
          pages: [...firstPages, ...lastPages],
          tables: tables.slice(0, 20),  // First 20 tables
          metadata: {
            total_pages: pages.length,
            truncated: true,
            note: "Document truncated to key sections for efficiency"
          }
        });
      } else {
        // General truncation - keep first portion
        parsedText = fullText.substring(0, maxChars);
      }
    } else {
      parsedText = fullText;
    }
    
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

    // Step 4.4: Auto-detect document type and process executive summary cards
    const filename = storage_path.split("/").pop() || "unknown";
    const documentText = parsedJson.text || '';
    const autoDetectedType = detectDocumentType(filename, documentText);
    
    // List of document types that should generate executive summary cards
    const EXECUTIVE_SUMMARY_TYPES = ['contract', 'annex', 'plan_sso', 'plan_calidad', 'propuesta'];
    
    if (EXECUTIVE_SUMMARY_TYPES.includes(autoDetectedType) || EXECUTIVE_SUMMARY_TYPES.includes(document_type)) {
      const effectiveType = EXECUTIVE_SUMMARY_TYPES.includes(document_type) ? document_type : autoDetectedType;
      
      console.log(`[process-document] 📋 Document is contractual type: ${effectiveType}, extracting dashboard cards...`);
      
      try {
        // Only process if we have a contract or contract_code
        const effectiveCode = contract_code || contract?.code;
        
        if (effectiveCode) {
          const cardsResult = await extractDashboardCards(
            parsedJson,
            effectiveCode,
            filename,
            effectiveType
          );
          
          // If contract doesn't exist yet but we have extracted data, we'll create it below
          if (contract?.id) {
            // Merge cards into contract_summaries
            await mergeDashboardCards(
              supabase,
              contract.id,
              effectiveCode,
              cardsResult.data,
              filename
            );
            
            console.log(`[process-document] ✅ Dashboard cards extracted and merged (${cardsResult.tokens} tokens)`);
          } else {
            console.log(`[process-document] ℹ️ Cards extracted but no contract ID yet, will merge after contract creation`);
            // Store cards result for later merge
            structured._dashboard_cards = cardsResult.data;
            structured._dashboard_cards_tokens = cardsResult.tokens;
          }
        } else {
          console.warn(`[process-document] ⚠️ Cannot extract dashboard cards: no contract_code available`);
        }
      } catch (cardsError) {
        console.error(`[process-document] ❌ Error extracting dashboard cards:`, cardsError);
        // Don't fail the whole process, just log the error
      }
    } else {
      console.log(`[process-document] Document type ${document_type}/${autoDetectedType} does not require executive summary cards`);
    }

    // Step 4.5: For contract documents, ensure contract exists
    if (document_type === "contract" && !contract) {
      const extractedCode = structured.contract_code || structured.code || `CONTRACT-${Date.now()}`;
      const extractedTitle = structured.title || structured.name || "Contrato sin título";
      
      console.log(`[process-document] Extracted contract code: ${extractedCode}`);
      
      // First, check if contract already exists
      const { data: existingContract, error: existingError } = await supabase
        .from("contracts")
        .select("*")
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
        
        // If we have pending dashboard cards, merge them now
        if (structured._dashboard_cards) {
          console.log(`[process-document] 📋 Merging pending dashboard cards for newly created contract`);
          try {
            await mergeDashboardCards(
              supabase,
              contract.id,
              contract.code,
              structured._dashboard_cards,
              filename
            );
            console.log(`[process-document] ✅ Dashboard cards merged (${structured._dashboard_cards_tokens || 0} tokens)`);
          } catch (mergeError) {
            console.error(`[process-document] ❌ Error merging pending cards:`, mergeError);
            // Don't fail the whole process
          }
          // Clean up temporary fields
          delete structured._dashboard_cards;
          delete structured._dashboard_cards_tokens;
        }
      }
      
      // Also merge dashboard cards if contract existed but we have new cards
      if (contract && structured._dashboard_cards) {
        console.log(`[process-document] 📋 Merging dashboard cards for existing contract`);
        try {
          await mergeDashboardCards(
            supabase,
            contract.id,
            contract.code,
            structured._dashboard_cards,
            filename
          );
          console.log(`[process-document] ✅ Dashboard cards merged (${structured._dashboard_cards_tokens || 0} tokens)`);
        } catch (mergeError) {
          console.error(`[process-document] ❌ Error merging cards:`, mergeError);
        }
        // Clean up temporary fields
        delete structured._dashboard_cards;
        delete structured._dashboard_cards_tokens;
      }
    }
    
    // Step 4.6: ALWAYS extract and upsert contract metadata for contract documents
    // SPRINT 2: Using parallel GPT-4o extractions
    if (document_type === "contract" && contract) {
      try {
        console.log("[process-document] 🚀 Starting FULL contract extraction (GPT-4o)...");
        const extractedCode = contract.code || structured.contract_code;
        
        // Single call with parallel extraction
        const extractionResult = await extractContractMetadata(parsedJson, extractedCode, document_type);
        
        // Update job progress with extraction results
        await supabase
          .from("document_processing_jobs")
          .update({ 
            progress: {
              phase: 'extraction_complete',
              completeness: extractionResult.validation.completeness,
              tokens_used: extractionResult.totalTokens,
              warnings: extractionResult.validation.warnings,
              review_required: !extractionResult.validation.isValid
            }
          })
          .eq("id", job.id);
        
        // Upsert all metadata
        await upsertContractMetadata(
          supabase,
          contract.id,
          extractedCode,
          extractionResult
        );
        
        console.log("[process-document] ✅ Contract metadata extracted and upserted");
        console.log(`[process-document] 📊 Extraction quality: ${extractionResult.validation.completeness}% completeness, ${extractionResult.totalTokens} tokens`);
        
        if (!extractionResult.validation.isValid) {
          console.warn("[process-document] ⚠️ Review required:", extractionResult.validation.warnings);
        }
      } catch (metaErr) {
        console.error("[process-document] ❌ Error extracting contract metadata:", metaErr);
        
        // Update job with error but don't fail completely
        await supabase
          .from("document_processing_jobs")
          .update({ 
            progress: {
              phase: 'extraction_failed',
              error: String(metaErr)
            }
          })
          .eq("id", job.id);
        
        console.warn("[process-document] Continuing without complete metadata extraction");
      }
    }
    
    // FASE 5: Validar que el contrato tenga datos completos
    if (document_type === "contract" && contract) {
      const extractedCode = contract.code || structured.contract_code;
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
    let jobId: string | null = null;
    
    // Try to extract job_id from request if available
    try {
      const url = new URL(req.url);
      // Don't re-read body, it's been consumed
    } catch (e) {
      // Ignore
    }
    
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
    } else if (error?.status === 429 || errorDetails.includes('rate_limit') || errorDetails.includes('too large')) {
      errorType = 'rate_limit';
      if (errorDetails.includes('too large') || errorDetails.includes('Requested')) {
        // Extract actual limits from error message
        const match = errorDetails.match(/Limit (\d+), Requested (\d+)/);
        if (match) {
          errorDetails = `Document too large: Requested ${match[2]} tokens but limit is ${match[1]}. Document has been truncated, please retry.`;
        } else {
          errorDetails = 'Document too large for processing. Please try with a smaller document or contact support.';
        }
      } else {
        errorDetails = 'Rate limit exceeded, retry in 60s';
      }
    } else if (errorDetails.includes('timeout')) {
      errorType = 'timeout';
      errorDetails = 'Processing timeout exceeded (2 hours)';
    } else if (errorDetails.includes('Job already in progress')) {
      errorType = 'duplicate_job';
    } else if (errorDetails.includes('Contract not found')) {
      errorType = 'contract_not_found';
    }
    
    console.error(`[process-document] ❌ Error [${errorType}]:`, errorDetails);
    console.error(`[process-document] Full error:`, error);

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
