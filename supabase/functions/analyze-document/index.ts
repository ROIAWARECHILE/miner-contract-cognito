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

    // Get file size
    const arrayBuffer = await fileData.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    console.log('File downloaded, size:', fileSize, 'bytes');

    // Analyze document with Lovable AI (text-based analysis)
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
            content: `Eres un experto en análisis de contratos mineros. Basándote en el NOMBRE DEL ARCHIVO, extrae información básica del contrato.

Responde en JSON con esta estructura EXACTA:
{
  "contract_code": "código extraído del nombre del archivo",
  "contract_title": "título descriptivo basado en el nombre",
  "contract_type": "inferir tipo: concession|service|logistics|supply|offtake|joint_venture|royalty|community|environmental|other",
  "summary": "resumen breve basado en la información disponible"
}

IMPORTANTE: Solo usa la información del nombre del archivo. Deja otros campos como null.`
          },
          {
            role: 'user',
            content: `Analiza este contrato. Nombre del archivo: ${fileName}`
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
      throw new Error('No se pudo extraer información del contrato del nombre del archivo.');
    }

     console.log('Contract data extracted from filename:', {
      code: analysis.contract_code,
      title: analysis.contract_title,
      type: analysis.contract_type
    });

    // Create contract with extracted basic data
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        code: analysis.contract_code,
        title: analysis.contract_title,
        type: analysis.contract_type || 'other',
        status: 'draft',
        summary_ai: analysis.summary || `Contrato cargado: ${fileName}. Requiere revisión y completar información.`
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
        analysis_type: 'basic_extraction',
        raw_output_json: analysis,
        structured_output: analysis,
        model_used: 'google/gemini-2.5-flash',
        tokens_used: aiData.usage?.total_tokens || 0,
        processing_time_ms: 0,
        confidence_score: 0.5
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
        file_size: fileSize
      })
      .select()
      .single();

    if (docError) {
      console.error('Error storing document:', docError);
    }

    console.log('Document analysis completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        contract_id: contract.id,
        contract_code: contract.code,
        contract_title: contract.title,
        message: 'Contrato creado exitosamente. Completa la información faltante en el formulario de edición.',
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
