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

  try {
    const { contract_id } = await req.json();

    if (!contract_id) {
      return new Response(
        JSON.stringify({ error: 'contract_id is required' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🗑️ Eliminando contrato:', contract_id);

    // 1. Llamar a la función DB que elimina todo de la DB y retorna storage_paths
    const { data: deleteResult, error: dbError } = await supabaseClient
      .rpc('delete_contract_cascade', { p_contract_id: contract_id });

    if (dbError) {
      console.error('Error en delete_contract_cascade:', dbError);
      throw new Error(`Database deletion failed: ${dbError.message}`);
    }

    console.log('✅ Registros de DB eliminados:', deleteResult);

    // 2. Eliminar archivos de Storage
    const storagePaths = deleteResult.storage_paths || [];
    const storageErrors = [];

    for (const fileUrl of storagePaths) {
      if (!fileUrl) continue;
      
      // Extraer path del Storage (quitar prefijo de URL)
      const storagePath = fileUrl.replace(/^.*?contracts\//, '');
      
      console.log('🗑️ Eliminando archivo:', storagePath);
      
      const { error: storageError } = await supabaseClient.storage
        .from('contracts')
        .remove([storagePath]);
      
      if (storageError) {
        console.warn('⚠️ Error eliminando archivo (podría no existir):', storagePath, storageError);
        storageErrors.push({ path: storagePath, error: storageError.message });
      }
    }

    console.log(`🎉 Contrato ${deleteResult.contract_code} eliminado exitosamente`);

    return new Response(
      JSON.stringify({ 
        success: true,
        contract_code: deleteResult.contract_code,
        deleted_records: deleteResult.deleted_records,
        files_deleted: storagePaths.length,
        storage_errors: storageErrors.length > 0 ? storageErrors : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('❌ Error en delete-contract:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
