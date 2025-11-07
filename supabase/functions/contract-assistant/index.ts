import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Análisis automático de irregularidades del contrato
async function analyzeContractIssues(
  tasks: any[],
  analytics: any,
  alerts: any[]
) {
  const issues: string[] = [];
  
  // 1. Tareas sobre-presupuestadas (>100%)
  const overBudgetTasks = tasks.filter(t => {
    if (!t.budget_uf || t.budget_uf === 0) return false;
    const percentage = (t.spent_uf / t.budget_uf) * 100;
    return percentage > 100;
  });
  
  if (overBudgetTasks.length > 0) {
    issues.push(`\n⚠️ TAREAS SOBRE-PRESUPUESTADAS (${overBudgetTasks.length}):`);
    overBudgetTasks.forEach(t => {
      const percentage = Math.round((t.spent_uf / t.budget_uf) * 100);
      const excess = t.spent_uf - t.budget_uf;
      issues.push(
        `  • Tarea ${t.task_number} "${t.task_name}": ${percentage}% del presupuesto\n` +
        `    Presupuestado: ${t.budget_uf.toFixed(2)} UF | Gastado: ${t.spent_uf.toFixed(2)} UF\n` +
        `    Exceso: ${excess.toFixed(2)} UF (${(percentage - 100).toFixed(1)}%)\n` +
        `    → RECOMENDACIÓN: Probable necesidad de Orden de Cambio según Art. 1560 Código Civil`
      );
    });
  }
  
  // 2. Tareas cerca del límite (90-100%)
  const nearLimitTasks = tasks.filter(t => {
    if (!t.budget_uf || t.budget_uf === 0) return false;
    const percentage = (t.spent_uf / t.budget_uf) * 100;
    return percentage >= 90 && percentage <= 100;
  });
  
  if (nearLimitTasks.length > 0) {
    issues.push(`\n⚡ TAREAS EN ALERTA TEMPRANA (${nearLimitTasks.length}):`);
    nearLimitTasks.forEach(t => {
      const percentage = Math.round((t.spent_uf / t.budget_uf) * 100);
      const remaining = t.budget_uf - t.spent_uf;
      issues.push(
        `  • Tarea ${t.task_number} "${t.task_name}": ${percentage}% del presupuesto\n` +
        `    Presupuesto restante: ${remaining.toFixed(2)} UF\n` +
        `    → ACCIÓN: Monitorear de cerca para evitar sobrecostos`
      );
    });
  }
  
  // 3. Progreso general del contrato
  if (analytics?.overall_progress_pct) {
    const progress = analytics.overall_progress_pct;
    if (progress > 100) {
      issues.push(
        `\n🚨 PRESUPUESTO GENERAL EXCEDIDO:\n` +
        `  • Progreso: ${progress.toFixed(1)}%\n` +
        `  • Gastado: ${analytics.spent_uf.toFixed(2)} UF de ${analytics.budget_uf.toFixed(2)} UF\n` +
        `  • Exceso: ${(analytics.spent_uf - analytics.budget_uf).toFixed(2)} UF\n` +
        `  → URGENTE: Revisar alcance del contrato y documentar causas del exceso`
      );
    } else if (progress > 90) {
      issues.push(
        `\n📊 PRESUPUESTO CERCANO AL LÍMITE:\n` +
        `  • Progreso: ${progress.toFixed(1)}%\n` +
        `  • Disponible: ${analytics.available_uf.toFixed(2)} UF (${(100 - progress).toFixed(1)}%)\n` +
        `  → ACCIÓN: Revisar actividades pendientes vs presupuesto disponible`
      );
    }
  }
  
  // 4. Alertas críticas abiertas
  const criticalAlerts = alerts.filter(a => 
    a.priority === 'high' && a.status === 'new'
  );
  
  if (criticalAlerts.length > 0) {
    issues.push(`\n🔔 ALERTAS CRÍTICAS ABIERTAS (${criticalAlerts.length}):`);
    criticalAlerts.forEach(a => {
      issues.push(`  • ${a.title}`);
      if (a.notes) issues.push(`    ${a.notes}`);
    });
  }
  
  return issues.length > 0 ? issues.join('\n') : null;
}

