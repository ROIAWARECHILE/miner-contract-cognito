import { useEffect, useState } from 'react';
import { useIngestJobs, useIngestLogs } from '@/hooks/useIngestJobs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ProcessPendingJobsButton from './ProcessPendingJobsButton';
import FixStuckJobButton from './FixStuckJobButton';

interface IngestJobMonitorProps {
  contractId?: string;
}

export default function IngestJobMonitor({ contractId }: IngestJobMonitorProps) {
  const { data: jobs, isLoading } = useIngestJobs(contractId);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // Show toast when job completes
  useEffect(() => {
    if (!jobs) return;
    
    const recentlyCompleted = jobs.find(
      job => job.status === 'done' && 
      new Date(job.updated_at).getTime() > Date.now() - 10000 // Last 10 seconds
    );

    if (recentlyCompleted) {
      toast.success(`✅ Documento procesado exitosamente`, {
        description: `${recentlyCompleted.document_type?.toUpperCase()} en ${recentlyCompleted.storage_path}`
      });
    }

    const recentlyFailed = jobs.find(
      job => job.status === 'failed' && 
      new Date(job.updated_at).getTime() > Date.now() - 10000
    );

    if (recentlyFailed) {
      toast.error(`❌ Error al procesar documento`, {
        description: recentlyFailed.last_error || 'Error desconocido'
      });
    }
  }, [jobs]);

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando trabajos de ingesta...
        </div>
      </Card>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          No hay documentos procesándose en este momento
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
        <div className="flex gap-2">
          <FixStuckJobButton />
          <ProcessPendingJobsButton />
        </div>
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
          
          <Badge variant={job.status === 'done' ? 'default' : 'secondary'}>
            {statusConfig.label}
          </Badge>
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
