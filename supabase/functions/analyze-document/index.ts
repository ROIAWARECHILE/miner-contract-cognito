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
    const { contractId, fileName, filePath } = await req.json();
    
    console.log('Starting document analysis:', { contractId, fileName, filePath });

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

    // Convert to base64 for AI analysis
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
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
            content: `Eres un experto en análisis de contratos mineros. Analiza el documento y extrae:
1. Tipo de documento (contrato, adenda, reporte, etc.)
2. Fechas clave (inicio, fin, hitos importantes)
3. Valores monetarios y términos de pago
4. Obligaciones y responsabilidades
5. Alertas o riesgos potenciales
6. Partes involucradas

Responde en JSON con esta estructura:
{
  "document_type": "tipo",
  "parties": ["parte1", "parte2"],
  "key_dates": [{"type": "tipo", "date": "YYYY-MM-DD", "description": "desc"}],
  "monetary_values": [{"amount": 0, "currency": "USD", "description": "desc"}],
  "obligations": [{"type": "payment|reporting|delivery|other", "description": "desc", "due_date": "YYYY-MM-DD", "priority": "high|medium|low"}],
  "alerts": [{"priority": "high|medium|low", "title": "título", "description": "desc"}],
  "summary": "resumen ejecutivo"
}`
          },
          {
            role: 'user',
            content: `Analiza este documento del contrato. Nombre del archivo: ${fileName}`
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
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: analysisText };

    // Store AI analysis
    const { data: aiAnalysis, error: aiError } = await supabase
      .from('ai_analyses')
      .insert({
        contract_id: contractId,
        analysis_type: 'document_upload',
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
      throw aiError;
    }

    // Store document record
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        contract_id: contractId,
        filename: fileName,
        file_url: filePath,
        doc_type: 'original',
        file_size: arrayBuffer.byteLength
      })
      .select()
      .single();

    if (docError) {
      console.error('Error storing document:', docError);
      throw docError;
    }

    // Create obligations from analysis
    if (analysis.obligations && Array.isArray(analysis.obligations)) {
      const obligations = analysis.obligations.map((obl: any) => ({
        contract_id: contractId,
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
        entity_id: contractId,
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
        analysis,
        documentId: document.id,
        analysisId: aiAnalysis.id
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
