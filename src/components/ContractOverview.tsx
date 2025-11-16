import { useContractSummary } from "@/hooks/useContractSummary";
import { useContract } from "@/hooks/useContract";
import { ContractHeader } from "./contract-overview/ContractHeader";
import { GeneralInfoSection } from "./contract-overview/GeneralInfoSection";
import { ScopeSection } from "./contract-overview/ScopeSection";
import { TeamSection } from "./contract-overview/TeamSection";
import { SafetyQualitySection } from "./contract-overview/SafetyQualitySection";
import { LegalSection } from "./contract-overview/LegalSection";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertCircle, FileText, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface ContractOverviewProps {
  contractCode: string;
}

export const ContractOverview = ({ contractCode }: ContractOverviewProps) => {
  const queryClient = useQueryClient();
  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch } = useContractSummary(contractCode);
  const { data: contract, isLoading: contractLoading } = useContract(contractCode);

  const isLoading = summaryLoading || contractLoading;
  const error = summaryError;

  // Función para extraer datos de una categoría específica
  const extractCardData = (category: string) => {
    const cards = summary?.summary_json?.cards || [];
    const card = cards.find(c => c.category === category);
    return card?.fields || null;
  };

  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['contract-summary', contractCode] });
    refetch();
    toast.success("Resumen actualizado");
  };

  const handleReanalyze = async () => {
    try {
      toast.info("Consolidando información de todos los documentos...");
      
      const { data, error } = await supabase.functions.invoke('generate-executive-summary', {
        body: { contract_code: contractCode }
      });

      if (error) throw error;

      toast.success(`Datos consolidados exitosamente de ${data.documents_analyzed} documentos (${data.edps_count} EDPs, ${data.memos_count} Memorandums)`);
      
      // Refrescar inmediatamente ya que la generación es sincrónica
      handleManualRefresh();
      
    } catch (error) {
      console.error('Error al consolidar datos:', error);
      toast.error('Error al consolidar información. Intenta nuevamente.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
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

  // Si no hay contrato, mostrar error
  if (!contract) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No se encontró el contrato. Verifica el código e intenta nuevamente.
        </AlertDescription>
      </Alert>
    );
  }

  // Extraer datos por categoría del summary (si existe)
  const generalData = extractCardData('General');
  const legalData = extractCardData('Legal y Administrativa');
  const alcanceData = extractCardData('Alcance Técnico');
  const equipoData = extractCardData('Equipo y Experiencia');
  const seguridadData = extractCardData('Seguridad y Calidad');

  // Construir datos desde contract metadata como fallback
  const contractMetadata = contract.metadata as any || {};
  const fallbackData = {
    general: {
      mandante: contractMetadata.client || contract.company_id,
      contratista: contractMetadata.contractor,
      administrador_contrato: contractMetadata.admin,
      valor_total_uf: contractMetadata.budget_uf || contract.contract_value,
      fecha_inicio: contract.start_date || contractMetadata.start_date,
      fecha_termino: contract.end_date || contractMetadata.end_date,
      duracion_dias: contractMetadata.duration_days,
      modalidad: contractMetadata.payment_terms?.type,
      nombre_contrato: contract.title,
      titulo: contract.title,
      estado: contract.status,
    }
  };

  // Normalizar provenance
  const rawProvenance = summary?.summary_json?.provenance;
  const provenance = (rawProvenance as any)?.type 
    ? rawProvenance
    : { 
        type: 'legacy' as const, 
        contract_file: (rawProvenance as any)?.contract_file || null, 
        annexes: (rawProvenance as any)?.annexes || [] 
      };

  return (
    <div className="space-y-6">
      {/* Botones de acción */}
      <div className="flex justify-end gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleManualRefresh}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
        <Button 
          variant="default" 
          size="sm" 
          onClick={handleReanalyze}
        >
          <FileText className="h-4 w-4 mr-2" />
          Consolidar Datos
        </Button>
      </div>

      {/* Header del contrato */}
      <ContractHeader 
        data={generalData || fallbackData.general} 
        contractCode={contractCode}
        updatedAt={contract.updated_at}
      />

      {/* Información General */}
      <GeneralInfoSection 
        data={generalData || fallbackData.general}
        provenance={provenance}
        hasData={!!generalData || !!contractMetadata.client}
      />

      {/* Alcance y Objetivos */}
      <ScopeSection 
        data={alcanceData}
        provenance={provenance}
        hasData={!!alcanceData}
      />

      {/* Equipo de Proyecto */}
      <TeamSection 
        data={equipoData}
        provenance={provenance}
        hasData={!!equipoData}
      />

      {/* Seguridad y Calidad */}
      <SafetyQualitySection 
        data={seguridadData}
        provenance={provenance}
        hasData={!!seguridadData}
      />

      {/* Marco Legal */}
      <LegalSection 
        data={legalData}
        provenance={provenance}
        hasData={!!legalData}
      />

      {/* Mensaje informativo si no hay resumen completo */}
      {!summary && (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            Para ver información consolidada, sube Estados de Pago (EDPs) y Memorandums Técnicos 
            en la sección de Documentos, luego haz clic en "Consolidar Datos".
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
