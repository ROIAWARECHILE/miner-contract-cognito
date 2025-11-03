import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractId, fileName, filePath, documentType } = await req.json();
    console.log('Analyzing additional document:', { contractId, fileName, filePath, documentType });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('contract-documents')
      .download(filePath);

    if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);

    // Prepare AI prompt based on document type
    let systemPrompt = '';
    let extractionSchema: any = {};

    if (documentType === 'edp') {
      systemPrompt = `Eres un experto en análisis de Estados de Pago (EDPs) de contratos mineros.
      
Analiza el nombre del archivo y extrae la siguiente información:
- Número de EDP
- Período (mes-año)
- Si es posible inferir el monto desde el nombre del archivo

IMPORTANTE: Retorna SOLO la información que puedas extraer con certeza del nombre del archivo.
Para un análisis completo del contenido PDF, necesitarás OCR avanzado (próxima versión).`;

      extractionSchema = {
        document_type: 'edp',
        edp_number: null,
        period: null,
        amount_uf: null,
        confidence: 'low', // Indicador de que es extracción básica
        note: 'Extracción básica desde nombre de archivo. Requiere verificación manual.'
      };
    } else if (documentType === 'sdi') {
      systemPrompt = `Eres un experto en análisis de Solicitudes de Información (SDIs) de contratos mineros.
      
Analiza el nombre del archivo y extrae la siguiente información básica:
- Número de SDI
- Si puedes inferir el tema o tipo de solicitud

Para análisis completo del contenido, se requiere OCR avanzado.`;

      extractionSchema = {
        document_type: 'sdi',
        sdi_number: null,
        topic: null,
        confidence: 'low'
      };
    } else {
      systemPrompt = `Analiza el nombre del archivo y clasifica el tipo de documento:
- plan_tecnico
- anexo
- certificado
- informe
- correspondencia
- otro

Extrae cualquier información básica visible en el nombre del archivo.`;

      extractionSchema = {
        document_type: documentType || 'otro',
        classification: null,
        basic_info: null,
        confidence: 'low'
      };
    }

    // Call Lovable AI for analysis
    console.log('Calling Lovable AI...');
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
            content: systemPrompt
          },
          { 
            role: 'user', 
            content: `Analiza este nombre de archivo: \"${fileName}\"\

Retorna el resultado en formato JSON siguiendo este esquema: ${JSON.stringify(extractionSchema)}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI analysis failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const analysisResult = aiData.choices[0].message.content;
    console.log('AI analysis result:', analysisResult);

    // Parse AI response
    let structuredOutput;
    try {
      const jsonMatch = analysisResult.match(/\{[\s\S]*\}/);
      structuredOutput = jsonMatch ? JSON.parse(jsonMatch[0]) : extractionSchema;
    } catch (e) {
      console.error('Failed to parse AI response, using basic extraction:', e);
      structuredOutput = {
        ...extractionSchema,
        raw_filename: fileName,
        note: 'Extracción automática no disponible. Revisa manualmente el documento.'
      };
    }

    // Save AI analysis
    const { data: analysisData, error: analysisError } = await supabase
      .from('ai_analyses')
      .insert({
        contract_id: contractId,
        analysis_type: 'full_contract', // Using existing type
        raw_output_json: { ai_response: analysisResult },
        structured_output: structuredOutput,
        model_used: 'google/gemini-2.5-flash',
        confidence_score: structuredOutput.confidence === 'low' ? 0.3 : 0.7,
      })
      .select()
      .single();

    if (analysisError) {
      console.error('Failed to save analysis:', analysisError);
    }

    // Update contract if it's an EDP with extracted data
    if (documentType === 'edp' && structuredOutput.amount_uf) {
      const { error: updateError } = await supabase
        .from('contracts')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', contractId);

      if (updateError) {
        console.error('Failed to update contract:', updateError);
      }
    }

    // Create document record (not moving file, keeping in temp)
    const { data: documentData, error: docError } = await supabase
      .from('documents')
      .insert({
        contract_id: contractId,
        filename: fileName,
        file_url: filePath,
        doc_type: 'amendment', // Using existing enum value
        file_size: fileData.size,
      })
      .select()
      .single();

    if (docError) throw new Error(`Failed to create document record: ${docError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Documento \"${fileName}\" agregado al contrato. Análisis básico completado.`,
        document_id: documentData.id,
        analysis_id: analysisData?.id,
        extracted_data: structuredOutput,
        note: 'Para análisis completo del contenido PDF se requiere OCR avanzado (próxima versión). Verifica y completa la información manualmente.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in analyze-additional-document:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Error al procesar el documento adicional'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
