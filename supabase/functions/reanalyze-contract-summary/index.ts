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
    const { contract_code } = await req.json();
    
    if (!contract_code) {
      return new Response(
        JSON.stringify({ ok: false, error: "contract_code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[reanalyze] Starting re-analysis for contract: ${contract_code}`);

    // 1. Borrar el resumen ejecutivo actual
    const { error: deleteError } = await supabase
      .from("contract_summaries")
      .delete()
      .eq("contract_code", contract_code);

    if (deleteError) {
      console.error("[reanalyze] Error deleting summary:", deleteError);
      return new Response(
        JSON.stringify({ ok: false, error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[reanalyze] ✅ Existing summary deleted for ${contract_code}`);

    // 2. Obtener el contrato y sus documentos
    const { data: contract } = await supabase
      .from("contracts")
      .select("id")
      .eq("code", contract_code)
      .single();

    if (!contract) {
      return new Response(
        JSON.stringify({ ok: false, error: "Contract not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: documents } = await supabase
      .from("documents")
      .select("id, filename, file_url, doc_type")
      .eq("contract_id", contract.id)
      .in("doc_type", ["original", "annex", "technical_report"]);

    console.log(`[reanalyze] Found ${documents?.length || 0} documents to reprocess`);

    // 3. Re-crear jobs de procesamiento para cada documento relevante
    let jobsCreated = 0;
    for (const doc of documents || []) {
      // Extraer storage_path del file_url
      const urlParts = doc.file_url.split("/");
      const bucketIndex = urlParts.indexOf("contract-documents");
      if (bucketIndex === -1) {
        console.warn(`[reanalyze] Could not extract storage path from: ${doc.file_url}`);
        continue;
      }
      
      const storage_path = urlParts.slice(bucketIndex + 1).join("/");

      const { error: jobError } = await supabase
        .from("document_processing_jobs")
        .insert({
          contract_id: contract.id,
          storage_path,
          document_type: "contract_summary_reanalysis",
          status: "queued"
        });

      if (!jobError) {
        jobsCreated++;
        console.log(`[reanalyze] Created job for: ${doc.filename}`);
      } else {
        console.error(`[reanalyze] Failed to create job for ${doc.filename}:`, jobError);
      }
    }

    console.log(`[reanalyze] ✅ Created ${jobsCreated} reanalysis jobs for ${contract_code}`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: `Re-análisis iniciado para ${contract_code}`,
        jobs_created: jobsCreated,
        documents_found: documents?.length || 0
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[reanalyze] Unexpected error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
