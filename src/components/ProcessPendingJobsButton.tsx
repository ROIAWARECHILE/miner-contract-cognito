import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export default function ProcessPendingJobsButton() {
  const [isProcessing, setIsProcessing] = useState(false);

  const processPendingJobs = async () => {
    setIsProcessing(true);
    try {
      // Get all queued jobs (regardless of contract_id)
      const { data: jobs, error: jobsError } = await supabase
        .from('ingest_jobs')
        .select('*')
        .eq('status', 'queued')
        .order('created_at', { ascending: true });

      if (jobsError) throw jobsError;

      if (!jobs || jobs.length === 0) {
        toast.info('No hay trabajos pendientes');
        return;
      }

      console.log('Found pending jobs:', jobs.length);
      toast.info(`Procesando ${jobs.length} trabajo(s) pendiente(s)...`);

      // Process each job by calling ingest-worker
      let successCount = 0;
      let errorCount = 0;
      
      for (const job of jobs) {
        try {
          console.log('Processing job:', job.id, 'path:', job.storage_path);
          const { data, error } = await supabase.functions.invoke('ingest-worker', {
            body: { job_id: job.id }
          });

          if (error) {
            console.error('Error processing job:', job.id, error);
            errorCount++;
          } else {
            console.log('Job processed successfully:', job.id, data);
            successCount++;
          }
          
          // Wait a bit between jobs to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.error('Error invoking worker for job:', job.id, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} trabajo(s) procesado(s) exitosamente`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} trabajo(s) fallaron`);
      }
    } catch (error: any) {
      console.error('Error processing pending jobs:', error);
      toast.error('Error al procesar trabajos: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Button 
      onClick={processPendingJobs} 
      disabled={isProcessing}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
      {isProcessing ? 'Procesando...' : 'Procesar Pendientes'}
    </Button>
  );
}
