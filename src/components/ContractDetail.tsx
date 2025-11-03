import { useState } from "react";
import { ArrowLeft, FileText, TrendingUp, Calendar, Users, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentUploadDialog } from "@/components/DocumentUploadDialog";
import { useContractDocuments } from "@/hooks/useDocuments";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ContractDetailProps {
  contractId: string;
  onBack: () => void;
}

export const ContractDetail = ({ contractId, onBack }: ContractDetailProps) => {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const { data: documents } = useContractDocuments(contractId);
  // Mock data for S-curve
  const progressData = [
    { month: "Jul", planned: 5, actual: 5 },
    { month: "Ago", planned: 15, actual: 0 },
    { month: "Sep", planned: 30, actual: 0 },
    { month: "Oct", planned: 50, actual: 0 },
    { month: "Nov", planned: 70, actual: 0 },
    { month: "Dic", planned: 90, actual: 0 },
    { month: "Ene", planned: 100, actual: 0 },
  ];

  const tasks = [
    { name: "Recopilación y análisis de información", budget: 507, spent: 147.85, progress: 29 },
    { name: "Visita a terreno", budget: 216, spent: 0, progress: 0 },
    { name: "Actualización del estudio hidrológico", budget: 863, spent: 50.31, progress: 6 },
    { name: "Revisión experta del Modelo Hidrogeológico", budget: 256, spent: 0, progress: 0 },
    { name: "Actualización y calibración del MN", budget: 843, spent: 0, progress: 0 },
    { name: "Análisis de condiciones desfavorables", budget: 213, spent: 0, progress: 0 },
    { name: "Simulaciones predictivas", budget: 423, spent: 0, progress: 0 },
    { name: "Asesoría Técnica y Análisis", budget: 580, spent: 0, progress: 0 },
    { name: "Reuniones y presentaciones", budget: 386, spent: 11.66, progress: 3 },
    { name: "Costos Administración (5%)", budget: 214, spent: 0, progress: 0 },
  ];

  const team = [
    { name: "José Luis Delgado", role: "Líder de Proyecto", specialty: "Hidrogeólogo Principal" },
    { name: "Martin Brown", role: "Hidrogeólogo Principal", specialty: "Ing. Civil Hidráulico" },
    { name: "Isidora Arriagada", role: "Consultor Senior", specialty: "Geóloga, MsC." },
    { name: "Macarena Casanova", role: "Consultor Senior", specialty: "Ing. Civil Minas" },
    { name: "Manuel Gutiérrez", role: "Consultor", specialty: "Ing. Civil Hidráulica" },
  ];

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
              AIPD-CSI001-1000-MN-0001
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
            <div className="text-5xl font-bold text-gradient mb-1">5%</div>
            <p className="text-sm text-muted-foreground">Avance Total</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6">
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Presupuesto Total</p>
            <p className="text-2xl font-bold">4,501 UF</p>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Gastado</p>
            <p className="text-2xl font-bold text-primary">209.81 UF</p>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Disponible</p>
            <p className="text-2xl font-bold text-success">4,291.19 UF</p>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">EDPs Pagados</p>
            <p className="text-2xl font-bold">1 de 10</p>
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
              {tasks.map((task, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{task.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        {task.spent.toFixed(2)} / {task.budget} UF
                      </span>
                      <Badge variant={task.progress > 0 ? "default" : "secondary"}>
                        {task.progress}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={task.progress} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="border-transparent shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Documentos del Contrato</CardTitle>
              <Button onClick={() => setShowUploadDialog(true)} size="sm" className="gap-2">
                <Upload className="w-4 h-4" />
                Cargar Documento
              </Button>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium">{doc.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString('es-CL')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{doc.doc_type}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No hay documentos cargados. Haz clic en "Cargar Documento" para agregar uno.
                </p>
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

      <DocumentUploadDialog 
        open={showUploadDialog} 
        onOpenChange={setShowUploadDialog}
        preSelectedContractId={contractId}
      />
    </div>
  );
};