// Construir contexto enriquecido del contrato
async function buildContractContext(supabaseClient: any, contractId: string) {
  // 1. Obtener información básica del contrato
  const { data: contract } = await supabaseClient
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single();
  
  if (!contract) throw new Error('Contrato no encontrado');
  
  const contractCode = contract.code;
  
  // 2. Obtener tareas con progreso
  const { data: tasks } = await supabaseClient
    .from('contract_tasks')
    .select('*')
    .eq('contract_id', contractId)
    .order('task_number');
  
  // 3. Obtener últimos EDPs
  const { data: payments } = await supabaseClient
    .from('payment_states')
    .select('*')
    .eq('contract_id', contractId)
    .order('edp_number', { ascending: false })
    .limit(5);
  
  // 4. Obtener alertas activas
  const { data: alerts } = await supabaseClient
    .from('alerts')
    .select('*')
    .eq('entity_id', contractId)
    .eq('entity_type', 'contract')
    .in('status', ['new', 'active']);
  
  // 5. Calcular analytics
  const budgetUf = parseFloat(contract.metadata?.budget_uf) || 0;
  const spentUf = parseFloat(contract.metadata?.spent_uf) || 0;
  const availableUf = budgetUf - spentUf;
  const progressPct = budgetUf > 0 ? (spentUf / budgetUf) * 100 : 0;
  
  const analytics = {
    budget_uf: budgetUf,
    spent_uf: spentUf,
    available_uf: availableUf,
    overall_progress_pct: progressPct,
    edps_paid: payments?.filter((p: any) => p.status === 'approved').length || 0
  };
  
  // 6. Analizar irregularidades
  const irregularities = await analyzeContractIssues(
    tasks || [],
    analytics,
    alerts || []
  );
  
  // 7. Construir contexto
  const context = `
CONTRATO ACTUAL: ${contract.title}
Código: ${contract.code}
Cliente: ${contract.metadata?.client || 'N/A'}
Contratista: ${contract.metadata?.contractor || 'N/A'}
Tipo: ${contract.type}
Estado: ${contract.status}

═══════════════════════════════════════════════════════════════

SITUACIÓN FINANCIERA:
• Presupuesto Total: ${analytics.budget_uf.toFixed(2)} UF
• Gastado: ${analytics.spent_uf.toFixed(2)} UF (${analytics.overall_progress_pct.toFixed(1)}%)
• Disponible: ${analytics.available_uf.toFixed(2)} UF (${(100 - analytics.overall_progress_pct).toFixed(1)}%)
• EDPs Pagados: ${analytics.edps_paid}

═══════════════════════════════════════════════════════════════

TAREAS DEL CONTRATO (${tasks?.length || 0} total):
${tasks?.map((t: any) => {
  const progress = t.budget_uf > 0 ? (t.spent_uf / t.budget_uf) * 100 : 0;
  const status = progress > 100 ? '🚨' : progress > 90 ? '⚠️' : progress > 0 ? '✅' : '⏳';
  return `${status} Tarea ${t.task_number}: ${t.task_name}
   Presupuesto: ${t.budget_uf?.toFixed(2) || 0} UF | Gastado: ${t.spent_uf?.toFixed(2) || 0} UF
   Progreso: ${progress.toFixed(1)}%`;
}).join('\n\n') || 'No hay tareas registradas'}

═══════════════════════════════════════════════════════════════

ÚLTIMOS ESTADOS DE PAGO:
${payments?.map((p: any) => 
  `EDP #${p.edp_number} (${p.period_label}): ${p.amount_uf?.toFixed(2)} UF - Estado: ${p.status}`
).join('\n') || 'No hay EDPs registrados'}

