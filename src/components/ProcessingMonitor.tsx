import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";

interface ProcessingMonitorProps {
  contractCode: string;
}

export const ProcessingMonitor = ({ contractCode }: ProcessingMonitorProps) => {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['processing-jobs', contractCode],
    queryFn: async () => {
      // Get contract_id first
      const { data: contract } = await supabase
        .from('contracts')
        .select('id')
        .eq('code', contractCode)
        .single();
      
      if (!contract) return [];
      
      // Get recent jobs for this contract
      const { data, error } = await supabase
        .from('document_processing_jobs')
        .select('*')
        .eq('contract_id', contract.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: (query) => {
      // Refetch every 2s if there are active jobs
      const hasActiveJobs = query.state.data?.some(j => j.status === 'processing' || j.status === 'queued');
      return hasActiveJobs ? 2000 : false;
    },
    enabled: !!contractCode
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Estado del Procesamiento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    );
  }

  if (!jobs || jobs.length === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: 'default',
      failed: 'destructive',
      processing: 'secondary',
      queued: 'outline'
    };
    
    const labels: Record<string, string> = {
      completed: 'Completado',
      failed: 'Fallido',
      processing: 'Procesando',
      queued: 'En cola'
    };
    
    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const latestJob = jobs[0];
  const progress = latestJob?.progress as any;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          {getStatusIcon(latestJob.status)}
          Estado del Procesamiento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Latest Job Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {latestJob.document_type === 'contract' ? 'Contrato' : 'Documento'}
            </span>
            {getStatusBadge(latestJob.status)}
          </div>
          
          {/* Progress Details */}
          {progress && (
            <div className="space-y-2">
              {progress.phase && (
                <p className="text-xs text-muted-foreground">
                  Fase: {progress.phase}
                </p>
              )}
              
              {progress.completeness !== undefined && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Completitud</span>
                    <span className="text-xs font-medium">{progress.completeness}%</span>
                  </div>
                  <Progress value={progress.completeness} className="h-2" />
                </div>
              )}
              
              {progress.tokens_used && (
                <p className="text-xs text-muted-foreground">
                  Tokens usados: {progress.tokens_used.toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Warnings */}
        {progress?.warnings && progress.warnings.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Advertencias:</strong>
              <ul className="mt-1 list-disc list-inside space-y-1">
                {progress.warnings.slice(0, 3).map((warning: string, i: number) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Review Required */}
        {progress?.review_required && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Revisión Requerida:</strong> Los datos extraídos requieren validación manual.
            </AlertDescription>
          </Alert>
        )}

        {/* Error */}
        {latestJob.status === 'failed' && latestJob.error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Error:</strong> {latestJob.error}
            </AlertDescription>
          </Alert>
        )}

        {/* Job History */}
        {jobs.length > 1 && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium mb-2 text-muted-foreground">
              Historial Reciente
            </p>
            <div className="space-y-1">
              {jobs.slice(1, 4).map((job) => (
                <div key={job.id} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1">
                    {getStatusIcon(job.status)}
                    {job.document_type}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(job.created_at).toLocaleString('es-CL', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
