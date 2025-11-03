import { useEffect, useState } from 'react';
import { useIngestJobs, useIngestLogs } from '@/hooks/useIngestJobs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ProcessPendingJobsButton from './ProcessPendingJobsButton';
import { supabase } from '@/integrations/supabase/client';

interface IngestJobMonitorProps {
  contractId?: string;
}

export default function IngestJobMonitor({ contractId }: IngestJobMonitorProps) {
  const { data: jobs, isLoading } = useIngestJobs(contractId);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [lastJobStates, setLastJobStates] = useState<Record<string, string>>({});

  // Track job state changes and show toasts
  useEffect(() => {
    if (!jobs) return;
    
    jobs.forEach(job => {
      const prevState = lastJobStates[job.id];
      const currentState = job.status;
      
      if (prevState && prevState !== currentState) {
        if (currentState === 'done') {
          toast.success(`✅ ${job.storage_path.split('/').pop()} procesado exitosamente`);
        } else if (currentState === 'failed') {
          toast.error(`❌ Error procesando ${job.storage_path.split('/').pop()}: ${job.last_error?.substring(0, 100)}`);
        }
      }
      
      setLastJobStates(prev => ({ ...prev, [job.id]: currentState }));
    });
  }, [jobs]);

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          ⏳ Cargando estado de procesamiento...
        </div>
      </Card>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          ✓ No hay documentos procesándose en este momento
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Estado de Procesamiento
        </h3>
        <ProcessPendingJobsButton />
      </div>
      
      <div className="space-y-2">
        {jobs.map((job) => (
          <JobRow 
            key={job.id} 
            job={job} 
            expanded={expandedJobId === job.id}
            onToggle={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
          />
        ))}
      </div>
    </Card>
  );
}

function JobRow({ 
  job, 
  expanded, 
  onToggle 
}: { 
  job: any; 
  expanded: boolean; 
  onToggle: () => void;
}) {
  const { data: logs } = useIngestLogs(job.id);
  const [retrying, setRetrying] = useState(false);

  const retryJob = async () => {
    setRetrying(true);
    try {
      const { error } = await supabase.from('ingest_jobs').update({
        status: 'queued',
        last_error: null,
        attempts: 0,
        updated_at: new Date().toISOString()
      }).eq('id', job.id);

      if (error) throw error;
      
      toast.success('✅ Job reiniciado y re-encolado');
    } catch (error) {
      toast.error(`❌ Error al reintentar: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setRetrying(false);
    }
  };
  
  const statusConfig = {
    queued: { icon: Clock, color: 'bg-yellow-500', label: 'En cola' },
    working: { icon: Loader2, color: 'bg-blue-500', label: 'Procesando', spin: true },
    done: { icon: CheckCircle2, color: 'bg-green-500', label: 'Completado' },
    failed: { icon: XCircle, color: 'bg-red-500', label: 'Error' },
  }[job.status] || { icon: Clock, color: 'bg-gray-500', label: job.status };

  const Icon = statusConfig.icon;
  const fileName = job.storage_path.split('/').pop();

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${statusConfig.color}`} />
            <Icon className={`h-4 w-4 text-muted-foreground ${statusConfig.spin ? 'animate-spin' : ''}`} />
            <div className="text-left">
              <div className="text-sm font-medium text-foreground">{fileName}</div>
              <div className="text-xs text-muted-foreground">
                {job.document_type?.toUpperCase()} • {statusConfig.label}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={job.status === 'done' ? 'default' : 'secondary'}>
              {statusConfig.label}
            </Badge>
            
            {logs?.some(log => log.step === 'parse_llamaparse_success') && (
              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400">
                LlamaParse ✓
              </Badge>
            )}
            
            {logs?.some(log => log.step === 'ai_call_claude') && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400">
                Claude 3.5
              </Badge>
            )}
            
            {logs?.some(log => log.step === 'ai_call_gemini') && (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-400">
                Gemini
              </Badge>
            )}
            
            {job.status === 'failed' && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  retryJob();
                }}
                disabled={retrying}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${retrying ? 'animate-spin' : ''}`} />
                Reintentar
              </Button>
            )}
          </div>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        {logs && logs.length > 0 && (
          <div className="mt-2 ml-6 p-3 bg-muted/30 rounded-lg">
            <div className="text-xs font-mono space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="text-muted-foreground">
                  <span className="text-primary">{log.step}</span>: {log.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
