// Sprint 4: Health check endpoint for contract summaries
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const contractCode = url.searchParams.get('contract_code');

    if (!contractCode) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'contract_code parameter is required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check contract summary health
    const { data, error } = await supabase
      .from('contract_summaries')
      .select('id, contract_code, summary_json, updated_at, created_at')
      .eq('contract_code', contractCode)
      .maybeSingle();

    if (error) {
      console.error('[check-contract-summary] Database error:', error);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: error.message,
          contract_code: contractCode,
          exists: false
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const healthStatus = {
      ok: true,
      contract_code: contractCode,
      exists: !!data,
      has_data: !!data?.summary_json,
      cards_count: data?.summary_json?.cards?.length || 0,
      categories: data?.summary_json?.cards?.map((c: any) => c.category) || [],
      provenance_files: [
        data?.summary_json?.provenance?.contract_file,
        ...(data?.summary_json?.provenance?.annexes || [])
      ].filter(Boolean),
      confidence: data?.summary_json?.meta?.confidence || null,
      last_updated: data?.updated_at || null,
      created_at: data?.created_at || null,
      status: !data 
        ? 'not_found' 
        : !data.summary_json 
        ? 'empty' 
        : (data.summary_json.cards?.length || 0) > 0 
        ? 'healthy' 
        : 'no_cards'
    };

    console.log('[check-contract-summary] Health check:', healthStatus);

    return new Response(
      JSON.stringify(healthStatus),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[check-contract-summary] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});