import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileName, filePath } = await req.json();
    
    console.log('Starting document analysis:', { fileName, filePath });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download file from storage
    console.log('Downloading file from storage...');
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('contract-documents')
      .download(filePath);

    if (downloadError) {
      console.error('Error downloading file:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert to base64 for AI analysis (process in chunks to avoid stack overflow)
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binary);
    
    console.log('File downloaded, size:', arrayBuffer.byteLength, 'bytes');

    // Analyze document with Lovable AI
    console.log('Analyzing document with AI...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Eres un experto en análisis de contratos mineros. Analiza el documento PDF y extrae TODA la información del contrato.

IMPORTANTE: Debes extraer la información completa para crear automáticamente el contrato en el sistema.

Responde en JSON con esta estructura EXACTA:
{
  "contract_code": "código único del contrato (busca en encabezado o portada)",
  "contract_title": "título completo del contrato",
  "contract_type": "uno de: concession|service|logistics|supply|offtake|joint_venture|royalty|community|environmental|other",
  "company_name": "nombre de la empresa contratista principal",
  "asset_name": "nombre del activo, proyecto o mina",
  "start_date": "YYYY-MM-DD (fecha de inicio del contrato)",
  "end_date": "YYYY-MM-DD (fecha de fin o vencimiento)",
  "contract_value": 0 (valor total del contrato en números),
  "currency": "USD|CLP|EUR|UF (moneda del contrato)",
  "country": "país donde se ejecuta el contrato",
  "mineral": "mineral o recurso principal (cobre, oro, litio, etc.)",
  "summary": "resumen ejecutivo del contrato en 2-3 párrafos",
  "parties": ["empresa1", "empresa2"],
  "key_dates": [{"type": "inicio|fin|hito|renovacion", "date": "YYYY-MM-DD", "description": "descripción"}],
  "obligations": [{"type": "payment|reporting|delivery|other", "description": "obligación", "due_date": "YYYY-MM-DD", "priority": "high|medium|low"}],
  "alerts": [{"priority": "high|medium|low", "title": "título", "description": "descripción del riesgo o alerta"}]
}

Si no encuentras un dato, usa null. Sé preciso en las fechas y valores numéricos.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analiza este documento del contrato. Nombre del archivo: ${fileName}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`
                }
              }
            ]
          }
        ]
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices[0].message.content;
    
    console.log('AI analysis completed');
    
    // Parse JSON from AI response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    
    if (!analysis || !analysis.contract_code || !analysis.contract_title) {
      throw new Error('No se pudo extraer la información del contrato. Asegúrate de subir un documento válido.');
    }

    console.log('Contract data extracted:', {
      code: analysis.contract_code,
      title: analysis.contract_title,
      type: analysis.contract_type
    });

    // Create or get company
    let companyId = null;
    if (analysis.company_name) {
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .ilike('name', analysis.company_name)
        .single();

      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({ name: analysis.company_name })
          .select('id')
          .single();
        
        if (!companyError && newCompany) {
          companyId = newCompany.id;
        }
      }
    }

    // Create or get asset
    let assetId = null;
    if (analysis.asset_name) {
      const { data: existingAsset } = await supabase
        .from('assets')
        .select('id')
        .ilike('name', analysis.asset_name)
        .single();

      if (existingAsset) {
        assetId = existingAsset.id;
      } else {
        const { data: newAsset, error: assetError } = await supabase
          .from('assets')
          .insert({
            name: analysis.asset_name,
            asset_type: 'mine',
            country: analysis.country
          })
          .select('id')
          .single();
        
        if (!assetError && newAsset) {
          assetId = newAsset.id;
        }
      }
    }

    // Create contract with all extracted data
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        code: analysis.contract_code,
        title: analysis.contract_title,
        type: analysis.contract_type || 'other',
        status: 'active',
        company_id: companyId,
        asset_id: assetId,
        start_date: analysis.start_date,
        end_date: analysis.end_date,
        contract_value: analysis.contract_value,
        currency: analysis.currency || 'USD',
        country: analysis.country,
        mineral: analysis.mineral,
        summary_ai: analysis.summary
      })
      .select()
      .single();

    if (contractError) {
      console.error('Error creating contract:', contractError);
      throw new Error(`No se pudo crear el contrato: ${contractError.message}`);
    }

    console.log('Contract created:', contract.id);

    // Store AI analysis
    const { data: aiAnalysis, error: aiError } = await supabase
      .from('ai_analyses')
      .insert({
        contract_id: contract.id,
        analysis_type: 'full_contract',
        raw_output_json: analysis,
        structured_output: analysis,
        model_used: 'google/gemini-2.5-flash',
        tokens_used: aiData.usage?.total_tokens || 0,
        processing_time_ms: 0,
        confidence_score: 0.85
      })
      .select()
      .single();

    if (aiError) {
      console.error('Error storing AI analysis:', aiError);
    }

    // Store document record
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        contract_id: contract.id,
        filename: fileName,
        file_url: filePath,
        doc_type: 'original',
        file_size: arrayBuffer.byteLength
      })
      .select()
      .single();

    if (docError) {
      console.error('Error storing document:', docError);
    }

    // Create obligations from analysis
    if (analysis.obligations && Array.isArray(analysis.obligations)) {
      const obligations = analysis.obligations.map((obl: any) => ({
        contract_id: contract.id,
        type: obl.type || 'other',
        description: obl.description,
        due_date: obl.due_date,
        criticality: obl.priority || 'medium',
        status: 'pending'
      }));

      if (obligations.length > 0) {
        const { error: oblError } = await supabase
          .from('obligations')
          .insert(obligations);
        
        if (oblError) {
          console.error('Error creating obligations:', oblError);
        } else {
          console.log('Created', obligations.length, 'obligations');
        }
      }
    }

    // Create alerts from analysis
    if (analysis.alerts && Array.isArray(analysis.alerts)) {
      const alerts = analysis.alerts.map((alert: any) => ({
        entity_type: 'contract',
        entity_id: contract.id,
        title: alert.title,
        alert_date: new Date().toISOString().split('T')[0],
        priority: alert.priority || 'medium',
        status: 'new',
        notes: alert.description
      }));

      if (alerts.length > 0) {
        const { error: alertError } = await supabase
          .from('alerts')
          .insert(alerts);
        
        if (alertError) {
          console.error('Error creating alerts:', alertError);
        } else {
          console.log('Created', alerts.length, 'alerts');
        }
      }
    }

    console.log('Document analysis completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        contract_id: contract.id,
        contract_code: contract.code,
        contract_title: contract.title,
        analysis,
        documentId: document?.id,
        analysisId: aiAnalysis?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
