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
    const { contractId, fileName, fileUrl, documentType } = await req.json();
    console.log('Analyzing additional document:', { contractId, fileName, documentType });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Classify document type if not provided
    let detectedType = documentType;
    if (!detectedType) {
      const classificationPrompt = `Classify this document filename: ${fileName}
      
      Return JSON with:
      {
        "document_type": "EDP|SDI|plan|technical_report|addendum|other",
        "confidence": 0-100
      }`;

      const classifyResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a document classifier. Always respond with valid JSON only.' },
            { role: 'user', content: classificationPrompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      const classifyData = await classifyResponse.json();
      const classification = JSON.parse(classifyData.choices[0].message.content);
      detectedType = classification.document_type;
      console.log('Detected document type:', detectedType);
    }

    // Process based on document type
    let result = {};

    if (detectedType === 'EDP') {
      // Extract EDP information
      const edpPrompt = `Analyze this EDP (Estado de Pago) filename: ${fileName}

Extract and structure the following information in JSON format:
{
  "edp_number": "string - EDP number",
  "period": "string - Period (e.g., Jul-25, Ago-25)",
  "amount_uf": number or null,
  "tasks_executed": [
    {
      "task_number": "string",
      "task_name": "string",
      "spent_uf": number,
      "progress_percentage": number
    }
  ]
}`;

      const edpResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are an EDP analysis expert. Always respond with valid JSON only.' },
            { role: 'user', content: edpPrompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      const edpData = await edpResponse.json();
      const edpInfo = JSON.parse(edpData.choices[0].message.content);
      console.log('EDP info extracted:', edpInfo);

      // Upsert tasks
      if (edpInfo.tasks_executed?.length > 0) {
        for (const task of edpInfo.tasks_executed) {
          await supabase.from('contract_tasks').upsert({
            contract_id: contractId,
            task_number: task.task_number,
            task_name: task.task_name,
            spent_uf: task.spent_uf,
            progress_percentage: task.progress_percentage
          }, {
            onConflict: 'contract_id,task_number'
          });
        }

        // Recalculate contract totals
        const { data: allTasks } = await supabase
          .from('contract_tasks')
          .select('budget_uf, spent_uf, progress_percentage')
          .eq('contract_id', contractId);

        if (allTasks && allTasks.length > 0) {
          const totalBudget = allTasks.reduce((sum, t) => sum + (t.budget_uf || 0), 0);
          const totalSpent = allTasks.reduce((sum, t) => sum + (t.spent_uf || 0), 0);
          const avgProgress = allTasks.reduce((sum, t) => sum + (t.progress_percentage || 0), 0) / allTasks.length;

          await supabase.from('contracts').update({
            contract_value: totalBudget,
            updated_at: new Date().toISOString()
          }).eq('id', contractId);

          result = { edpInfo, totalBudget, totalSpent, avgProgress };
        }
      }

      // Save analysis
      await supabase.from('ai_analyses').insert({
        contract_id: contractId,
        analysis_type: 'edp_processing',
        model_used: 'google/gemini-2.5-flash',
        raw_output_json: edpData,
        structured_output: edpInfo
      });

    } else if (detectedType === 'SDI') {
      // Extract SDI information
      const sdiPrompt = `Analyze this SDI (Solicitud de Información) filename: ${fileName}

Extract and structure the following information in JSON format:
{
  "sdi_number": "string - SDI number",
  "topic": "string - Topic or description",
  "deadline_days": number - Usually 5 business days
}`;

      const sdiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are an SDI analysis expert. Always respond with valid JSON only.' },
            { role: 'user', content: sdiPrompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      const sdiData = await sdiResponse.json();
      const sdiInfo = JSON.parse(sdiData.choices[0].message.content);
      console.log('SDI info extracted:', sdiInfo);

      // Create alert
      const alertDate = new Date();
      alertDate.setDate(alertDate.getDate() + (sdiInfo.deadline_days || 5));

      await supabase.from('alerts').insert({
        entity_type: 'contract',
        entity_id: contractId,
        title: `SDI ${sdiInfo.sdi_number}: ${sdiInfo.topic}`,
        alert_date: alertDate.toISOString().split('T')[0],
        status: 'new',
        priority: 'high',
        notes: `SDI recibido. Plazo: ${sdiInfo.deadline_days} días hábiles`
      });

      result = { sdiInfo, alertCreated: true };

      // Save analysis
      await supabase.from('ai_analyses').insert({
        contract_id: contractId,
        analysis_type: 'sdi_processing',
        model_used: 'google/gemini-2.5-flash',
        raw_output_json: sdiData,
        structured_output: sdiInfo
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentType: detectedType,
        result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-additional-document:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
