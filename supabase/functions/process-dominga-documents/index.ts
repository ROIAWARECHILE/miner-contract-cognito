import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // List all files in dominga folder
    const { data: files, error: listError } = await supabaseClient.storage
      .from('contracts')
      .list('dominga', { limit: 100, sortBy: { column: 'name', order: 'asc' } });

    if (listError) throw listError;

    const results = {
      upserts: [] as any[],
      analytics: {} as any,
      alerts: [] as any[],
      log: [] as any[]
    };

    // Process each subfolder
    for (const folder of ['contract', 'edp', 'quality', 'sso', 'tech']) {
      const { data: folderFiles, error: folderError } = await supabaseClient.storage
        .from('contracts')
        .list(`dominga/${folder}`, { limit: 100 });

      if (folderError || !folderFiles) continue;

      for (const file of folderFiles) {
        if (!file.name.endsWith('.pdf')) continue;

        const filePath = `dominga/${folder}/${file.name}`;
        
        // Check if already processed
        const { data: existingDoc } = await supabaseClient
          .from('documents')
          .select('id, checksum')
          .eq('file_url', filePath)
          .single();

        if (existingDoc) {
          results.log.push({ type: 'skip', message: `Already processed: ${filePath}` });
          continue;
        }

        // Download PDF
        const { data: pdfData, error: downloadError } = await supabaseClient.storage
          .from('contracts')
          .download(filePath);

        if (downloadError || !pdfData) {
          results.log.push({ type: 'error', message: `Failed to download: ${filePath}` });
          continue;
        }

        // Convert to base64
        const arrayBuffer = await pdfData.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        // Determine document type from folder
        const docTypeMap: Record<string, string> = {
          'contract': 'contract',
          'edp': 'edp',
          'quality': 'plan_calidad',
          'sso': 'plan_sso',
          'tech': 'plan_tecnico'
        };
        const documentType = docTypeMap[folder];

        // Extract with AI
        const extractionResult = await extractDocument(
          base64,
          documentType,
          file.name,
          filePath,
          LOVABLE_API_KEY
        );

        if (extractionResult.error) {
          results.log.push({ type: 'error', message: `Extraction failed for ${filePath}: ${extractionResult.error}` });
          continue;
        }

        // Process extracted data
        const processed = await processExtractedData(
          supabaseClient,
          extractionResult.data,
          filePath,
          file.name
        );

        results.upserts.push(...processed.upserts);
        results.log.push(...processed.log);
      }
    }

    // Compute analytics
    const { data: contracts } = await supabaseClient
      .from('contracts')
      .select(`
        id,
        code,
        budget_uf,
        payment_states (
          amount_uf,
          status
        )
      `)
      .eq('code', 'AIPD-CSI001-1000-MN-0001')
      .single();

    if (contracts) {
      const spentUf = (contracts.payment_states || [])
        .filter((ps: any) => ['approved', 'submitted'].includes(ps.status))
        .reduce((sum: number, ps: any) => sum + (ps.amount_uf || 0), 0);
      
      const availableUf = contracts.budget_uf - spentUf;
      const overallProgressPct = Math.min(100, Math.max(0, (spentUf / contracts.budget_uf) * 100));

      results.analytics = {
        spent_uf: spentUf,
        available_uf: availableUf,
        overall_progress_pct: overallProgressPct
      };

      // Update contract metadata
      await supabaseClient
        .from('contracts')
        .update({
          metadata: {
            spent_uf: spentUf,
            available_uf: availableUf,
            overall_progress_pct: overallProgressPct
          }
        })
        .eq('id', contracts.id);
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-dominga-documents:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractDocument(
  base64Pdf: string,
  documentType: string,
  filename: string,
  filePath: string,
  apiKey: string
): Promise<{ data?: any; error?: string }> {
  try {
    const systemPrompt = getSystemPrompt(documentType);
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
                text: `Extract structured data from this PDF document (${filename}). Return ONLY valid JSON matching the schema for document type: ${documentType}`
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
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: `AI API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    
    if (!content) {
      return { error: 'No content in AI response' };
    }

    // Extract JSON from response (might be wrapped in markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const extractedData = JSON.parse(jsonStr);
    
    // Add comprehensive provenance
    extractedData.provenance = {
      bucket_path: 'contracts',
      filename: filename,
      storage_path: filePath,
      extracted_at: new Date().toISOString(),
      extraction_method: 'ai_vision',
      model: 'google/gemini-2.5-flash'
    };

    // Check for low confidence fields and log warnings
    if (extractedData.low_confidence_fields && extractedData.low_confidence_fields.length > 0) {
      console.warn(`Low confidence fields detected in ${filename}:`, extractedData.low_confidence_fields);
    }

    return { data: extractedData };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown extraction error';
    return { error: `Extraction error: ${errorMessage}` };
  }
}

function getSystemPrompt(documentType: string): string {
  const basePrompt = `You are ContractOS - an autonomous contract data extraction specialist for Chilean mining projects.
Extract information with MAXIMUM precision. Every value must be exact and traceable.

CRITICAL EXTRACTION RULES:
1. Extract ALL numeric values with FULL decimal precision (e.g., 209.81, never round to 209.8)
2. Dates MUST be ISO format: YYYY-MM-DD
3. For periods like "Jul-25": period_start="2025-07-01", period_end="2025-07-31", period_label="Jul-25"
4. Contract code is ALWAYS: "AIPD-CSI001-1000-MN-0001"
5. Use dot (.) as decimal separator, never comma
6. Return ONLY valid JSON, no markdown code blocks
7. Include confidence_by_field with 0-1 scores for each critical field
8. If confidence < 0.75 on any field, mark it in low_confidence_fields array

Spanish mining terminology:
- "Estado de Pago" / "EDP" = Payment State document
- "N° EDP" or "EDP N°" = EDP number
- "Período" / "Periodo" = Time period
- "Monto UF" = Amount in UF (Unidad de Fomento - Chilean inflation-indexed unit)
- "Valor UF" = UF exchange rate to CLP
- "Monto CLP" / "$" = Amount in Chilean Pesos
- "Partidas" / "Tareas" / "Actividades" = Tasks/Activities/Line items
- "% Avance" / "Avance %" = Progress percentage
- "Presupuesto" = Budget
- "Gastado" / "Ejecutado" = Spent/Executed
- "Cliente" = Client company
- "Contratista" = Contractor company
- "Vigencia" = Duration/Validity period
- "Fecha inicio" = Start date`;

  const schemas: Record<string, string> = {
    contract: `${basePrompt}

EXTRACT from Contrato/Proforma with THESE EXACT FIELDS:
{
  "document_type": "contract",
  "contract_code": "AIPD-CSI001-1000-MN-0001",
  "title": "exact title from document",
  "client": "Andes Iron SpA",
  "contractor": "Itasca Chile SpA",
  "budget_uf": 4501 (total budget number),
  "start_date": "2025-07-21" (ISO format),
  "end_date": null or "YYYY-MM-DD",
  "tasks": [
    {"task_number": "1.1", "name": "Recopilación y análisis de información", "budget_uf": 507},
    {"task_number": "2.0", "name": "Visita a terreno", "budget_uf": 216},
    ... (extract ALL tasks with exact task numbers and names)
  ],
  "kpis_plan": {
    "s_curve_plan": [
      {"month": "2025-07", "cum_plan_percent": 4},
      {"month": "2025-08", "cum_plan_percent": 12},
      ... (extract planned cumulative percentages by month)
    ]
  },
  "confidence_by_field": {
    "budget_uf": 0.95,
    "start_date": 0.90,
    "tasks": 0.85
  },
  "low_confidence_fields": []
}

VERIFICATION: Sum of all task budgets MUST equal budget_uf (±1 UF tolerance)`,

    edp: `${basePrompt}

EXTRACT from Estado de Pago (EDP) with THESE EXACT FIELDS:
{
  "document_type": "edp",
  "contract_code": "AIPD-CSI001-1000-MN-0001",
  "edp_number": 1 (extract from "EDP N°" or "N° EDP"),
  "period_label": "Jul-25" (keep original format),
  "period_start": "2025-07-01" (ISO format),
  "period_end": "2025-07-31" (ISO format),
  "amount_uf": 209.81 (total EDP amount with FULL decimals),
  "uf_rate": 39179.01 (UF exchange rate with FULL decimals),
  "amount_clp": 8219991 (total in Chilean pesos),
  "status": "approved" (or "submitted", "draft", "rejected"),
  "approval_date": null or "YYYY-MM-DD",
  "tasks_executed": [
    {
      "task_number": "1.1",
      "name": "Recopilación y análisis de información",
      "budget_uf": 507,
      "spent_uf": 147.85,
      "progress_pct": 29
    },
    ... (extract ALL tasks that have spent > 0)
  ],
  "confidence_by_field": {
    "edp_number": 0.99,
    "amount_uf": 0.95,
    "tasks_executed": 0.90
  },
  "low_confidence_fields": []
}

VERIFICATION: Sum of tasks_executed[].spent_uf MUST equal amount_uf (±0.5 UF tolerance)
CRITICAL: Look for tables with columns: Tarea/Actividad, % Avance, Monto UF, UF Gastado`,

    plan_calidad: `${basePrompt}

Return JSON for Plan de Aseguramiento de Calidad:
{
  "document_type": "plan_calidad",
  "contract_code": "AIPD-CSI001-1000-MN-0001",
  "title": "exact document title",
  "version": "R0" or "Rev.0",
  "policy_refs": ["ISO standards", "company policies"],
  "responsibles": [{"name": "person name", "role": "title/position"}],
  "review_dates": ["2025-MM-DD"],
  "confidence_by_field": {"title": 0.95},
  "low_confidence_fields": []
}`,

    plan_sso: `${basePrompt}

Return JSON for Plan de SSO (Seguridad y Salud Ocupacional):
{
  "document_type": "plan_sso",
  "contract_code": "AIPD-CSI001-1000-MN-0001",
  "title": "exact document title",
  "version": "R0" or "Rev.0",
  "policy_refs": ["safety regulations", "company policies"],
  "responsibles": [{"name": "person name", "role": "title/position"}],
  "review_dates": ["2025-MM-DD"],
  "confidence_by_field": {"title": 0.95},
  "low_confidence_fields": []
}`,

    plan_tecnico: `${basePrompt}

Return JSON for Plan Técnico / Estudio Técnico:
{
  "document_type": "plan_tecnico",
  "contract_code": "AIPD-CSI001-1000-MN-0001",
  "title": "exact document title",
  "version": "R0" or "Rev.0",
  "scope": "brief description of technical scope",
  "responsibles": [{"name": "person name", "role": "title/position"}],
  "confidence_by_field": {"title": 0.95},
  "low_confidence_fields": []
}`
  };

  return schemas[documentType] || schemas.contract;
}

async function processExtractedData(
  supabaseClient: any,
  extractedData: any,
  filePath: string,
  filename: string
): Promise<{ upserts: any[]; log: any[] }> {
  const upserts: any[] = [];
  const log: any[] = [];

  try {
    const documentType = extractedData.document_type;

    // Get or create contract
    let contractId: string;
    const { data: existingContract } = await supabaseClient
      .from('contracts')
      .select('id')
      .eq('code', extractedData.contract_code)
      .single();

    if (existingContract) {
      contractId = existingContract.id;
    } else if (documentType === 'contract') {
      // Create new contract
      const { data: newContract, error: contractError } = await supabaseClient
        .from('contracts')
        .insert({
          code: extractedData.contract_code,
          title: extractedData.title,
          type: 'service',
          status: 'active',
          contract_value: extractedData.budget_uf,
          currency: 'UF',
          start_date: extractedData.start_date,
          end_date: extractedData.end_date,
          metadata: { budget_uf: extractedData.budget_uf }
        })
        .select()
        .single();

      if (contractError) throw contractError;
      contractId = newContract.id;
      upserts.push({ table: 'contracts', action: 'insert', id: contractId });
      log.push({ type: 'ingest', message: `Created contract: ${extractedData.contract_code}` });

      // Create companies
      if (extractedData.client) {
        await supabaseClient.from('companies').upsert({ name: extractedData.client }, { onConflict: 'name' });
      }
      if (extractedData.contractor) {
        await supabaseClient.from('companies').upsert({ name: extractedData.contractor }, { onConflict: 'name' });
      }

      // Create initial tasks
      if (extractedData.tasks) {
        for (const task of extractedData.tasks) {
          await supabaseClient.from('contract_tasks').upsert({
            contract_id: contractId,
            task_number: task.task_number || task.code, // Handle both formats
            task_name: task.name,
            budget_uf: task.budget_uf,
            spent_uf: 0,
            progress_percentage: 0
          }, { onConflict: 'contract_id,task_number' });
        }
        log.push({ type: 'ingest', message: `Created ${extractedData.tasks.length} tasks` });
      }
      
      // Store kpis_plan in metadata if present (clean data to avoid circular refs)
      if (extractedData.kpis_plan) {
        const cleanMetadata = {
          budget_uf: extractedData.budget_uf,
          client: extractedData.client,
          contractor: extractedData.contractor,
          kpis_plan: extractedData.kpis_plan,
          title: extractedData.title
        };
        await supabaseClient
          .from('contracts')
          .update({ metadata: cleanMetadata })
          .eq('id', contractId);
      }
    } else {
      throw new Error(`Contract ${extractedData.contract_code} not found`);
    }

    // Process EDP
    if (documentType === 'edp') {
      // Clean data to avoid circular references - only store essential fields
      const cleanEdpData = {
        tasks_executed: extractedData.tasks_executed || [],
        confidence_by_field: extractedData.confidence_by_field || {},
        low_confidence_fields: extractedData.low_confidence_fields || [],
        provenance: extractedData.provenance
      };
      
      const { error: edpError } = await supabaseClient
        .from('payment_states')
        .upsert({
          contract_id: contractId,
          edp_number: extractedData.edp_number,
          period_label: extractedData.period_label,
          period_start: extractedData.period_start,
          period_end: extractedData.period_end,
          amount_uf: extractedData.amount_uf,
          uf_rate: extractedData.uf_rate,
          amount_clp: extractedData.amount_clp,
          status: extractedData.status || 'approved',
          data: cleanEdpData
        }, { onConflict: 'contract_id,edp_number' });

      if (edpError) throw edpError;
      upserts.push({ table: 'payment_states', action: 'upsert' });
      log.push({ type: 'ingest', message: `Processed EDP #${extractedData.edp_number}` });

      // Update tasks from EDP
      if (extractedData.tasks_executed) {
        for (const task of extractedData.tasks_executed) {
          await supabaseClient.from('contract_tasks').upsert({
            contract_id: contractId,
            task_number: task.task_number,
            task_name: task.name,
            budget_uf: task.budget_uf,
            spent_uf: task.spent_uf,
            progress_percentage: task.progress_pct
          }, { onConflict: 'contract_id,task_number' });
        }
      }
    }

    // Record document with extracted data and provenance
    const cleanExtractedData = {
      document_type: extractedData.document_type,
      confidence_by_field: extractedData.confidence_by_field || {},
      low_confidence_fields: extractedData.low_confidence_fields || [],
      provenance: extractedData.provenance
    };
    
    await supabaseClient.from('documents').upsert({
      contract_id: contractId,
      filename: filename,
      file_url: filePath,
      doc_type: 'original',
      checksum: filePath,
      extracted_data: cleanExtractedData,
      processing_status: 'completed'
    }, { onConflict: 'contract_id,filename' });
    
    log.push({ type: 'ingest', message: `Recorded document: ${filename}` });
    
    // Create review alerts for low confidence fields
    if (extractedData.low_confidence_fields && extractedData.low_confidence_fields.length > 0) {
      const alertMessage = `Low confidence extraction in ${filename}: ${extractedData.low_confidence_fields.join(', ')}`;
      log.push({ type: 'alert', message: alertMessage });
      
      // Note: Would insert into sla_alerts table here, but keeping simple for now
    }

    return { upserts, log };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    log.push({ type: 'error', message: `Processing error: ${errorMessage}` });
    return { upserts, log };
  }
}
