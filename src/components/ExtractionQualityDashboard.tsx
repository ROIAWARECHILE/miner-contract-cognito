import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";
import { useExtractionQuality } from "@/hooks/useExtractionQuality";

interface ExtractionQualityDashboardProps {
  contractCode: string;
}

export const ExtractionQualityDashboard = ({ contractCode }: ExtractionQualityDashboardProps) => {
  const { data: metrics, isLoading } = useExtractionQuality(contractCode);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calidad de Extracción</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Cargando métricas...</p>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calidad de Extracción</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
            <p className="text-sm">No se encontraron métricas de extracción</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCompletenessColor = (pct: number) => {
    if (pct >= 80) return "text-success";
    if (pct >= 60) return "text-warning";
    return "text-destructive";
  };

  const getCompletenessIcon = (pct: number) => {
    if (pct >= 80) return <CheckCircle className="w-5 h-5 text-success" />;
    if (pct >= 60) return <Clock className="w-5 h-5 text-warning" />;
    return <XCircle className="w-5 h-5 text-destructive" />;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Calidad de Extracción
          </CardTitle>
          {metrics.review_required && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" />
              Revisión Requerida
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Completitud de Ficha Técnica */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getCompletenessIcon(metrics.summary_completeness)}
              <span className="font-medium">Completitud de Ficha Técnica</span>
            </div>
            <span className={`text-2xl font-bold ${getCompletenessColor(metrics.summary_completeness)}`}>
              {metrics.summary_completeness}%
            </span>
          </div>
          <Progress value={metrics.summary_completeness} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {metrics.summary_completeness >= 80 
              ? "Ficha técnica completa y lista"
              : metrics.summary_completeness >= 60
              ? "Ficha técnica funcional pero con campos faltantes"
              : "Ficha técnica incompleta - revisar extracción"}
          </p>
        </div>

        {/* Riesgos Identificados */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Riesgos Identificados</span>
            <span className="text-2xl font-bold">{metrics.risks_count}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-destructive/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-destructive">
                {metrics.risks_by_severity.alta}
              </div>
              <div className="text-xs text-muted-foreground">Alta</div>
            </div>
            <div className="bg-warning/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-warning">
                {metrics.risks_by_severity.media}
              </div>
              <div className="text-xs text-muted-foreground">Media</div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-muted-foreground">
                {metrics.risks_by_severity.baja}
              </div>
              <div className="text-xs text-muted-foreground">Baja</div>
            </div>
          </div>
          {metrics.risks_count < 4 && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Pocos riesgos detectados - posiblemente se requiere revisión manual
            </p>
          )}
        </div>

        {/* Obligaciones */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Obligaciones</span>
            <span className="text-2xl font-bold">{metrics.obligations_count}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-primary">
                {metrics.obligations_by_status.pending}
              </div>
              <div className="text-xs text-muted-foreground">Pendientes</div>
            </div>
            <div className="bg-destructive/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-destructive">
                {metrics.obligations_by_status.overdue}
              </div>
              <div className="text-xs text-muted-foreground">Vencidas</div>
            </div>
            <div className="bg-success/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-success">
                {metrics.obligations_by_status.completed}
              </div>
              <div className="text-xs text-muted-foreground">Completadas</div>
            </div>
          </div>
        </div>

        {/* Advertencias */}
        {metrics.warnings.length > 0 && (
          <div className="space-y-2">
            <span className="font-medium text-amber-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Advertencias
            </span>
            <div className="space-y-1">
              {metrics.warnings.map((warning, idx) => (
                <div key={idx} className="bg-amber-50 dark:bg-amber-950/20 rounded p-2 text-xs text-amber-800 dark:text-amber-200">
                  • {warning}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Última Extracción */}
        {metrics.last_extraction && (
          <div className="pt-3 border-t text-xs text-muted-foreground">
            Última extracción: {new Date(metrics.last_extraction).toLocaleString('es-CL')}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
