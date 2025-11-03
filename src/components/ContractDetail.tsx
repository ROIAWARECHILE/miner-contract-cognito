import { ArrowLeft, FileText, TrendingUp, Calendar, Users, Download } from "lucide-react";
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

interface ContractDetailProps {
  contractId: string;
  onBack: () => void;
}

const CONTRACT_CODE = "AIPD-CSI001-1000-MN-0001";

export const ContractDetail = ({ contractId, onBack }: ContractDetailProps) => {
  const { data: analytics, isLoading: analyticsLoading } = useContractAnalytics(CONTRACT_CODE);
  const { data: tasks = [], isLoading: tasksLoading } = useContractTasks(CONTRACT_CODE);
  const { data: payments = [], isLoading: paymentsLoading } = usePaymentStates(CONTRACT_CODE);
  const { data: documents = [] } = useContractDocuments(contractId);
  
  const handleDownload = async (path: string) => {
    try {
      await downloadDocument(path);
      toast.success('Documento descargado');
    } catch (error) {
      toast.error('Error al descargar documento');
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
          <div className="text-right">
            <div className="text-5xl font-bold text-gradient mb-1">
              {analytics?.overall_progress_pct.toFixed(0)}%
            </div>
            <p className="text-sm text-muted-foreground">Avance Total</p>
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
                      <span className="font-medium">{task.task_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">
                          {task.spent_uf.toFixed(2)} / {task.budget_uf} UF
                        </span>
                        <Badge variant={task.progress_percentage > 0 ? "default" : "secondary"}>
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
                        <p className="text-xs text-muted-foreground">
                          {doc.doc_type} • {(doc.file_size / 1024).toFixed(0)} KB • {new Date(doc.created_at).toLocaleDateString('es-CL')}
                        </p>
                        {doc.processing_status && (
                          <Badge variant={doc.processing_status === 'completed' ? 'default' : 'secondary'} className="mt-1">
                            {doc.processing_status}
                          </Badge>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleDownload(doc.file_url)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
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
              <CardTitle>EDPs Procesados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {payments.length > 0 ? (
                  payments.map((edp: any) => (
                    <div key={edp.edp_number} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">EDP N°{edp.edp_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {edp.period_label} • {edp.amount_uf} UF
                        </p>
                      </div>
                      <Badge variant={edp.status === 'approved' ? 'default' : 'secondary'}>
                        {edp.status}
                      </Badge>
                    </div>
                  ))
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
