import { ArrowLeft, FileText, TrendingUp, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useContract, useContractProgress, useContractDocuments, useCompany } from "@/hooks/useContract";
import { format } from "date-fns";

interface ContractDetailProps {
  contractId: string;
  onBack: () => void;
}

export const ContractDetail = ({ contractId, onBack }: ContractDetailProps) => {
  const { data: contractData, isLoading: contractLoading } = useContract(contractId);
  const { data: progressData, isLoading: progressLoading } = useContractProgress(contractId);
  const { data: documentsData, isLoading: documentsLoading } = useContractDocuments(contractId);
  const { data: companyData, isLoading: companyLoading } = useCompany(contractData?.company_id || null);

  // Mock data cuando no hay datos reales
  const contract = contractData || {
    id: contractId,
    code: "4500066822-16-LQ24",
    title: "Estudio Hidrogeológico Conceptual Distrito Minero - Fase 2",
    type: "service" as const,
    status: "active" as const,
    company_id: "mock-company-id",
    start_date: "2024-07-01",
    end_date: "2025-01-31",
    contract_value: 18500,
    currency: "UF",
    summary_ai: "Estudio hidrogeológico conceptual para distrito minero en fase exploratoria",
    created_at: "2024-07-01T00:00:00Z",
    updated_at: "2024-07-01T00:00:00Z",
    created_by: null,
    document_url: null,
    risk_score: null,
    risk_label: null,
    asset_id: null,
    country: "Chile",
    mineral: "Cobre"
  };

  const progress = progressData || {
    totalBudget: 18500,
    totalSpent: 925.5,
    avgProgress: 5,
    tasks: [
      {
        id: "1",
        contract_id: contractId,
        task_number: "1",
        task_name: "Revisión Información Existente",
        budget_uf: 3500,
        spent_uf: 175,
        progress_percentage: 5,
        created_at: "2024-07-01T00:00:00Z",
        updated_at: "2024-07-01T00:00:00Z"
      },
      {
        id: "2",
        contract_id: contractId,
        task_number: "2",
        task_name: "Caracterización Hidrogeológica",
        budget_uf: 6500,
        spent_uf: 325,
        progress_percentage: 5,
        created_at: "2024-07-01T00:00:00Z",
        updated_at: "2024-07-01T00:00:00Z"
      },
      {
        id: "3",
        contract_id: contractId,
        task_number: "3",
        task_name: "Modelo Conceptual",
        budget_uf: 5000,
        spent_uf: 250,
        progress_percentage: 5,
        created_at: "2024-07-01T00:00:00Z",
        updated_at: "2024-07-01T00:00:00Z"
      },
      {
        id: "4",
        contract_id: contractId,
        task_number: "4",
        task_name: "Informe Final y Presentación",
        budget_uf: 3500,
        spent_uf: 175.5,
        progress_percentage: 5,
        created_at: "2024-07-01T00:00:00Z",
        updated_at: "2024-07-01T00:00:00Z"
      }
    ]
  };

  const documents = documentsData || [
    {
      id: "1",
      contract_id: contractId,
      filename: "Contrato Principal 4500066822-16-LQ24.pdf",
      file_url: "#",
      doc_type: "original" as const,
      created_at: "2024-07-01T00:00:00Z",
      uploaded_by: null,
      file_size: 2500000,
      version: 1,
      checksum: null
    },
    {
      id: "2",
      contract_id: contractId,
      filename: "EDP 001 - Julio 2024.pdf",
      file_url: "#",
      doc_type: "edp" as const,
      created_at: "2024-08-01T00:00:00Z",
      uploaded_by: null,
      file_size: 850000,
      version: 1,
      checksum: null
    }
  ];

  const company = companyData || {
    id: "mock-company-id",
    name: "Quantum Minerals Chile SpA",
    country: "Chile",
    address: null,
    contact_email: null,
    contact_phone: null,
    website: null,
    rating: "A",
    notes: null,
    created_at: "2024-07-01T00:00:00Z",
    updated_at: "2024-07-01T00:00:00Z"
  };

  // Mock data for S-curve - TODO: Generate from real progress data
  const sCurveData = [
    { month: "Jul", planned: 5, actual: progress?.avgProgress || 5 },
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

  // Mostrar loading solo si está cargando datos reales
  if (contractLoading && !contractData) {
    return <div className="p-6">Cargando contrato...</div>;
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
              {contract.code}
            </Badge>
            <h1 className="text-3xl font-bold mb-2">
              {contract.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {company && <span>{company.name}</span>}
              {contract.start_date && (
                <>
                  <span>•</span>
                  <span>Inicio: {format(new Date(contract.start_date), 'dd MMM yyyy')}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold text-gradient mb-1">
              {progress?.avgProgress || 0}%
            </div>
            <p className="text-sm text-muted-foreground">Avance Total</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6">
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Presupuesto Total</p>
            <p className="text-2xl font-bold">
              {progress?.totalBudget?.toLocaleString('es-CL', { maximumFractionDigits: 0 }) || '0'} {contract.currency}
            </p>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Gastado</p>
            <p className="text-2xl font-bold text-primary">
              {progress?.totalSpent?.toLocaleString('es-CL', { maximumFractionDigits: 2 }) || '0'} {contract.currency}
            </p>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Disponible</p>
            <p className="text-2xl font-bold text-success">
              {((progress?.totalBudget || 0) - (progress?.totalSpent || 0)).toLocaleString('es-CL', { maximumFractionDigits: 2 })} {contract.currency}
            </p>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Documentos</p>
            <p className="text-2xl font-bold">{documents?.length || 0}</p>
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
              {progress?.tasks && progress.tasks.length > 0 ? (
                progress.tasks.map((task, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{task.task_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">
                          {task.spent_uf?.toFixed(2) || 0} / {task.budget_uf?.toFixed(0) || 0} {contract.currency}
                        </span>
                        <Badge variant={task.progress_percentage > 0 ? "default" : "secondary"}>
                          {task.progress_percentage || 0}%
                        </Badge>
                      </div>
                    </div>
                    <Progress value={task.progress_percentage || 0} className="h-2" />
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No hay tareas registradas</p>
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
              {documents && documents.length > 0 ? (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.doc_type} • {format(new Date(doc.created_at), 'dd MMM yyyy')}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          Ver
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No hay documentos cargados</p>
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
  );
};
