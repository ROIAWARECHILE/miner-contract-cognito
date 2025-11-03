import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Wrench } from "lucide-react";

export default function FixStuckJobButton() {
  const [isFixing, setIsFixing] = useState(false);

  const fixStuckJobs = async () => {
    setIsFixing(true);
    try {
      // Get all failed jobs with filename issues (spaces in names)
      const { data: failedJobs, error: jobsError } = await supabase
        .from('ingest_jobs')
        .select('*')
        .eq('status', 'failed')
        .ilike('last_error', '%PDF parsing failed%')
        .order('created_at', { ascending: false })
        .limit(10);

      if (jobsError) throw jobsError;

      if (!failedJobs || failedJobs.length === 0) {
        toast.info('No hay trabajos con errores de parsing');
        return;
      }

      console.log('Found failed jobs with parsing errors:', failedJobs.length);
      
      let fixedCount = 0;
      
      for (const job of failedJobs) {
        try {
          const oldPath = job.storage_path;
          const pathParts = oldPath.split('/');
          const oldFilename = pathParts[pathParts.length - 1];
          
          // Sanitize filename: replace spaces with underscores
          const newFilename = oldFilename
            .replace(/\s+/g, '_')
            .replace(/[^\w\.\-\u00C0-\u017F_]/g, '')
            .replace(/_+/g, '_');
          
          if (oldFilename === newFilename) {
            console.log('Filename already clean:', oldFilename);
            continue;
          }
          
          const newPath = [...pathParts.slice(0, -1), newFilename].join('/');
          
          console.log('Renaming file in storage:', { oldPath, newPath });
          
          // Move/copy file to new path
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('contracts')
            .download(oldPath);
          
          if (downloadError) {
            console.error('Failed to download for rename:', downloadError);
            continue;
          }
          
          // Upload with new name
          const { error: uploadError } = await supabase.storage
            .from('contracts')
            .upload(newPath, fileData, { upsert: true });
          
          if (uploadError) {
            console.error('Failed to upload renamed file:', uploadError);
            continue;
          }
          
          // Update job with new path and reset status
          const { error: updateError } = await supabase
            .from('ingest_jobs')
            .update({
              storage_path: newPath,
              status: 'queued',
              last_error: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id);
          
          if (updateError) {
            console.error('Failed to update job:', updateError);
            continue;
          }
          
          // Try to delete old file (optional, don't fail if it errors)
          await supabase.storage
            .from('contracts')
            .remove([oldPath])
            .catch(err => console.log('Old file cleanup failed (non-critical):', err));
          
          console.log('Fixed job:', job.id);
          fixedCount++;
        } catch (err) {
          console.error('Error fixing job:', job.id, err);
        }
      }

      if (fixedCount > 0) {
        toast.success(`${fixedCount} trabajo(s) reparado(s). Haz clic en "Procesar Pendientes" para reintentar.`);
      } else {
        toast.info('No se pudieron reparar trabajos automáticamente');
      }
    } catch (error: any) {
      console.error('Error fixing stuck jobs:', error);
      toast.error('Error al reparar trabajos: ' + error.message);
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <Button 
      onClick={fixStuckJobs} 
      disabled={isFixing}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <Wrench className={`h-4 w-4 ${isFixing ? 'animate-spin' : ''}`} />
      {isFixing ? 'Reparando...' : 'Reparar Errores'}
    </Button>
  );
}
