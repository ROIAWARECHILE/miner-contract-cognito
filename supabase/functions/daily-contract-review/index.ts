import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContractIssue {
  type: 'over_budget' | 'near_limit' | 'critical_alert' | 'budget_exceeded';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  taskNumber?: string;
}

// Analizar irregularidades de un contrato
async function analyzeContract(supabaseClient: any, contract: any): Promise<ContractIssue[]> {
  const issues: ContractIssue[] = [];
  
  // Obtener tareas del contrato
  const { data: tasks } = await supabaseClient
    .from('contract_tasks')
    .select('*')
    .eq('contract_id', contract.id);
  
  if (!tasks) return issues;
  
  // 1. Detectar tareas sobre-presupuestadas
  tasks.forEach((task: any) => {
    if (!task.budget_uf || task.budget_uf === 0) return;
    
    const percentage = (task.spent_uf / task.budget_uf) * 100;
    
    if (percentage > 100) {
      issues.push({
        type: 'over_budget',
        severity: 'high',
        title: `Tarea ${task.task_number} sobre-presupuestada`,
        description: `La tarea "${task.task_name}" ha gastado ${task.spent_uf.toFixed(2)} UF de ${task.budget_uf.toFixed(2)} UF presupuestados (${percentage.toFixed(1)}%). Se requiere una Orden de Cambio.`,
        taskNumber: task.task_number
      });
    } else if (percentage >= 90) {
      issues.push({
        type: 'near_limit',
        severity: 'medium',
        title: `Tarea ${task.task_number} cerca del límite`,
        description: `La tarea "${task.task_name}" está al ${percentage.toFixed(1)}% del presupuesto. Quedan ${(task.budget_uf - task.spent_uf).toFixed(2)} UF disponibles.`,
        taskNumber: task.task_number
      });
    }
  });
  
  // 2. Verificar presupuesto general
  const budgetUf = parseFloat(contract.metadata?.budget_uf) || 0;
  const spentUf = parseFloat(contract.metadata?.spent_uf) || 0;
  
  if (budgetUf > 0) {
    const overallProgress = (spentUf / budgetUf) * 100;
    
    if (overallProgress > 100) {
      issues.push({
        type: 'budget_exceeded',
        severity: 'high',
        title: 'Presupuesto general excedido',
        description: `El contrato ha gastado ${spentUf.toFixed(2)} UF de ${budgetUf.toFixed(2)} UF presupuestados (${overallProgress.toFixed(1)}%). Exceso: ${(spentUf - budgetUf).toFixed(2)} UF.`
      });
    }
  }
  
  // 3. Verificar alertas críticas abiertas
  const { data: alerts } = await supabaseClient
    .from('alerts')
    .select('*')
    .eq('entity_id', contract.id)
    .eq('entity_type', 'contract')
    .eq('priority', 'high')
    .eq('status', 'new');
  
  if (alerts && alerts.length > 0) {
    issues.push({
      type: 'critical_alert',
      severity: 'high',
      title: `${alerts.length} alerta(s) crítica(s) sin resolver`,
      description: `Hay ${alerts.length} alerta(s) crítica(s) que requieren atención inmediata en este contrato.`
    });
  }
  
  return issues;
}

// Calcular prioridad de la alerta
function calculatePriority(issues: ContractIssue[]): 'high' | 'medium' | 'low' {
  const highSeverityCount = issues.filter(i => i.severity === 'high').length;
  
  if (highSeverityCount > 0) return 'high';
  if (issues.length > 2) return 'medium';
  return 'low';
}

// Formatear reporte de irregularidades
function formatIssuesReport(issues: ContractIssue[]): string {
  if (issues.length === 0) return 'No se detectaron irregularidades';
  
  let report = `Se detectaron ${issues.length} irregularidad(es):\n\n`;
  
  issues.forEach((issue, index) => {
    const emoji = issue.severity === 'high' ? '🚨' : issue.severity === 'medium' ? '⚠️' : 'ℹ️';
    report += `${emoji} ${index + 1}. ${issue.title}\n${issue.description}\n\n`;
  });
  
  return report;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔍 Iniciando revisión diaria de contratos...');

    // Obtener todos los contratos activos
    const { data: contracts, error: contractsError } = await supabaseClient
      .from('contracts')
      .select('*')
      .in('status', ['active', 'in_progress']);

    if (contractsError) throw contractsError;
    
    if (!contracts || contracts.length === 0) {
      console.log('No hay contratos activos para revisar');
      return new Response(
        JSON.stringify({ message: 'No hay contratos activos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Revisando ${contracts.length} contrato(s)...`);

    let alertsCreated = 0;
    let contractsWithIssues = 0;

    // Analizar cada contrato
    for (const contract of contracts) {
      console.log(`🔎 Analizando contrato: ${contract.code}`);
      
      const issues = await analyzeContract(supabaseClient, contract);
      
      if (issues.length > 0) {
        contractsWithIssues++;
        
        // Crear alerta en la tabla alerts
        const { error: alertError } = await supabaseClient
          .from('alerts')
          .insert({
            entity_type: 'contract',
            entity_id: contract.id,
            title: `⚠️ Revisión diaria: ${issues.length} irregularidad(es) detectada(s)`,
            status: 'new',
            priority: calculatePriority(issues),
            alert_date: new Date().toISOString().split('T')[0],
            notes: formatIssuesReport(issues)
          });

        if (alertError) {
          console.error(`Error al crear alerta para ${contract.code}:`, alertError);
        } else {
          alertsCreated++;
          console.log(`✅ Alerta creada para ${contract.code}`);
        }
      } else {
        console.log(`✅ ${contract.code}: Sin irregularidades`);
      }
    }

    const summary = {
      contracts_reviewed: contracts.length,
      contracts_with_issues: contractsWithIssues,
      alerts_created: alertsCreated,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Revisión completada:', summary);

    return new Response(
      JSON.stringify(summary),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error en daily-contract-review:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error desconocido'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
