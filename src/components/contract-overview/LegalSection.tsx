import { Scale, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface LegalSectionProps {
  data: any;
  provenance: any;
  hasData?: boolean;
}

export const LegalSection = ({ data, provenance, hasData = true }: LegalSectionProps) => {
  const leyes = Array.isArray(data?.leyes_aplicables) ? data.leyes_aplicables : [];
  const normas = Array.isArray(data?.normas_tecnicas) ? data.normas_tecnicas : [];

  if (!data && !hasData) {
    return (
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          Marco Legal y Normativo
        </h2>
        <p className="text-sm text-muted-foreground">
          No hay información legal disponible. Sube el contrato o anexos para ver estos datos.
        </p>
      </div>
    );
  }

  if (leyes.length === 0 && normas.length === 0) return null;

  return (
    <div className="bg-card border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Scale className="h-5 w-5 text-primary" />
        Marco Legal y Normativo
      </h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Leyes */}
        {leyes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">
              Leyes Aplicables
            </h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              {leyes.map((ley, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{ley}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Normas */}
        {normas.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">
              Normas Técnicas
            </h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              {normas.map((norma, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{norma}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Provenance multi-documento */}
      {provenance?.documents && provenance.documents.length > 0 && (
        <Alert className="mt-4 bg-muted/50 border-muted">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <AlertDescription className="text-xs text-muted-foreground">
            <div className="font-medium mb-1">Fuentes consolidadas ({provenance.documents.length} documento{provenance.documents.length > 1 ? 's' : ''}):</div>
            <ul className="space-y-1">
              {provenance.documents.map((doc: any, i: number) => (
                <li key={i}>
                  • {doc.filename} ({doc.doc_type})
                  {doc.processed_at && ` - ${formatDistanceToNow(new Date(doc.processed_at), { locale: es, addSuffix: true })}`}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
