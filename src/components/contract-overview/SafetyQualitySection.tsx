import { Shield, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SafetyQualitySectionProps {
  data: any;
  provenance: any;
}

export const SafetyQualitySection = ({ data, provenance }: SafetyQualitySectionProps) => {
  const planSSO = data.plan_sso || data.sso;
  const planCalidad = data.plan_calidad || data.calidad;

  return (
    <div className="bg-card border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        Seguridad y Calidad
      </h2>
      
      <div className="grid md:grid-cols-2 gap-4">
        {/* Plan SSO */}
        {planSSO && (
          <div className="border rounded-lg p-4 bg-background">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Plan de Seguridad (SSO)</h3>
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Vigente
              </Badge>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              {planSSO.codigo && <p>📄 {planSSO.codigo}</p>}
              {planSSO.vigencia && <p>📅 Vigencia: {planSSO.vigencia}</p>}
              {planSSO.normas && (
                <p>🔖 {Array.isArray(planSSO.normas) ? planSSO.normas.join(', ') : planSSO.normas}</p>
              )}
            </div>
          </div>
        )}
        
        {/* Plan Calidad */}
        {planCalidad && (
          <div className="border rounded-lg p-4 bg-background">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Plan de Calidad</h3>
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Vigente
              </Badge>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              {planCalidad.codigo && <p>📄 {planCalidad.codigo}</p>}
              {planCalidad.normas && (
                <p>🔖 {Array.isArray(planCalidad.normas) ? planCalidad.normas.join(', ') : planCalidad.normas}</p>
              )}
              {planCalidad.responsable && <p>👤 Responsable: {planCalidad.responsable}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
