import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileName, fileUrl, contractId } = await req.json();
    console.log('Analyzing document:', { fileName, fileUrl, contractId });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract text from filename and prepare for AI analysis
    const extractionPrompt = `You are a contract analysis expert specializing in Chilean mining contracts. Analyze the following contract filename and extract all possible information:

Filename: ${fileName}

Extract and structure the following information in JSON format:
{
  "contract_code": "string - Extract the contract code (e.g., AIPD-CSI001-1000-MN-0001)",
  "contract_title": "string - Infer a descriptive title based on the filename and content indicators",
  "contract_type": "service|supply|maintenance - Determine the contract type",
  "parties": {
    "client": { "name": "string", "rut": "string or null" },
    "contractor": { "name": "string", "rut": "string or null" }
  },
  "dates": {
    "start_date": "YYYY-MM-DD or null",
    "end_date": "YYYY-MM-DD or null"
  },
  "financial": {
    "total_value": number or null,
    "currency": "UF|CLP|USD or null"
  },
  "summary": "string - Brief summary of the contract purpose",
  "initial_tasks": [
    {
      "task_number": "string",
      "task_name": "string",
      "budget_uf": number or null
    }
  ]
}

Important notes:
- Contract codes usually follow patterns like AIPD-CSI001-1000-MN-0001
- Look for company names (Andes Iron, Itasca, CSI, etc.)
- Look for contract type indicators (Contrato, Servicio, Suministro, etc.)
- Be conservative - if you cannot determine a value, use null
- Extract as much as possible from the filename structure`;

    console.log('Calling Lovable AI...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a contract analysis expert. Always respond with valid JSON only.' },
          { role: 'user', content: extractionPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const extractedData = JSON.parse(aiData.choices[0].message.content);
    console.log('Extracted data:', extractedData);

    // Create or find companies
    let clientCompanyId = null;
    let contractorCompanyId = null;

    if (extractedData.parties?.client?.name) {
      const { data: existingClient } = await supabase
        .from('companies')
        .select('id')
        .ilike('name', extractedData.parties.client.name)
        .single();

      if (existingClient) {
        clientCompanyId = existingClient.id;
      } else {
        const { data: newClient } = await supabase
          .from('companies')
          .insert({
            name: extractedData.parties.client.name,
            country: 'Chile'
          })
          .select('id')
          .single();
        
        if (newClient) clientCompanyId = newClient.id;
      }
    }

    if (extractedData.parties?.contractor?.name) {
      const { data: existingContractor } = await supabase
        .from('companies')
        .select('id')
        .ilike('name', extractedData.parties.contractor.name)
        .single();

      if (existingContractor) {
        contractorCompanyId = existingContractor.id;
      } else {
        const { data: newContractor } = await supabase
          .from('companies')
          .insert({
            name: extractedData.parties.contractor.name,
            country: 'Chile'
          })
          .select('id')
          .single();
        
        if (newContractor) contractorCompanyId = newContractor.id;
      }
    }

    // Update contract with extracted information
    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        code: extractedData.contract_code || 'UNKNOWN',
        title: extractedData.contract_title || fileName,
        type: extractedData.contract_type || 'service',
        company_id: clientCompanyId,
        start_date: extractedData.dates?.start_date,
        end_date: extractedData.dates?.end_date,
        contract_value: extractedData.financial?.total_value,
        currency: extractedData.financial?.currency || 'UF',
        summary_ai: extractedData.summary,
        document_url: fileUrl
      })
      .eq('id', contractId);

    if (updateError) {
      console.error('Error updating contract:', updateError);
      throw updateError;
    }

    // Create relationship between companies if both exist
    if (clientCompanyId && contractorCompanyId) {
      await supabase.from('relationships').insert({
        source_type: 'company',
        source_id: clientCompanyId,
        target_type: 'company',
        target_id: contractorCompanyId,
        relation_type: 'client_contractor',
        metadata: { contract_id: contractId }
      });
    }

    // Create initial tasks if available
    if (extractedData.initial_tasks?.length > 0) {
      const tasks = extractedData.initial_tasks.map((task: any) => ({
        contract_id: contractId,
        task_number: task.task_number,
        task_name: task.task_name,
        budget_uf: task.budget_uf || 0,
        spent_uf: 0,
        progress_percentage: 0
      }));

      await supabase.from('contract_tasks').insert(tasks);
    }

    // Save AI analysis
    await supabase.from('ai_analyses').insert({
      contract_id: contractId,
      analysis_type: 'initial_contract_creation',
      model_used: 'google/gemini-2.5-flash',
      raw_output_json: aiData,
      structured_output: extractedData
    });

    return new Response(
      JSON.stringify({
        success: true,
        extracted: extractedData,
        client_company_id: clientCompanyId,
        contractor_company_id: contractorCompanyId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-document:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
