import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ScopeSectionProps {
  data: any;
  provenance: any;
  hasData?: boolean;
}

export const ScopeSection = ({ data, provenance, hasData = true }: ScopeSectionProps) => {
  if (!data && !hasData) {
    return (
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Alcance y Objetivos
        </h2>
        <p className="text-sm text-muted-foreground">
          No hay información de alcance disponible. Sube el contrato o memoria técnica para ver estos datos.
        </p>
      </div>
    );
  }

  const objetivo = data?.objetivo || data?.descripcion_alcance || data?.alcance;
  const entregables = Array.isArray(data?.entregables) ? data.entregables : [];
  const actividades = Array.isArray(data?.actividades) ? data.actividades : [];

  return (
    <div className="bg-card border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        Alcance y Objetivos
      </h2>
      
      {objetivo && (
        <div className="prose prose-sm max-w-none mb-4">
          <p className="text-foreground leading-relaxed">
            {objetivo}
          </p>
        </div>
      )}
      
      {entregables.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2 text-muted-foreground">
            Entregables Clave
          </h3>
          <div className="flex flex-wrap gap-2">
            {entregables.map((e, i) => (
              <Badge key={i} variant="secondary">
                {e}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {actividades.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2 text-muted-foreground">
            Actividades Principales
          </h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            {actividades.slice(0, 5).map((actividad, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>{actividad}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
