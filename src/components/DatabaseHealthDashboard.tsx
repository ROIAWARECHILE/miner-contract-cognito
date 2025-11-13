import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Database, Activity } from "lucide-react";

export const DatabaseHealthDashboard = () => {
  const { data: health } = useQuery({
    queryKey: ['db-health'],
    queryFn: async () => {
      // Llamar a la función RPC que retorna métricas
      const { data, error } = await supabase.rpc('get_db_health_metrics');
      
      if (error) {
        console.error('Error fetching health metrics:', error);
        // Fallback: retornar métricas básicas
        return {
          total_contracts: 0,
          active_contracts: 0,
          total_documents: 0,
          total_storage_bytes: 0,
          failed_jobs: 0,
          stuck_jobs: 0,
          stale_ingest_jobs: 0,
          recent_logs: 0,
          recent_audit_logs: 0,
          active_cache_entries: 0,
          avg_processing_time_ms: 0,
          last_updated: new Date().toISOString()
        };
      }
      return data as any;
    },
    refetchInterval: 60000, // Refresh cada minuto
  });

  if (!health) return null;

  const hasIssues = (health.failed_jobs || 0) > 0 || (health.stuck_jobs || 0) > 0;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Salud de Base de Datos
          </CardTitle>
          {hasIssues ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Atención Requerida
            </Badge>
          ) : (
            <Badge className="gap-1 bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-3 w-3" />
              Todo OK
            </Badge>
          )}
        </div>
        <CardDescription>
          Última actualización: {new Date(health.last_updated).toLocaleString('es-CL', { 
            dateStyle: 'short', 
            timeStyle: 'short' 
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col space-y-1">
            <span className="text-sm text-muted-foreground">Contratos</span>
            <span className="text-2xl font-bold text-foreground">{health.total_contracts}</span>
            <span className="text-xs text-muted-foreground">{health.active_contracts} activos</span>
          </div>
          
          <div className="flex flex-col space-y-1">
            <span className="text-sm text-muted-foreground">Documentos</span>
            <span className="text-2xl font-bold text-foreground">{health.total_documents}</span>
            <span className="text-xs text-muted-foreground">
              {((health.total_storage_bytes || 0) / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
          
          <div className="flex flex-col space-y-1">
            <span className="text-sm text-muted-foreground">Jobs Fallidos</span>
            <span className={`text-2xl font-bold ${(health.failed_jobs || 0) > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {health.failed_jobs || 0}
            </span>
            <span className="text-xs text-muted-foreground">
              {health.stuck_jobs || 0} estancados
            </span>
          </div>
          
          <div className="flex flex-col space-y-1">
            <span className="text-sm text-muted-foreground">Tiempo Promedio</span>
            <span className="text-2xl font-bold text-foreground">
              {((health.avg_processing_time_ms || 0) / 1000).toFixed(1)}s
            </span>
            <span className="text-xs text-muted-foreground">procesamiento IA</span>
          </div>
        </div>

        {hasIssues && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Se detectaron problemas:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {(health.failed_jobs || 0) > 0 && (
                <li>• {health.failed_jobs} jobs fallidos necesitan revisión</li>
              )}
              {(health.stuck_jobs || 0) > 0 && (
                <li>• {health.stuck_jobs} jobs estancados &gt;2 horas</li>
              )}
              {(health.stale_ingest_jobs || 0) > 0 && (
                <li>• {health.stale_ingest_jobs} ingest jobs pendientes &gt;1 día</li>
              )}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border/50">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Cache Activo</span>
            <span className="text-lg font-semibold text-foreground">{health.active_cache_entries || 0}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Logs Recientes</span>
            <span className="text-lg font-semibold text-foreground">{health.recent_logs || 0}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Auditoría 30d</span>
            <span className="text-lg font-semibold text-foreground">{health.recent_audit_logs || 0}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
          <Activity className="h-3 w-3" />
          <span>Monitoreo en tiempo real activado</span>
        </div>
      </CardContent>
    </Card>
  );
};
