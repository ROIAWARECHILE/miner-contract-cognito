import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Background processing function
async function processJobInBackground(jobId: string, supabaseUrl: string, supabaseKey: string) {
  try {
    console.log(`Starting background processing for job ${jobId}`);
    
    // Call ingest-worker to process this specific job
    const response = await fetch(`${supabaseUrl}/functions/v1/ingest-worker`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ job_id: jobId })
    });

    const result = await response.json();
    console.log(`Background processing completed for job ${jobId}:`, result);
  } catch (error) {
    console.error(`Background processing failed for job ${jobId}:`, error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { storage_path, etag, file_hash, project_prefix, contract_id, document_type } = await req.json();

    if (!storage_path || !project_prefix) {
      return new Response(
        JSON.stringify({ error: 'storage_path and project_prefix are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create job (on conflict do nothing due to unique constraint)
    const { data: job, error: jobError } = await supabase
      .from('ingest_jobs')
      .insert({
        project_prefix,
        storage_path,
        file_hash,
        etag,
        contract_id,
        document_type: document_type || 'contract',
        status: 'queued',
        attempts: 0
      })
      .select()
      .single();

    if (jobError && jobError.code !== '23505') { // 23505 is unique violation
      console.error('Error creating job:', jobError);
      return new Response(
        JSON.stringify({ error: 'Failed to create job', details: jobError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If job already exists (unique violation), return success
    if (jobError?.code === '23505') {
      return new Response(
        JSON.stringify({ 
          message: 'Job already queued or processed',
          storage_path,
          status: 'skipped'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log job creation
    await supabase.from('ingest_logs').insert({
      job_id: job.id,
      step: 'enqueued',
      message: `Job enqueued for ${storage_path}`,
      meta: { project_prefix, etag, file_hash }
    });

    // Start background processing immediately (no await)
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined') {
      // @ts-ignore
      EdgeRuntime.waitUntil(processJobInBackground(job.id, supabaseUrl, supabaseKey));
    } else {
      // Fallback for local development
      processJobInBackground(job.id, supabaseUrl, supabaseKey).catch(console.error);
    }

    return new Response(
      JSON.stringify({ 
        message: 'Job enqueued and processing started',
        job_id: job.id,
        storage_path,
        status: 'processing'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ingest-enqueue:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
