import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { storage_path, etag, file_hash, project_prefix } = await req.json();

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

    return new Response(
      JSON.stringify({ 
        message: 'Job enqueued successfully',
        job_id: job.id,
        storage_path
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
