import { FileText, TrendingUp, AlertCircle, CheckCircle2, CheckCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { useContracts } from "@/hooks/useContract";
import { useRealtimeContract } from "@/hooks/useRealtimeContract";

interface ContractDashboardProps {
  onSelectContract: (id: string) => void;
  activeView: "dashboard" | "documents" | "alerts";
}

export const ContractDashboard = ({ onSelectContract, activeView }: ContractDashboardProps) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const { data: contractsData, isLoading, refetch } = useContracts();
  
  // Enable realtime updates for the main contract
  useRealtimeContract('AIPD-CSI001-1000-MN-0001');

  const handleVerifyContract = async () => {
    setIsVerifying(true);
    toast.info("Verificando datos del contrato Dominga...");
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-contract', {
        body: { contract_code: 'AIPD-CSI001-1000-MN-0001' }
      });
      
      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Error desconocido al invocar la función');
      }
      
      console.log('Verification result:', data);
      
      if (data?.status === 'PASS') {
        toast.success(`✅ Verificación EXITOSA: ${data.summary.pass} checks pasaron`);
      } else if (data?.status === 'FAIL') {
        toast.error(`❌ Verificación FALLÓ: ${data.summary.fail} checks fallaron de ${data.summary.pass + data.summary.fail} totales`, {
          description: 'Revisa la consola para más detalles'
        });
        console.log('Failed checks:', data.checks?.filter((c: any) => c.status === 'FAIL'));
      } else {
        toast.warning('Verificación completada con resultado inesperado');
      }
      
    } catch (error: any) {
      console.error('Error verifying contract:', error);
      const errorMsg = error?.message || 'Error desconocido';
      toast.error(`Error al verificar contrato: ${errorMsg}`, {
        description: 'Verifica que el contrato exista en la base de datos'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Use real-time calculated metrics from payment_states
  const contracts = contractsData?.length ? contractsData.map(c => {
    // Priorizar métricas calculadas en tiempo real sobre metadata
    const metrics = (c as any).calculated_metrics || {
      spent_uf: (c.metadata as any)?.spent_uf || 0,
      budget_uf: (c.metadata as any)?.budget_uf || c.contract_value || 0,
      overall_progress_pct: (c.metadata as any)?.overall_progress_pct || 0,
      available_uf: (c.metadata as any)?.available_uf || 0
    };
    
    // ✅ Detectar si el contrato tiene datos incompletos
    const hasIncompleteData = 
      !c.title || 
      c.title === "Contrato sin título" ||
      !(c.metadata as any)?.client ||
      !(c.metadata as any)?.contractor ||
      metrics.budget_uf === 0 ||
      (c.metadata as any)?.incomplete_data === true;
    
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      client: (c.metadata as any)?.client || "Sin información",
      contractor: (c.metadata as any)?.contractor || "Sin información",
      status: c.status,
      progress: Math.round(metrics.overall_progress_pct),
      budget: metrics.budget_uf,
      spent: metrics.spent_uf,
      slaStatus: hasIncompleteData ? "error" : "warning",
      nextDeadline: hasIncompleteData 
        ? "⚠️ Datos incompletos - Re-procesar documento"
        : "Rev.0 - 3 días restantes",
      hasIncompleteData  // ✅ Nuevo campo
    };
  }) : [];

  const stats = [
    { 
      label: "Contratos Activos", 
      value: contracts.length.toString(), 
      icon: FileText, 
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    { 
      label: "Progreso Promedio", 
      value: `${Math.round(contracts.reduce((acc, c) => acc + c.progress, 0) / contracts.length)}%`, 
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
      value: contracts.length > 0 
        ? ((contracts[0].budget > 0 ? (contracts[0].spent / contracts[0].budget * 100 >= 5 ? "2" : "1") : "0"))
        : "0",
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
        <div className="flex gap-2">
          <Button 
            onClick={handleVerifyContract}
            disabled={isVerifying}
            variant="outline"
            className="gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            {isVerifying ? "Verificando..." : "Verificar Datos"}
          </Button>
        </div>
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
      <h2 className="text-xl font-semibold mb-4">Contratos Activos</h2>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Cargando contratos...</p>
          </div>
        </div>
      ) : contracts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay contratos disponibles</h3>
            <p className="text-muted-foreground text-sm text-center mb-4">
              Comienza subiendo documentos para crear tu primer contrato
            </p>
          </CardContent>
        </Card>
      ) : (
        contracts.map((contract) => (
          <Card
            key={contract.id}
            className="cursor-pointer hover:shadow-xl transition-spring hover:-translate-y-1 border-transparent shadow-md overflow-hidden group mb-4"
            onClick={() => onSelectContract(contract.id)}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-smooth pointer-events-none" />
            
            <CardHeader className="relative">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {contract.code}
                    </Badge>
                    <Badge 
                      className={
                        contract.slaStatus === "error"
                          ? "bg-destructive text-destructive-foreground"
                          : contract.slaStatus === "warning"
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
              
              {/* Indicador de datos incompletos */}
              {contract.hasIncompleteData && (
                <div className="mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Contrato con datos incompletos.</strong> Sube el documento nuevamente para actualizar la información.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
