import { Building2 } from "lucide-react";
import { InfoRow } from "./InfoRow";

interface GeneralInfoSectionProps {
  data: any;
  provenance: any;
  hasData?: boolean;
}

export const GeneralInfoSection = ({ data, provenance, hasData = true }: GeneralInfoSectionProps) => {
  if (!data && !hasData) {
    return (
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Información General
        </h2>
        <p className="text-sm text-muted-foreground">
          No hay información general disponible. Sube el contrato proforma para ver estos datos.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        Información General
      </h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Columna 1: Partes Contractuales */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Partes Contractuales
          </h3>
          <InfoRow 
            label="Mandante" 
            value={data.mandante || data.cliente} 
            provenance={provenance}
            category="General"
            field="mandante"
          />
          <InfoRow 
            label="Contratista" 
            value={data.contratista || data.contractor} 
            provenance={provenance}
            category="General"
            field="contratista"
          />
          <InfoRow 
            label="Admin. Contrato" 
            value={data.administrador_contrato} 
            provenance={provenance}
            category="General"
            field="administrador_contrato"
          />
          <InfoRow 
            label="Monto Total" 
            value={data.valor_total_uf ? `${data.valor_total_uf} UF` : null} 
            provenance={provenance}
            category="General"
            field="valor_total_uf"
          />
        </div>
        
        {/* Columna 2: Plazos */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Plazos y Duración
          </h3>
          <InfoRow 
            label="Fecha Inicio" 
            value={data.fecha_inicio} 
            provenance={provenance}
            category="General"
            field="fecha_inicio"
          />
          <InfoRow 
            label="Fecha Término" 
            value={data.fecha_termino} 
            provenance={provenance}
            category="General"
            field="fecha_termino"
          />
          <InfoRow 
            label="Duración" 
            value={data.duracion_dias ? `${data.duracion_dias} días` : null} 
            provenance={provenance}
            category="General"
            field="duracion_dias"
          />
          <InfoRow 
            label="Modalidad" 
            value={data.modalidad || data.tipo_contrato} 
            provenance={provenance}
            category="General"
            field="modalidad"
          />
        </div>
      </div>
    </div>
  );
};
