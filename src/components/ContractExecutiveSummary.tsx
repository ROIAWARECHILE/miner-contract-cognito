import { RefreshCw, FileText, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ContractSummaryCard } from "./ContractSummaryCard";
import { useContractSummary } from "@/hooks/useContractSummary";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContractExecutiveSummaryProps {
  contractCode: string;
  onRefresh?: () => void;
}

export const ContractExecutiveSummary = ({ 
  contractCode, 
  onRefresh 
}: ContractExecutiveSummaryProps) => {
  const queryClient = useQueryClient();
  const { data: summary, isLoading, error, refetch } = useContractSummary(contractCode);

  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['contract-summary', contractCode] });
    refetch();
  };

  const handleReanalyze = async () => {
    try {
      toast.info("Iniciando re-análisis del contrato...");
      
      const { data, error } = await supabase.functions.invoke('reanalyze-contract-summary', {
        body: { contract_code: contractCode }
      });

      if (error) throw error;

      toast.success(`Re-análisis iniciado: ${data.jobs_created} documentos en cola`);
      
      // Refrescar después de 5 segundos
      setTimeout(() => {
        handleManualRefresh();
      }, 5000);
      
    } catch (error) {
      console.error('Error al re-analizar:', error);
      toast.error('Error al iniciar re-análisis. Intenta nuevamente.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error al cargar el resumen ejecutivo. Por favor, intente nuevamente.
        </AlertDescription>
      </Alert>
    );
  }

  if (!summary) {
    return (
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          No hay resumen ejecutivo disponible. Sube el contrato proforma, anexos técnicos, 
          planes de SSO/Calidad o propuestas para generar el resumen automáticamente.
        </AlertDescription>
      </Alert>
    );
  }

  const cards = summary.summary_json?.cards || [];
  const provenance = summary.summary_json?.provenance || {};
  const meta = summary.summary_json?.meta || {};

  return (
    <div className="space-y-6">
      {/* Header con metadata y estado */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Resumen Ejecutivo</h2>
            {summary && (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}
              </Badge>
            )}
            {summary?.updated_at && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(summary.updated_at), { 
                  addSuffix: true, 
                  locale: es 
                })}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Versión: {summary.summary_json?.summary_version || 'v1.0'}</span>
            {meta.confidence && (
              <span>Confianza: {Math.round(meta.confidence * 100)}%</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleManualRefresh} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          {onRefresh && (
            <Button variant="default" onClick={handleReanalyze} size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-analizar todos los documentos
            </Button>
          )}
        </div>
      </div>

      {/* Fuentes de información */}
      {(provenance.contract_file || provenance.annexes?.length) && (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">Fuentes: </span>
            {provenance.contract_file && <span>{provenance.contract_file}</span>}
            {provenance.annexes && provenance.annexes.length > 0 && (
              <span> + {provenance.annexes.length} anexo(s)</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Grid de tarjetas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, idx) => (
          <ContractSummaryCard
            key={idx}
            category={card.category}
            title={card.title}
            fields={card.fields}
          />
        ))}
      </div>

      {/* Si no hay tarjetas, mostrar placeholder */}
      {cards.length === 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {['General', 'Legal y Administrativa', 'Alcance Técnico', 'Equipo y Experiencia', 'Seguridad y Calidad', 'Programa y Avance'].map((cat) => (
            <ContractSummaryCard
              key={cat}
              category={cat}
              title={cat}
              fields={{}}
            />
          ))}
        </div>
      )}
    </div>
  );
};
