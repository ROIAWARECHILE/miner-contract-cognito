import { FileText, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useContracts, useSLAAlerts } from "@/hooks/useContract";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface ContractDashboardProps {
  onSelectContract: (id: string) => void;
  activeView: "dashboard" | "documents" | "alerts";
}

export const ContractDashboard = ({ onSelectContract, activeView }: ContractDashboardProps) => {
  const { data: contracts, isLoading: contractsLoading, error: contractsError } = useContracts();
  const { data: alerts } = useSLAAlerts();

  // Query for approved EDPs (obligations with type 'reporting' and status 'completed')
  const { data: approvedEDPs } = useQuery({
    queryKey: ["approved-edps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obligations")
        .select("*")
        .eq("type", "reporting")
        .eq("status", "completed");
      
      if (error) throw error;
      return data?.length || 0;
    },
  });

  // Calculate stats from real data
  const activeContractsCount = contracts?.filter(c => c.status === 'active')?.length || 0;
  const avgProgress = contracts?.length 
    ? Math.round(contracts.reduce((sum, c) => sum + (c.risk_score || 0), 0) / contracts.length) 
    : 0;
  const pendingAlertsCount = alerts?.length || 0;

  const stats = [
    { 
      label: "Contratos Activos", 
      value: activeContractsCount.toString(), 
      icon: FileText, 
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    { 
      label: "Progreso Promedio", 
      value: `${avgProgress}%`, 
      icon: TrendingUp, 
      color: "text-success",
      bgColor: "bg-success/10"
    },
    { 
      label: "Alertas Pendientes", 
      value: pendingAlertsCount.toString(), 
      icon: AlertCircle, 
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    { 
      label: "EDPs Aprobados", 
      value: (approvedEDPs || 0).toString(), 
      icon: CheckCircle2, 
      color: "text-success",
      bgColor: "bg-success/10"
    },
  ];

  if (activeView !== "dashboard") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-full bg-muted flex items-center justify-center">
            <FileText className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold">Vista en desarrollo</h3>
          <p className="text-muted-foreground">
            Esta sección estará disponible próximamente
          </p>
        </div>
      </div>
    );
  }

  if (contractsLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <Skeleton className="h-10 w-80 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (contractsError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <AlertCircle className="w-16 h-16 mx-auto text-destructive" />
          <h3 className="text-xl font-semibold">Error al cargar contratos</h3>
          <p className="text-muted-foreground">
            Por favor, intenta nuevamente más tarde
          </p>
        </div>
      </div>
    );
  }

  if (!contracts || contracts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <FileText className="w-16 h-16 mx-auto text-muted-foreground" />
          <h3 className="text-xl font-semibold">No hay contratos</h3>
          <p className="text-muted-foreground">
            Comienza agregando tu primer contrato
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gradient mb-2">Dashboard de Contratos</h1>
        <p className="text-muted-foreground">
          Gestión inteligente de contratos mineros con IA
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card 
            key={index} 
            className="border-transparent shadow-md hover:shadow-xl transition-spring hover:-translate-y-1"
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contracts List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Contratos Activos</h2>
        
        {contracts.map((contract) => {
          const progress = contract.risk_score || 0;
          const budget = Number(contract.contract_value) || 0;
          const spent = budget * (progress / 100);

          return (
            <Card
              key={contract.id}
              className="cursor-pointer hover:shadow-xl transition-spring hover:-translate-y-1 border-transparent shadow-md overflow-hidden group"
              onClick={() => onSelectContract(contract.id)}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-smooth" />
              
              <CardHeader className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {contract.code}
                      </Badge>
                      <Badge variant="outline">
                        {contract.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl mb-2">{contract.title}</CardTitle>
                    <CardDescription className="flex items-center gap-4 text-sm">
                      <span>Tipo: <span className="font-medium text-foreground">{contract.type}</span></span>
                      {contract.mineral && (
                        <>
                          <span>•</span>
                          <span>Mineral: <span className="font-medium text-foreground">{contract.mineral}</span></span>
                        </>
                      )}
                    </CardDescription>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gradient">{progress}%</div>
                    <p className="text-xs text-muted-foreground">Avance</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="relative space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progreso del Contrato</span>
                    <span className="font-medium">
                      {spent.toLocaleString('es-CL', { maximumFractionDigits: 2 })} / {budget.toLocaleString('es-CL')} {contract.currency || 'UF'}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border/50">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Presupuesto</p>
                    <p className="font-semibold">{budget.toLocaleString('es-CL')} {contract.currency || 'UF'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Gastado</p>
                    <p className="font-semibold text-primary">{spent.toLocaleString('es-CL', { maximumFractionDigits: 2 })} {contract.currency || 'UF'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Disponible</p>
                    <p className="font-semibold text-success">{(budget - spent).toLocaleString('es-CL', { maximumFractionDigits: 2 })} {contract.currency || 'UF'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
