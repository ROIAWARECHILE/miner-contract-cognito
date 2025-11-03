import { ArrowLeft, FileText, TrendingUp, Calendar, Users, AlertCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useContract, useContractTasks, useSLAAlerts } from "@/hooks/useContract";
import { DocumentUploadDialog } from "@/components/DocumentUploadDialog";
import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ContractDetailProps {
  contractId: string;
  onBack: () => void;
}

export const ContractDetail = ({ contractId, onBack }: ContractDetailProps) => {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { data: contract, isLoading, error } = useContract(contractId);
  const { data: tasks } = useContractTasks(contractId);
  const { data: alerts } = useSLAAlerts(contractId);

  // Calculate progress and budget from tasks
  const totalBudget = Number(contract?.contract_value) || 0;
  const totalProgress = contract?.risk_score || 0;
  const totalSpent = totalBudget * (totalProgress / 100);

  // Generate S-curve data from contract dates
  const generateProgressData = () => {
    if (!contract?.start_date || !contract?.end_date) {
      return [{ month: "Hoy", planned: totalProgress, actual: totalProgress }];
    }
    
    const start = new Date(contract.start_date);
    const end = new Date(contract.end_date);
    const now = new Date();
    
    const months = [];
    let current = new Date(start);
    
    while (current <= end) {
      const monthName = format(current, "MMM", { locale: es });
      const monthProgress = Math.min(100, ((current.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100);
      const actualProgress = current <= now ? Math.min(monthProgress, totalProgress) : 0;
      
      months.push({
        month: monthName,
        planned: Math.round(monthProgress),
        actual: Math.round(actualProgress),
      });
      
      current.setMonth(current.getMonth() + 1);
    }
    
    return months.length > 0 ? months : [{ month: "Hoy", planned: totalProgress, actual: totalProgress }];
  };

  const progressData = generateProgressData();

  // Team mock data (since team_members table has no data yet)
  const team = [
    { name: "José Luis Delgado", role: "Líder de Proyecto", specialty: "Hidrogeólogo Principal" },
    { name: "Martin Brown", role: "Hidrogeólogo Principal", specialty: "Ing. Civil Hidráulico" },
    { name: "Isidora Arriagada", role: "Consultor Senior", specialty: "Geóloga, MsC." },
    { name: "Macarena Casanova", role: "Consultor Senior", specialty: "Ing. Civil Minas" },
    { name: "Manuel Gutiérrez", role: "Consultor", specialty: "Ing. Civil Hidráulica" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-500">
        <Button variant="ghost" onClick={onBack} className="gap-2 mb-2">
          <ArrowLeft className="w-4 h-4" />
          Volver al Dashboard
        </Button>
        <Skeleton className="h-64 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-500">
        <Button variant="ghost" onClick={onBack} className="gap-2 mb-2">
          <ArrowLeft className="w-4 h-4" />
          Volver al Dashboard
        </Button>
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-3">
            <AlertCircle className="w-16 h-16 mx-auto text-destructive" />
            <h3 className="text-xl font-semibold">No se pudo cargar el contrato</h3>
            <p className="text-muted-foreground">
              El contrato solicitado no existe o hubo un error al cargarlo
            </p>
          </div>
        </div>
      </div>
    );
  }

  const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
  const totalTasks = tasks?.length || 0;

  return (
    <>
      <DocumentUploadDialog 
        open={uploadDialogOpen} 
        onOpenChange={setUploadDialogOpen}
        contractId={contractId}
      />
      <div className="space-y-6 animate-in slide-in-from-right duration-500">
        {/* Back Button */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={onBack}
            className="gap-2 mb-2 hover:-translate-x-1 transition-spring"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Dashboard
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={() => setUploadDialogOpen(true)}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Cargar Documento
          </Button>
        </div>

      {/* Contract Header */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 rounded-2xl p-8 border border-primary/20 shadow-lg">
        <div className="flex items-start justify-between mb-6">
          <div>
            <Badge variant="secondary" className="font-mono mb-3">
              {contract.code}
            </Badge>
            <h1 className="text-3xl font-bold mb-2">
              {contract.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {contract.start_date && (
                <>
                  <span>Inicio: {format(new Date(contract.start_date), "dd MMM yyyy", { locale: es })}</span>
                  <span>•</span>
                </>
              )}
              {contract.end_date && (
                <span>Fin: {format(new Date(contract.end_date), "dd MMM yyyy", { locale: es })}</span>
              )}
              {contract.mineral && (
                <>
                  <span>•</span>
                  <span>{contract.mineral}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold text-gradient mb-1">{totalProgress}%</div>
            <p className="text-sm text-muted-foreground">Avance Total</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6">
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Presupuesto Total</p>
            <p className="text-2xl font-bold">{totalBudget.toLocaleString('es-CL')} {contract.currency || 'UF'}</p>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Gastado</p>
            <p className="text-2xl font-bold text-primary">{totalSpent.toLocaleString('es-CL', { maximumFractionDigits: 2 })} {contract.currency || 'UF'}</p>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Disponible</p>
            <p className="text-2xl font-bold text-success">{(totalBudget - totalSpent).toLocaleString('es-CL', { maximumFractionDigits: 2 })} {contract.currency || 'UF'}</p>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Tareas Completadas</p>
            <p className="text-2xl font-bold">{completedTasks} de {totalTasks}</p>
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
                <AreaChart data={progressData}>
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
              {!tasks || tasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No hay tareas registradas para este contrato
                </p>
              ) : (
                tasks.map((task) => {
                  const taskProgress = task.status === 'completed' ? 100 : 
                                     task.status === 'in_progress' ? 50 : 0;
                  
                  return (
                    <div key={task.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{task.description}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground capitalize">
                            {task.type}
                          </span>
                          <Badge variant={taskProgress > 0 ? "default" : "secondary"}>
                            {task.status}
                          </Badge>
                        </div>
                      </div>
                      <Progress value={taskProgress} className="h-2" />
                      {task.due_date && (
                        <p className="text-xs text-muted-foreground">
                          Vence: {format(new Date(task.due_date), "dd MMM yyyy", { locale: es })}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="border-transparent shadow-md">
            <CardHeader>
              <CardTitle>Documentos del Contrato</CardTitle>
            </CardHeader>
            <CardContent>
              {!tasks || tasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No hay documentos cargados para este contrato
                </p>
              ) : (
                <div className="space-y-3">
                  {tasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{task.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.created_at && format(new Date(task.created_at), "dd MMM yyyy - HH:mm", { locale: es })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{task.type}</Badge>
                    </div>
                  ))}
                </div>
              )}
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
    </>
  );
};
