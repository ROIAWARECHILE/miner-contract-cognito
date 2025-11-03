import { ArrowLeft, FileText, TrendingUp, Calendar, Users, Download, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useContractAnalytics, useContractTasks, usePaymentStates } from "@/hooks/useContractData";
import { useContractDocuments, downloadDocument } from "@/hooks/useContractDocuments";
import { useRealtimeContract } from "@/hooks/useRealtimeContract";
import { supabase } from "@/integrations/supabase/client";

interface ContractDetailProps {
  contractId: string;
  onBack: () => void;
}

const CONTRACT_CODE = "AIPD-CSI001-1000-MN-0001";

export const ContractDetail = ({ contractId, onBack }: ContractDetailProps) => {
  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useContractAnalytics(CONTRACT_CODE);
  const { data: tasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useContractTasks(CONTRACT_CODE);
  const { data: payments = [], isLoading: paymentsLoading, refetch: refetchPayments } = usePaymentStates(CONTRACT_CODE);
  const { data: documents = [] } = useContractDocuments(contractId);
  
  // Enable real-time updates
  useRealtimeContract(CONTRACT_CODE);
  
  // Sistema de colores para porcentajes de progreso
  const getProgressBadgeVariant = (percentage: number): "destructive" | "warning" | "default" | "secondary" => {
    if (percentage >= 100) return "destructive"; // Rojo - sobre-presupuesto
    if (percentage >= 80) return "warning"; // Amarillo - advertencia
    if (percentage > 0) return "default"; // Azul - progreso normal
    return "secondary"; // Gris - sin progreso
  };
  
  const handleDownload = async (path: string) => {
    try {
      await downloadDocument(path);
      toast.success('Documento descargado');
    } catch (error) {
      toast.error('Error al descargar documento');
    }
  };

  const handleDeleteEDP = async (documentId: string, edpNumber: number) => {
    try {
      // 1. Obtener el EDP completo con sus tareas
      const { data: edp, error: fetchError } = await supabase
        .from('payment_states')
        .select('*')
        .eq('contract_id', contractId)
        .eq('edp_number', edpNumber)
        .single();

      if (fetchError) throw fetchError;
      if (!edp) throw new Error('EDP no encontrado');

      const tasksExecuted = (edp.data as any)?.tasks_executed || [];
      const tasksCount = tasksExecuted.length;

      // Mostrar confirmación detallada
      if (!confirm(
        `¿Estás seguro de eliminar el EDP #${edpNumber}?\n\n` +
        `Esta acción eliminará:\n` +
        `✗ Estado de pago (${edp.amount_uf} UF)\n` +
        `✗ Datos de ${tasksCount} tarea${tasksCount !== 1 ? 's' : ''} ejecutada${tasksCount !== 1 ? 's' : ''}\n` +
        `✗ Documento PDF asociado\n` +
        `✗ Recalculará todas las métricas del contrato\n\n` +
        `⚠️ Esta acción NO se puede deshacer.`
      )) {
        return;
      }

      // 2. Restar spent_uf de cada tarea en contract_tasks
      for (const task of tasksExecuted) {
        const { error: subtractError } = await supabase.rpc('subtract_task_spent', {
          p_contract_id: contractId,
          p_task_number: task.task_number,
          p_amount_to_subtract: parseFloat(task.spent_uf) || 0
        });

        if (subtractError) {
          console.error(`Error al restar tarea ${task.task_number}:`, subtractError);
          throw subtractError;
        }
      }

      // 3. Eliminar el documento asociado
      const { error: docError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (docError) throw docError;

      // 4. Eliminar el payment_state
      const { error: edpError } = await supabase
        .from('payment_states')
        .delete()
        .eq('id', edp.id);

      if (edpError) throw edpError;

      // 5. Refrescar métricas del contrato
      await supabase.rpc('refresh_contract_metrics', { contract_code: CONTRACT_CODE });

      // 6. Refrescar datos en la UI
      await Promise.all([
        refetchAnalytics(),
        refetchTasks(),
        refetchPayments()
      ]);

      toast.success(`✓ EDP #${edpNumber} eliminado correctamente`);
    } catch (error) {
      console.error('Error deleting EDP:', error);
      toast.error('Error al eliminar EDP: ' + (error as Error).message);
    }
  };

  const handleRefreshMetrics = async () => {
    try {
      const { error } = await supabase.rpc('refresh_contract_metrics', {
        contract_code: CONTRACT_CODE
      });
      if (error) throw error;
      toast.success('Métricas actualizadas correctamente');
      // Refrescar datos
      refetchAnalytics();
      refetchTasks();
    } catch (error) {
      console.error('Error refreshing metrics:', error);
      toast.error('Error al actualizar métricas');
    }
  };

  // S-curve data (mock plan + real from payments)
  const sCurveData = [
    { month: "Jul", planned: 5, actual: analytics?.overall_progress_pct || 5 },
    { month: "Ago", planned: 15, actual: 0 },
    { month: "Sep", planned: 30, actual: 0 },
    { month: "Oct", planned: 50, actual: 0 },
    { month: "Nov", planned: 70, actual: 0 },
    { month: "Dic", planned: 90, actual: 0 },
    { month: "Ene", planned: 100, actual: 0 },
  ];

  const team = [
    { name: "José Luis Delgado", role: "Líder de Proyecto", specialty: "Hidrogeólogo Principal" },
    { name: "Martin Brown", role: "Hidrogeólogo Principal", specialty: "Ing. Civil Hidráulico" },
    { name: "Isidora Arriagada", role: "Consultor Senior", specialty: "Geóloga, MsC." },
    { name: "Macarena Casanova", role: "Consultor Senior", specialty: "Ing. Civil Minas" },
    { name: "Manuel Gutiérrez", role: "Consultor", specialty: "Ing. Civil Hidráulica" },
  ];

  if (analyticsLoading || tasksLoading || paymentsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Cargando datos del contrato...</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">No se encontraron datos para este contrato</p>
          <Button onClick={onBack} variant="outline">Volver al Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-500">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="gap-2 mb-2 hover:-translate-x-1 transition-spring"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al Dashboard
      </Button>

      {/* Contract Header */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 rounded-2xl p-8 border border-primary/20 shadow-lg">
        <div className="flex items-start justify-between mb-6">
          <div>
            <Badge variant="secondary" className="font-mono mb-3">
              {CONTRACT_CODE}
            </Badge>
            <h1 className="text-3xl font-bold mb-2">
              Estudio Hidrológico e Hidrogeológico Proyecto Dominga
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Andes Iron SpA</span>
              <span>•</span>
              <span>Itasca Chile SpA</span>
              <span>•</span>
              <span>Inicio: 21 Jul 2025</span>
            </div>
          </div>
          <div className="text-right space-y-3">
            <div className="text-5xl font-bold text-gradient mb-1">
              {analytics?.overall_progress_pct.toFixed(0)}%
            </div>
            <p className="text-sm text-muted-foreground">Avance Total</p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefreshMetrics}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar Métricas
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6">
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Presupuesto Total</p>
            <p className="text-2xl font-bold">{analytics?.total_budget_uf.toLocaleString()} UF</p>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Gastado</p>
            <p className="text-2xl font-bold text-primary">{analytics?.spent_uf.toFixed(2)} UF</p>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Disponible</p>
            <p className="text-2xl font-bold text-success">{analytics?.available_uf.toFixed(2)} UF</p>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">EDPs Pagados</p>
            <p className="text-2xl font-bold">
              {payments.filter(p => p.status === 'approved').length} de {payments.length || 10}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="progress" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="progress" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Progreso
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="w-4 h-4" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="w-4 h-4" />
            Equipo
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <Calendar className="w-4 h-4" />
            Cronograma
          </TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-6">
          {/* S-Curve */}
          <Card className="border-transparent shadow-md">
            <CardHeader>
              <CardTitle>Curva S - Progreso del Contrato</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={sCurveData}>
                  <defs>
                    <linearGradient id="planned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="actual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Area
                    type="monotone"
                    dataKey="planned"
                    stroke="hsl(var(--primary))"
                    fill="url(#planned)"
                    strokeWidth={2}
                    name="Planificado"
                  />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke="hsl(var(--accent))"
                    fill="url(#actual)"
                    strokeWidth={2}
                    name="Real"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tasks Breakdown */}
          <Card className="border-transparent shadow-md">
            <CardHeader>
              <CardTitle>Avance por Tarea</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <div key={task.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        <span className="font-mono text-primary">{task.task_number}</span> - {task.task_name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">
                          {task.spent_uf.toFixed(2)} / {task.budget_uf} UF
                        </span>
                        <Badge variant={getProgressBadgeVariant(task.progress_percentage)}>
                          {task.progress_percentage}%
                        </Badge>
                      </div>
                    </div>
                    <Progress value={task.progress_percentage} className="h-2" />
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No hay tareas registradas aún
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card className="border-transparent shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos Cargados ({documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {documents.length > 0 ? (
                  documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium">{doc.filename}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Badge variant="outline" className="text-xs">
                            {doc.doc_type}
                          </Badge>
                          <span>•</span>
                          <span>{(doc.file_size / 1024).toFixed(0)} KB</span>
                          <span>•</span>
                          <span>{new Date(doc.created_at).toLocaleDateString('es-CL')}</span>
                          {doc.processing_status && (
                            <>
                              <span>•</span>
                              <Badge 
                                variant={
                                  doc.processing_status === 'completed' ? 'default' : 
                                  doc.processing_status === 'failed' ? 'destructive' : 
                                  'secondary'
                                } 
                                className="text-xs"
                              >
                                {doc.processing_status === 'completed' ? '✓ Procesado' : 
                                 doc.processing_status === 'failed' ? '✗ Error' : 
                                 '⏳ Procesando'}
                              </Badge>
                            </>
                          )}
                        </div>
                        {doc.extracted_data?.edp_number && (
                          <p className="text-xs text-primary mt-1">
                            EDP #{doc.extracted_data.edp_number}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDownload(doc.file_url)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {doc.extracted_data?.edp_number && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteEDP(doc.id, doc.extracted_data.edp_number)}
                          >
                            🗑️
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay documentos cargados
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-transparent shadow-md">
            <CardHeader>
              <CardTitle>Historial de EDPs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {payments.length > 0 ? (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="p-3 text-sm font-medium text-muted-foreground">N° EDP</th>
                        <th className="p-3 text-sm font-medium text-muted-foreground">Período</th>
                        <th className="p-3 text-sm font-medium text-muted-foreground text-right">Monto UF</th>
                        <th className="p-3 text-sm font-medium text-muted-foreground text-right">Valor UF</th>
                        <th className="p-3 text-sm font-medium text-muted-foreground text-right">Monto CLP</th>
                        <th className="p-3 text-sm font-medium text-muted-foreground text-center">Estado</th>
                        <th className="p-3 text-sm font-medium text-muted-foreground text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((edp: any) => (
                        <tr key={edp.edp_number} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                          <td className="p-3">
                            <span className="font-semibold">EDP #{edp.edp_number}</span>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {edp.period_label}
                          </td>
                          <td className="p-3 text-right font-mono">
                            {typeof edp.amount_uf === 'number' ? edp.amount_uf.toFixed(2) : edp.amount_uf} UF
                          </td>
                          <td className="p-3 text-right text-sm text-muted-foreground">
                            ${typeof edp.uf_rate === 'number' ? edp.uf_rate.toLocaleString('es-CL') : edp.uf_rate}
                          </td>
                          <td className="p-3 text-right font-mono">
                            ${typeof edp.amount_clp === 'number' ? edp.amount_clp.toLocaleString('es-CL') : edp.amount_clp}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant={edp.status === 'approved' ? 'default' : 'secondary'}>
                              {edp.status === 'approved' ? 'Aprobado' : edp.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                // Buscar el documento asociado a este EDP
                                const doc = documents.find((d: any) => d.extracted_data?.edp_number === edp.edp_number);
                                if (doc) {
                                  handleDeleteEDP(doc.id, edp.edp_number);
                                } else {
                                  toast.error('No se encontró el documento asociado a este EDP');
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {payments.length > 1 && (
                        <tr className="bg-muted/30 font-semibold">
                          <td colSpan={2} className="p-3">Total Acumulado</td>
                          <td className="p-3 text-right font-mono">
                            {payments.reduce((sum: number, edp: any) => 
                              sum + (typeof edp.amount_uf === 'number' ? edp.amount_uf : 0), 0
                            ).toFixed(2)} UF
                          </td>
                          <td className="p-3"></td>
                          <td className="p-3 text-right font-mono">
                            ${payments.reduce((sum: number, edp: any) => 
                              sum + (typeof edp.amount_clp === 'number' ? edp.amount_clp : 0), 0
                            ).toLocaleString('es-CL')}
                          </td>
                          <td className="p-3"></td>
                          <td className="p-3"></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay EDPs procesados
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card className="border-transparent shadow-md">
            <CardHeader>
              <CardTitle>Equipo de Proyecto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {team.map((member, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground font-bold">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{member.name}</h4>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                      <p className="text-xs text-muted-foreground mt-1">{member.specialty}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="border-transparent shadow-md">
            <CardHeader>
              <CardTitle>Cronograma</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Cronograma y próximas entregas...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
