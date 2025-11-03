import { useState } from "react";
import { FileText, TrendingUp, AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ContractFormDialog } from "@/components/ContractFormDialog";
import { useContracts } from "@/hooks/useContract";

interface ContractDashboardProps {
  onSelectContract: (id: string) => void;
  activeView: "dashboard" | "documents" | "alerts";
}

export const ContractDashboard = ({ onSelectContract, activeView }: ContractDashboardProps) => {
  const [showContractForm, setShowContractForm] = useState(false);
  const { data: contractsData } = useContracts();
  // Mock data - will be replaced with Supabase queries
  const contracts = [
    {
      id: "1",
      code: "AIPD-CSI001-1000-MN-0001",
      title: "Estudio Hidrológico e Hidrogeológico Proyecto Dominga",
      client: "Andes Iron SpA",
      contractor: "Itasca Chile SpA",
      status: "active",
      progress: 5,
      budget: 4501,
      spent: 209.81,
      slaStatus: "warning",
      nextDeadline: "Rev.0 - 3 días restantes",
    },
  ];

  const stats = [
    { 
      label: "Contratos Activos", 
      value: "1", 
      icon: FileText, 
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    { 
      label: "Progreso Promedio", 
      value: "5%", 
      icon: TrendingUp, 
      color: "text-success",
      bgColor: "bg-success/10"
    },
    { 
      label: "Alertas Pendientes", 
      value: "3", 
      icon: AlertCircle, 
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    { 
      label: "EDPs Aprobados", 
      value: "1", 
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient mb-2">Dashboard de Contratos</h1>
          <p className="text-muted-foreground">
            Gestión inteligente de contratos mineros con IA
          </p>
        </div>
        <Button onClick={() => setShowContractForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Contrato
        </Button>
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
        
        {contracts.map((contract) => (
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
                    <Badge 
                      className={
                        contract.slaStatus === "warning" 
                          ? "bg-warning text-warning-foreground" 
                          : "bg-success text-success-foreground"
                      }
                    >
                      {contract.nextDeadline}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl mb-2">{contract.title}</CardTitle>
                  <CardDescription className="flex items-center gap-4 text-sm">
                    <span>Cliente: <span className="font-medium text-foreground">{contract.client}</span></span>
                    <span>•</span>
                    <span>Contratista: <span className="font-medium text-foreground">{contract.contractor}</span></span>
                  </CardDescription>
                </div>
                
                <div className="text-right">
                  <div className="text-3xl font-bold text-gradient">{contract.progress}%</div>
                  <p className="text-xs text-muted-foreground">Avance</p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="relative space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progreso del Contrato</span>
                  <span className="font-medium">
                    {contract.spent.toLocaleString('es-CL')} / {contract.budget.toLocaleString('es-CL')} UF
                  </span>
                </div>
                <Progress value={contract.progress} className="h-2" />
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Presupuesto</p>
                  <p className="font-semibold">{contract.budget.toLocaleString('es-CL')} UF</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Gastado</p>
                  <p className="font-semibold text-primary">{contract.spent.toLocaleString('es-CL')} UF</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Disponible</p>
                  <p className="font-semibold text-success">{(contract.budget - contract.spent).toLocaleString('es-CL')} UF</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ContractFormDialog 
        open={showContractForm} 
        onOpenChange={setShowContractForm}
      />
    </div>
  );
};
