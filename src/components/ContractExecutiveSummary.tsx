import { RefreshCw, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ContractSummaryCard } from "./ContractSummaryCard";
import { useContractSummary } from "@/hooks/useContractSummary";
import { Skeleton } from "@/components/ui/skeleton";

interface ContractExecutiveSummaryProps {
  contractCode: string;
  onRefresh?: () => void;
}

export const ContractExecutiveSummary = ({ 
  contractCode, 
  onRefresh 
}: ContractExecutiveSummaryProps) => {
  const { data: summary, isLoading, error } = useContractSummary(contractCode);

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
      {/* Header con metadata */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Resumen Ejecutivo</h2>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>Versión: {summary.summary_json?.summary_version || 'v1.0'}</span>
            {meta.confidence && (
              <span>Confianza: {Math.round(meta.confidence * 100)}%</span>
            )}
            {meta.last_updated && (
              <span>Actualizado: {new Date(meta.last_updated).toLocaleDateString('es-CL')}</span>
            )}
          </div>
        </div>
        {onRefresh && (
          <Button variant="outline" onClick={onRefresh} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar con nuevos documentos
          </Button>
        )}
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
