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
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { contractId, message } = await req.json();

    if (!contractId || !message) {
      throw new Error("Missing 'contractId' or 'message' in request body");
    }

    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY not set");
    }

    // 1. Generate embedding for the user's message
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: message,
        model: "text-embedding-3-large"
      })
    });

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI embedding API error: ${await embeddingResponse.text()}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // 2. Find relevant document chunks (context)
    const { data: contextChunks, error: rpcError } = await supabase.rpc('match_document_embeddings', {
      query_embedding: queryEmbedding,
      match_threshold: 0.78,
      match_count: 5
    });

    if (rpcError) throw rpcError;

    const contextText = contextChunks.map((chunk: any) => chunk.content).join("\n\n---\n\n");

    // 3. Generate a response using GPT-4o with the context
    const systemPrompt = `Eres un asistente experto en contratos mineros chilenos. Responde a la pregunta del usuario basándote ÚNICA Y EXCLUSIVAMENTE en el siguiente contexto extraído de los documentos del contrato. Si la respuesta no se encuentra en el contexto, di "La información no se encuentra en los documentos del contrato."`;

    const userPrompt = `Contexto del contrato:
    ${contextText}

    Pregunta del usuario:
    ${message}`;

    const completionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        stream: true,
      })
    });

    if (!completionResponse.ok) {
      throw new Error(`OpenAI completion API error: ${await completionResponse.text()}`);
    }

    // Use a TransformStream to format the SSE events
    const readableStream = new ReadableStream({
      async start(controller) {
        const reader = completionResponse.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }
          // The data from OpenAI is already in SSE format, we just need to forward it.
          const chunk = decoder.decode(value, { stream: true });
          controller.enqueue(new TextEncoder().encode(chunk));
        }
      }
    });

    return new Response(readableStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream; charset=utf-8" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