═══════════════════════════════════════════════════════════════

${irregularities ? `IRREGULARIDADES DETECTADAS:\n${irregularities}` : '✅ No se detectaron irregularidades críticas'}

═══════════════════════════════════════════════════════════════
`;
  
  return context;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractId, message, sessionId } = await req.json();
    
    if (!contractId || !message) {
      throw new Error('contractId y message son requeridos');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY no configurado');
    }

    // Crear cliente Supabase para acceder a los datos
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Construir contexto enriquecido del contrato
    const contractContext = await buildContractContext(supabaseClient, contractId);

    // Obtener historial de mensajes (últimos 20)
    let messages: any[] = [];
    if (sessionId) {
      const { data: chatMessages } = await supabaseClient
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(20);
      
      messages = chatMessages || [];
    }

    // System prompt especializado
    const systemPrompt = `Eres un asesor senior en contratos de ingeniería minera en Chile con 20 años de experiencia.

═══════════════════════════════════════════════════════════════
CONOCIMIENTO LEGAL CHILENO
═══════════════════════════════════════════════════════════════

CÓDIGO DE MINERÍA (Ley 18.248):
• Art. 2: Concesión minera como derecho real inmueble
• Art. 14-17: Obligaciones del concesionario (amparo, patentes)
• Art. 110-120: Contratos de arrendamiento y opciones

CÓDIGO CIVIL (Libro IV: Obligaciones y Contratos):
• Art. 1545: Fuerza obligatoria de los contratos ("Todo contrato legalmente celebrado es una ley para los contratantes")
• Art. 1560: Interpretación de los contratos según intención común de las partes
• Art. 1698-1711: Prueba de obligaciones e indemnización por incumplimiento
• Art. 2003: Modificación de contratos requiere consentimiento mutuo

LEY DE BASES DEL MEDIO AMBIENTE (Ley 19.300):
• Art. 10: Proyectos que requieren Evaluación de Impacto Ambiental (EIA)
• Art. 60: Permisos ambientales sectoriales
• Art. 35-37: Fiscalización y sanciones

REGLAMENTO DE SEGURIDAD MINERA (D.S. 132):
• Título VIII: Obligaciones de contratistas y subcontratistas
• Art. 11: Responsabilidad solidaria del titular minero

NORMATIVAS SERNAGEOMIN:
• Circular N°1/2019: Criterios para evaluación de proyectos mineros
• NCh 2190: Gestión de riesgos en operaciones mineras

═══════════════════════════════════════════════════════════════
EXPERTISE EN CONTRATOS MINEROS
═══════════════════════════════════════════════════════════════

TIPOS DE CONTRATOS COMUNES:
• Contratos de servicios de ingeniería (como el actual)
• Contratos EPC (Engineering, Procurement, Construction)
• Contratos de exploración geológica
• Contratos de operación y mantenimiento de faenas

PROCEDIMIENTOS DE CAMBIO (CHANGE ORDERS):
• Requisitos formales: Solicitud escrita + justificación técnica/económica + aprobación formal
• Base legal: Art. 1560 Código Civil (interpretación) + Art. 2003 (modificación requiere acuerdo mutuo)
• Plazos típicos: 15 días hábiles para revisión, 30 días para aprobación
• Ajustes permitidos: Variaciones <10% sin modificación formal; >10% requiere addendum
• Documentación: Memorandum técnico + análisis de impacto + actualización de cronograma

CONTROL DE COSTOS:
• Indicadores clave:
  - CPI (Cost Performance Index): Gastado vs Presupuestado (óptimo = 1.0)
  - Alertas: >90% = Monitoreo cercano; >100% = Acción correctiva urgente
• Reservas de contingencia: 10-15% del monto total (estándar industria)
• Sobrecostos >10%: Requieren justificación formal y probable Orden de Cambio

