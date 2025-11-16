import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { contract_code } = await req.json();

    if (!contract_code) {
      return new Response(
        JSON.stringify({ error: 'contract_code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Obtener el contrato
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('code', contract_code)
      .single();

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ error: 'Contract not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Obtener todos los documentos procesados (EDPs y Memorandums)
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('contract_id', contract.id)
      .in('doc_type', ['edp', 'memorandum'])
      .order('created_at', { ascending: true });

    if (docsError) throw docsError;

    // 3. Obtener payment_states (EDPs)
    const { data: paymentStates, error: paymentsError } = await supabase
      .from('payment_states')
      .select('*')
      .eq('contract_id', contract.id)
      .order('edp_number', { ascending: true });

    if (paymentsError) throw paymentsError;

    // 4. Obtener technical_reports (Memorandums)
    const { data: technicalReports, error: reportsError } = await supabase
      .from('technical_reports')
      .select('*')
      .eq('contract_code', contract_code)
      .order('edp_number', { ascending: true });

    if (reportsError) throw reportsError;

    // 5. Obtener contract_tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('contract_tasks')
      .select('*')
      .eq('contract_id', contract.id)
      .order('task_number', { ascending: true });

    if (tasksError) throw tasksError;

    // 6. Preparar contexto para OpenAI
    const contractContext = `
INFORMACIÓN DEL CONTRATO:
- Código: ${contract.code}
- Título: ${contract.title}
- Valor: ${contract.contract_value || 'N/A'} ${contract.currency || ''}
- Estado: ${contract.status}
- Fecha inicio: ${contract.start_date || 'N/A'}
- Fecha fin: ${contract.end_date || 'N/A'}
- País: ${contract.country || 'N/A'}
- Mineral: ${contract.mineral || 'N/A'}

METADATA ADICIONAL:
${JSON.stringify(contract.metadata, null, 2)}
`;

    const edpsContext = paymentStates && paymentStates.length > 0 
      ? `
ESTADOS DE PAGO (EDPs):
Total de EDPs: ${paymentStates.length}

${paymentStates.map(edp => `
EDP N°${edp.edp_number}:
- Período: ${edp.period_label || 'N/A'} (${edp.period_start || 'N/A'} al ${edp.period_end || 'N/A'})
- Monto: ${edp.amount_uf} UF (${edp.amount_clp} CLP, tasa UF: ${edp.uf_rate})
- Estado: ${edp.status}
- Fecha aprobación: ${edp.approval_date || 'N/A'}
- Datos: ${JSON.stringify(edp.data, null, 2)}
`).join('\n')}
`
      : 'No hay EDPs procesados todavía.';

    const memorandumsContext = technicalReports && technicalReports.length > 0
      ? `
MEMORANDUMS TÉCNICOS:
Total de memorandums: ${technicalReports.length}

${technicalReports.map(memo => `
Memorandum EDP N°${memo.edp_number}:
- Período: ${memo.period || 'N/A'}
- Título: ${memo.report_title || 'N/A'}
- Actividades: ${memo.activities_summary || 'N/A'}
- Resultados: ${memo.results_summary || 'N/A'}
- Entregables: ${memo.deliverables_list ? JSON.stringify(memo.deliverables_list) : 'N/A'}
- Datos S-Curve: ${memo.s_curve_data ? JSON.stringify(memo.s_curve_data) : 'N/A'}
- Datos completos: ${JSON.stringify(memo.raw_data, null, 2)}
`).join('\n')}
`
      : 'No hay memorandums técnicos procesados todavía.';

    const tasksContext = tasks && tasks.length > 0
      ? `
TAREAS DEL CONTRATO:
${tasks.map(task => `
- ${task.task_number} ${task.task_name}: ${task.budget_uf} UF presupuesto, ${task.spent_uf || 0} UF gastado (${task.progress_percentage || 0}% progreso)
`).join('\n')}
`
      : 'No hay tareas registradas todavía.';

    // 7. Generar resumen ejecutivo con OpenAI
    const systemPrompt = `Eres un asistente especializado en análisis de contratos de minería chilenos.
Tu tarea es generar un resumen ejecutivo estructurado y completo basado en TODOS los datos extraídos de Estados de Pago (EDPs) y Memorandums Técnicos procesados por LlamaParse.

Debes crear un JSON con el siguiente formato:

{
  "contract_code": "código del contrato",
  "summary_version": "v2.0",
  "cards": [
    {
      "category": "General",
      "title": "Información General",
      "badges": ["Badge1", "Badge2"],
      "fields": {
        "mandante": "Nombre del mandante/cliente",
        "contratista": "Nombre del contratista",
        "administrador_contrato": "Nombre del administrador",
        "valor_total_uf": "Valor total en UF",
        "fecha_inicio": "Fecha de inicio",
        "fecha_termino": "Fecha de término",
        "duracion_dias": "Duración en días",
        "modalidad": "Tipo de contrato"
      }
    }
  ],
  "provenance": {
    "type": "legacy",
    "contract_file": "Fuente: EDPs y Memorandums procesados",
    "annexes": ["Lista de documentos procesados"]
  },
  "meta": {
    "confidence": 0.95,
    "source_pages": [],
    "last_updated": "2025-11-16",
    "notes": ["Notas adicionales"]
  }
}

CATEGORÍAS OBLIGATORIAS (debes generar TODAS):
1. "General" - Información básica del contrato consolidada de todos los documentos:
   - mandante, contratista, administrador_contrato
   - valor_total_uf, fecha_inicio, fecha_termino, duracion_dias, modalidad

2. "Legal y Administrativa" - Aspectos legales y administrativos:
   - tipo_contrato, legislacion_aplicable, forma_pago
   - garantias, multas_penalidades, reajustes
   - plazos_entrega, recepcion_trabajos

3. "Alcance Técnico" - Alcance y descripción técnica:
   - descripcion_servicios, objetivos_principales, metodologia
   - entregables_clave, ubicacion_faena, condiciones_trabajo
   - exclusiones_alcance

4. "Equipo y Experiencia" - Equipo y recursos:
   - profesional_cargo, equipo_trabajo, subcontratistas
   - experiencia_requerida, certificaciones

5. "Seguridad y Calidad" - Planes y requisitos:
   - plan_sso, plan_calidad, certificaciones_vigentes
   - capacitaciones_requeridas, estandares_aplicables
   - procedimientos_emergencia

CATEGORÍAS OPCIONALES (genera si hay información suficiente):
- "Programa y Avance" - Cronograma y progreso
- "KPIs" - Indicadores clave consolidados
- "Responsables" - Contactos y responsables
- "Cumplimiento" - Estado de cumplimiento
- "Controles Críticos" - Controles de riesgo
- "Gestión" - Aspectos de gestión del contrato

INSTRUCCIONES CRÍTICAS:
1. Consolida información de TODOS los EDPs y Memorandums
2. Si un campo no tiene información en los documentos, usa "No especificado" o "Pendiente"
3. SIEMPRE genera las 5 categorías obligatorias, incluso con datos parciales
4. Extrae KPIs financieros consolidados (total gastado, disponible, % avance)
5. Identifica actividades principales y resultados de los memorandums
6. Calcula tendencias de avance mes a mes
7. Identifica riesgos o alertas (sobrepresupuesto, retrasos, incumplimientos)
8. Usa datos exactos de los documentos, no inventes información
9. SOLO devuelve JSON válido, sin markdown ni texto adicional`;

    const userPrompt = `${contractContext}

${edpsContext}

${memorandumsContext}

${tasksContext}

Genera un resumen ejecutivo completo y profesional basado en toda esta información.`;

    console.log('📤 Llamando a OpenAI para generar resumen ejecutivo...');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ Error de OpenAI:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status} ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const generatedContent = openaiData.choices[0].message.content;

    console.log('📥 Respuesta de OpenAI recibida');

    // 8. Parsear el JSON generado
    let summaryJson;
    try {
      // Intentar extraer JSON si viene con markdown
      const jsonMatch = generatedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : generatedContent;
      summaryJson = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('❌ Error parseando JSON de OpenAI:', parseError);
      console.log('Contenido recibido:', generatedContent);
      throw new Error('Failed to parse OpenAI response as JSON');
    }

    // 9. Guardar o actualizar en contract_summaries
    const { data: existingSummary } = await supabase
      .from('contract_summaries')
      .select('id')
      .eq('contract_code', contract_code)
      .single();

    if (existingSummary) {
      // Actualizar
      const { error: updateError } = await supabase
        .from('contract_summaries')
        .update({
          summary_json: summaryJson,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSummary.id);

      if (updateError) throw updateError;
      console.log('✅ Resumen ejecutivo actualizado');
    } else {
      // Crear nuevo
      const { error: insertError } = await supabase
        .from('contract_summaries')
        .insert({
          contract_id: contract.id,
          contract_code: contract_code,
          summary_json: summaryJson,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) throw insertError;
      console.log('✅ Resumen ejecutivo creado');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: summaryJson,
        documents_analyzed: documents?.length || 0,
        edps_count: paymentStates?.length || 0,
        memos_count: technicalReports?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in generate-executive-summary:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
