import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Wrench } from 'lucide-react';

export default function FixBrokenJobs({ contractId }: { contractId: string }) {
  const [isFixing, setIsFixing] = useState(false);

  const fixBrokenJobs = async () => {
    setIsFixing(true);
    try {
      // Find broken jobs (NULL contract_id OR wrong document_type)
      const { data: brokenJobs, error: fetchError } = await supabase
        .from('ingest_jobs')
        .select('*')
        .or('contract_id.is.null,status.eq.failed');

      if (fetchError) throw fetchError;

      if (!brokenJobs || brokenJobs.length === 0) {
        toast.info('✓ No hay jobs rotos para reparar');
        setIsFixing(false);
        return;
      }

      console.log(`Found ${brokenJobs.length} broken jobs, attempting to fix...`);
      let fixed = 0;

      for (const job of brokenJobs) {
        try {
          // Auto-detect document_type from storage_path
          const pathParts = job.storage_path.split('/');
          const detectedDocType = pathParts.length >= 2 ? pathParts[1] : 'contract';

          // Update job with correct contract_id and document_type
          const { error: updateError } = await supabase
            .from('ingest_jobs')
            .update({
              contract_id: contractId,
              document_type: detectedDocType,
              status: 'queued',
              last_error: null,
              attempts: 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id);

          if (updateError) {
            console.error(`Failed to fix job ${job.id}:`, updateError);
            continue;
          }

          // Log the fix
          await supabase.from('ingest_logs').insert({
            job_id: job.id,
            step: 'repair',
            message: `Job reparado: contract_id asignado, document_type = ${detectedDocType}, re-encolado`,
            meta: { 
              old_contract_id: job.contract_id, 
              new_contract_id: contractId,
              old_document_type: job.document_type,
              new_document_type: detectedDocType
            }
          });

          fixed++;
          console.log(`✓ Fixed job ${job.id}: ${job.storage_path}`);
        } catch (jobError) {
          console.error(`Error fixing job ${job.id}:`, jobError);
        }
      }

      if (fixed > 0) {
        toast.success(`✅ ${fixed} job(s) reparado(s) y re-encolado(s)`);
      } else {
        toast.warning('⚠️ No se pudieron reparar los jobs');
      }

    } catch (error) {
      console.error('Error fixing broken jobs:', error);
      toast.error('Error reparando jobs: ' + (error as Error).message);
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <Button
      onClick={fixBrokenJobs}
      disabled={isFixing}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <Wrench className="h-4 w-4" />
      {isFixing ? 'Reparando...' : 'Reparar Jobs Rotos'}
    </Button>
  );
}
