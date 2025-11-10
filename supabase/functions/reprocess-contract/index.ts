import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { contract_code, document_type = 'contract' } = await req.json();

    if (!contract_code) {
      return new Response(
        JSON.stringify({ error: "contract_code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔄 Re-processing contract: ${contract_code} (type: ${document_type})`);

    // 1. Get contract
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, code')
      .eq('code', contract_code)
      .single();

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ error: `Contract not found: ${contract_code}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Find contract document in storage (try multiple paths)
    const possiblePaths = [
      `dominga/${contract_code}/contract/`,
      `dominga/contract/`,
      `${contract_code}/`,
    ];

    let contractFile = null;
    let storagePath = null;

    for (const path of possiblePaths) {
      console.log(`Checking path: ${path}`);
      const { data: files, error: listError } = await supabase.storage
        .from('contracts')
        .list(path);

      if (!listError && files && files.length > 0) {
        // Find PDF file with contract code or "contrato" in name
        contractFile = files.find(f => 
          f.name.toLowerCase().includes('contrato') || 
          f.name.toLowerCase().includes(contract_code.toLowerCase())
        );
        
        if (contractFile) {
          storagePath = `${path}${contractFile.name}`;
          console.log(`✓ Found contract file: ${storagePath}`);
          break;
        }
      }
    }

    if (!contractFile || !storagePath) {
      return new Response(
        JSON.stringify({ 
          error: "No contract document found in storage",
          searched_paths: possiblePaths,
          suggestion: "Please upload the contract PDF manually"
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check if document already exists in documents table
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id, processing_status')
      .eq('contract_id', contract.id)
      .eq('doc_type', document_type)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 4. Create or update processing job
    const { data: job, error: jobError } = await supabase
      .from('document_processing_jobs')
      .insert({
        contract_id: contract.id,
        storage_path: storagePath,
        document_type: document_type,
        status: 'queued'
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      return new Response(
        JSON.stringify({ error: `Failed to create processing job: ${jobError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✓ Created processing job: ${job.id}`);

    // 5. Invoke process-document function
    const { data: processResult, error: processError } = await supabase.functions.invoke('process-document', {
      body: {
        contract_code: contract_code,
        storage_path: storagePath,
        document_type: document_type,
        job_id: job.id,
        reprocessing: true,
        existing_doc_id: existingDoc?.id
      }
    });

    if (processError) {
      console.error('Error invoking process-document:', processError);
      
      // Update job status to failed
      await supabase
        .from('document_processing_jobs')
        .update({ 
          status: 'failed', 
          error: processError.message 
        })
        .eq('id', job.id);

      return new Response(
        JSON.stringify({ 
          error: `Failed to invoke process-document: ${processError.message}`,
          job_id: job.id
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('✓ Process-document invoked successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Re-processing started for contract ${contract_code}`,
        job_id: job.id,
        storage_path: storagePath,
        document_type: document_type,
        existing_doc: existingDoc ? 'Will update existing document' : 'Will create new document',
        process_result: processResult
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
