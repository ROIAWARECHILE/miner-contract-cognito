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

    const { contract_id } = await req.json();

    if (!contract_id) {
      throw new Error("Missing 'contract_id' in request body");
    }

    // 1. Get all documents for the contract
    const { data: documents, error: docError } = await supabase
      .from("documents")
      .select("file_url, doc_type")
      .eq("contract_id", contract_id);

    if (docError) throw docError;
    if (!documents || documents.length === 0) {
      return new Response(JSON.stringify({ message: "No documents found for this contract." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Invoke the 'process-document' function for each document
    // We do this asynchronously without waiting for all to complete
    const processingPromises = documents.map(doc => {
      return supabase.functions.invoke('process-document', {
        body: {
          storage_path: doc.file_url,
          document_type: doc.doc_type,
          contract_id: contract_id
        },
      });
    });

    // Don't wait for all promises to resolve to keep the request short.
    // The processing will happen in the background.
    Promise.allSettled(processingPromises).then(results => {
      console.log(`Reprocessing triggered for ${results.length} documents.`);
    });

    return new Response(JSON.stringify({
      message: `Reprocessing started for ${documents.length} documents. Check the job monitor for progress.`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