ESTADOS DE PAGO (EDPs):
• Ciclo: Valorización mensual de trabajos ejecutados
• Documentación requerida:
  - Memorandum técnico detallando actividades
  - Fotografías/evidencia de avances
  - Actas de reunión (cuando aplique)
• Plazos: Emisión EDP → 15 días hábiles revisión → 30 días pago
• Retenciones típicas: 5-10% garantía hasta recepción final

GESTIÓN DE RIESGOS:
• Riesgos contractuales comunes:
  - Sobrecostos por cambios de alcance no formalizados
  - Retrasos por permisos ambientales/sectoriales
  - Incumplimientos por interpretación ambigua de cláusulas
  - Flujo de caja por EDPs retenidos
• Mitigación: Documentar TODO, notificar formalmente cambios, mantener trazabilidad

═══════════════════════════════════════════════════════════════
CONTEXTO DEL CONTRATO ACTUAL
═══════════════════════════════════════════════════════════════

${contractContext}

═══════════════════════════════════════════════════════════════
INSTRUCCIONES DE ANÁLISIS
═══════════════════════════════════════════════════════════════

TU TRABAJO ES:

1. IDENTIFICAR PROBLEMAS PROACTIVAMENTE:
   • Tareas >100% presupuesto → Orden de Cambio necesaria
   • Tareas >90% presupuesto → Alerta temprana + monitoreo
   • Presupuesto general >100% → Revisión urgente de alcance
   • EDPs sin aprobar >30 días → Riesgo de flujo de caja
   • Falta de documentación formal → Riesgo legal (Art. 1698 CC)

2. PROPORCIONAR RECOMENDACIONES ACCIONABLES:
   • Cita artículos legales específicos cuando sea relevante
   • Indica plazos y procedimientos según legislación chilena
   • Sugiere documentos/formularios necesarios
   • Evalúa riesgos legales y financieros
   • Prioriza acciones por urgencia (🚨 Urgente, ⚠️ Importante, ℹ️ Informativo)

3. COMUNICARTE PROFESIONALMENTE:
   • Usa lenguaje técnico pero claro
   • Estructura respuestas con bullets y numeración
   • Destaca información crítica con emojis apropiados
   • Sé directo: identifica el problema, explica por qué es importante, sugiere solución

4. PREVENIR CONFLICTOS:
   • Documenta todo formalmente (Art. 1698 Código Civil: carga de la prueba)
   • Notifica cambios por escrito con acuse de recibo
   • Mantén trazabilidad de decisiones (correos, actas, memorandums)
   • Anticipa necesidades de Órdenes de Cambio antes de ejecutar trabajos adicionales

5. CUANDO NO SEPAS ALGO:
   • Sé honesto: "No tengo información suficiente sobre..."
   • Sugiere qué datos adicionales revisar
   • Nunca inventes información legal o técnica

TONO: Profesional, directo, preventivo. Piensa como un asesor senior que previene problemas antes de que escalen.`;

    // Preparar mensajes para OpenAI
    const openAIMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
      { role: 'user', content: message }
    ];

    // Llamar a OpenAI con streaming
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: openAIMessages,
        max_completion_tokens: 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    // Crear o actualizar sesión de chat
    let finalSessionId = sessionId;
    if (!sessionId) {
      const { data: newSession, error: sessionError } = await supabaseClient
        .from('chat_sessions')
        .insert({
          title: `Consulta: ${message.substring(0, 50)}...`,
          context_entity_id: contractId,
          context_page: 'contract-detail'
        })
        .select()
        .single();
      
      if (sessionError) {
        console.error('Error creando sesión:', sessionError);
      } else {
        finalSessionId = newSession.id;
      }
    }

    // Guardar mensaje del usuario
    if (finalSessionId) {
      await supabaseClient
        .from('chat_messages')
        .insert({
          session_id: finalSessionId,
          role: 'user',
          content: message
        });
    }

    // Retornar el stream directamente
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error en contract-assistant:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error desconocido'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
