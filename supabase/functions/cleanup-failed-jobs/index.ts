import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    // Health check endpoint
    return new Response(
      JSON.stringify({ status: 'ok', function: 'cleanup-failed-jobs' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const results = {
      document_processing_jobs_deleted: 0,
      ingest_jobs_marked_failed: 0,
      ingest_logs_deleted: 0
    };

    console.log('🧹 Starting cleanup process...');

    // 1. Eliminar document_processing_jobs fallidos >7 días
    const { data: oldFailedJobs, error: deleteJobsError } = await supabaseClient
      .from('document_processing_jobs')
      .delete()
      .in('status', ['failed', 'completed'])
      .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .select('id');

    if (deleteJobsError) {
      console.error('Error eliminando jobs fallidos:', deleteJobsError);
    } else {
      results.document_processing_jobs_deleted = oldFailedJobs?.length || 0;
      console.log(`✅ Deleted ${results.document_processing_jobs_deleted} old processing jobs`);
    }

    // 2. Marcar ingest_jobs estancados >2 días como failed
    const { data: staleIngestJobs, error: updateIngestError } = await supabaseClient
      .from('ingest_jobs')
      .update({ 
        status: 'failed',
        last_error: 'Job timeout: exceeded 2 days in queued/processing state'
      })
      .in('status', ['queued', 'processing'])
      .lt('created_at', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
      .select('id');

    if (updateIngestError) {
      console.error('Error marcando ingest_jobs como fallidos:', updateIngestError);
    } else {
      results.ingest_jobs_marked_failed = staleIngestJobs?.length || 0;
      console.log(`✅ Marked ${results.ingest_jobs_marked_failed} ingest jobs as failed`);
    }

    // 3. Eliminar ingest_logs >60 días
    const { data: oldLogs, error: deleteLogsError } = await supabaseClient
      .from('ingest_logs')
      .delete()
      .lt('created_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
      .select('id');

    if (deleteLogsError) {
      console.error('Error eliminando logs antiguos:', deleteLogsError);
    } else {
      results.ingest_logs_deleted = oldLogs?.length || 0;
      console.log(`✅ Deleted ${results.ingest_logs_deleted} old logs`);
    }

    // 4. Llamar a función DB cleanup_stale_processing_jobs
    const { error: dbCleanupError } = await supabaseClient.rpc('cleanup_stale_processing_jobs');
    
    if (dbCleanupError) {
      console.error('Error ejecutando cleanup_stale_processing_jobs:', dbCleanupError);
    } else {
      console.log('✅ Database cleanup function executed');
    }

    console.log('🎉 Cleanup completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        results,
        message: `Limpieza completada: ${results.document_processing_jobs_deleted} jobs eliminados, ${results.ingest_jobs_marked_failed} ingest jobs marcados como failed, ${results.ingest_logs_deleted} logs eliminados`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('❌ Error en cleanup-failed-jobs:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
