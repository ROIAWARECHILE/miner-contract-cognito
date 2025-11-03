import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractId, fileName, fileUrl } = await req.json();

    if (!contractId || !fileName || !fileUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get LOVABLE_API_KEY
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing document:", fileName, "for contract:", contractId);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("contract-documents")
      .download(fileUrl);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert file to base64 for AI processing
    const buffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    // Analyze document with Lovable AI
    const systemPrompt = `Eres un asistente experto en análisis de contratos mineros chilenos. 
Tu tarea es analizar documentos y extraer información clave.
Identifica el tipo de documento (contrato principal, EDP, SDI, plan, comunicación) y extrae:
- Fechas importantes (inicio, fin, hitos, plazos)
- Montos en UF o pesos chilenos
- Porcentajes de avance o cumplimiento
- Códigos de referencia (EDPs, SDIs, etc.)
- Obligaciones y compromisos
- Alertas de SLA o próximos vencimientos

Responde en formato estructurado con las secciones: tipo_documento, fechas_clave, montos, obligaciones, alertas.`;

    const userPrompt = `Analiza el siguiente documento llamado "${fileName}" y extrae toda la información relevante para gestión de contratos mineros.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_document_info",
              description: "Extract structured information from mining contract documents",
              parameters: {
                type: "object",
                properties: {
                  tipo_documento: {
                    type: "string",
                    enum: ["contrato_principal", "edp", "sdi", "plan", "comunicacion", "otro"],
                    description: "Tipo de documento identificado",
                  },
                  fechas_clave: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        fecha: { type: "string", format: "date" },
                        descripcion: { type: "string" },
                      },
                    },
                  },
                  montos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        valor: { type: "number" },
                        moneda: { type: "string" },
                        concepto: { type: "string" },
                      },
                    },
                  },
                  obligaciones: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        descripcion: { type: "string" },
                        plazo: { type: "string" },
                        responsable: { type: "string" },
                      },
                    },
                  },
                  alertas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tipo: { type: "string" },
                        mensaje: { type: "string" },
                        prioridad: { type: "string", enum: ["baja", "media", "alta"] },
                      },
                    },
                  },
                  resumen: { type: "string" },
                },
                required: ["tipo_documento", "resumen"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_document_info" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    const extractedData = toolCall?.function?.arguments
      ? JSON.parse(toolCall.function.arguments)
      : { tipo_documento: "otro", resumen: "No se pudo extraer información" };

    // Save analysis to database
    const { error: insertError } = await supabase.from("ai_analyses").insert({
      contract_id: contractId,
      analysis_type: "document_extraction",
      model_used: "google/gemini-2.5-flash",
      raw_output_json: aiResult,
      structured_output: extractedData,
      confidence_score: 0.85,
    });

    if (insertError) {
      console.error("Failed to save analysis:", insertError);
    }

    // Create document record
    const { error: docError } = await supabase.from("documents").insert({
      contract_id: contractId,
      filename: fileName,
      file_url: fileUrl,
      doc_type: extractedData.tipo_documento === "edp" ? "edp" : "original",
    });

    if (docError) {
      console.error("Failed to save document record:", docError);
    }

    // Create obligations from extracted data
    if (extractedData.obligaciones?.length > 0) {
      const obligations = extractedData.obligaciones.map((obl: any) => ({
        contract_id: contractId,
        type: "compliance",
        description: obl.descripcion,
        status: "pending",
        criticality: "medium",
      }));

      const { error: oblError } = await supabase.from("obligations").insert(obligations);
      if (oblError) {
        console.error("Failed to save obligations:", oblError);
      }
    }

    // Create alerts from extracted data
    if (extractedData.alertas?.length > 0) {
      const alerts = extractedData.alertas.map((alert: any) => ({
        entity_type: "contract",
        entity_id: contractId,
        title: alert.tipo,
        alert_date: new Date().toISOString().split("T")[0],
        priority: alert.prioridad === "alta" ? "high" : alert.prioridad === "media" ? "medium" : "low",
        status: "new",
      }));

      const { error: alertError } = await supabase.from("alerts").insert(alerts);
      if (alertError) {
        console.error("Failed to save alerts:", alertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis: extractedData,
        message: "Documento analizado exitosamente",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error analyzing document:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
