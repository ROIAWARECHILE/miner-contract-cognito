import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { contract_id, contract_code } = await req.json();

    if (!contract_id || !contract_code) {
      throw new Error('contract_id y contract_code son requeridos');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('🔄 Consolidando resumen para contrato:', contract_code);

    // 1. Obtener contrato base
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contract_id)
      .single();

    if (contractError) throw contractError;

    // 2. Obtener todos los documentos procesados (EXCLUYENDO EDPs y Memorandums)
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('contract_id', contract_id)
      .eq('processing_status', 'completed')
      .not('doc_type', 'in', '("edp","memorandum")')
      .order('created_at', { ascending: false });

    if (docsError) throw docsError;

    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No hay documentos procesados para consolidar' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📄 Documentos a consolidar: ${documents.length}`);

    // 3. Inicializar estructuras
    const cards: any[] = [];
    const provenanceItems: any[] = [];
    const consolidatedData: any = {
      general: {},
      alcance: {},
      equipo: [],
      seguridad: {},
      legal: {}
    };

    // 4. Procesar cada documento
    for (const doc of documents) {
      const extracted = doc.extracted_data as any;
      
      console.log(`📋 Procesando: ${doc.filename} (${doc.doc_type})`);

      switch (doc.doc_type) {
        case 'contract':
          // Información general
          consolidatedData.general = {
            ...consolidatedData.general,
            nombre_contrato: extracted?.title || contract.title,
            contratista: extracted?.contractor,
            mandante: extracted?.client || contract.company_id,
            valor_total_uf: extracted?.budget_uf || contract.contract_value,
            fecha_inicio: extracted?.start_date || contract.start_date,
            fecha_termino: extracted?.end_date || contract.end_date,
            moneda: extracted?.currency || contract.currency,
            duracion_dias: extracted?.duration_days,
            modalidad: extracted?.payment_terms?.type,
            administrador_contrato: extracted?.admin
          };

          // Provenance para campos generales
          const generalFields = ['nombre_contrato', 'contratista', 'mandante', 'valor_total_uf', 'fecha_inicio'];
          generalFields.forEach(field => {
            if (consolidatedData.general[field]) {
              provenanceItems.push({
                card: 'General',
                field,
                source_doc: doc.filename,
                doc_type: doc.doc_type,
                confidence: 0.95
              });
            }
          });

          // Alcance
          if (extracted?.scope || extracted?.objective) {
            consolidatedData.alcance = {
              ...consolidatedData.alcance,
              objetivo: extracted.scope || extracted.objective,
              entregables: extracted.key_deliverables || extracted.deliverables || [],
              actividades: extracted.tasks?.map((t: any) => t.name || t.description) || []
            };

            provenanceItems.push({
              card: 'Alcance Técnico',
              field: 'objetivo',
              source_doc: doc.filename,
              doc_type: doc.doc_type,
              confidence: 0.90
            });
          }

          // Equipo
          if (extracted?.contacts && Array.isArray(extracted.contacts)) {
            consolidatedData.equipo = extracted.contacts.map((c: any) => ({
              nombre: c.name,
              cargo: c.role || c.position,
              email: c.email,
              telefono: c.phone,
              especialidad: c.specialty
            }));

            provenanceItems.push({
              card: 'Equipo y Experiencia',
              field: 'equipo',
              source_doc: doc.filename,
              doc_type: doc.doc_type,
              confidence: 0.92
            });
          }
          break;

        case 'plan_sso':
          consolidatedData.seguridad = {
            ...consolidatedData.seguridad,
            plan_sso: {
              codigo: extracted?.doc_code || extracted?.code,
              vigencia: extracted?.validity_date || extracted?.valid_until,
              normas: extracted?.applicable_standards || extracted?.standards || [],
              responsable: extracted?.responsible || extracted?.responsible_person
            }
          };

          provenanceItems.push({
            card: 'Seguridad y Calidad',
            field: 'plan_sso',
            source_doc: doc.filename,
            doc_type: doc.doc_type,
            confidence: 0.93
          });
          break;

        case 'plan_calidad':
          consolidatedData.seguridad = {
            ...consolidatedData.seguridad,
            plan_calidad: {
              codigo: extracted?.doc_code || extracted?.code,
              normas: extracted?.quality_standards || extracted?.standards || [],
              responsable: extracted?.responsible || extracted?.responsible_person
            }
          };

          provenanceItems.push({
            card: 'Seguridad y Calidad',
            field: 'plan_calidad',
            source_doc: doc.filename,
            doc_type: doc.doc_type,
            confidence: 0.93
          });
          break;

        case 'propuesta_tecnica':
          // Complementar alcance
          consolidatedData.alcance = {
            ...consolidatedData.alcance,
            metodologia: extracted?.methodology,
            cronograma: extracted?.schedule,
            entregables: [
              ...(consolidatedData.alcance.entregables || []),
              ...(extracted?.deliverables || [])
            ]
          };

          provenanceItems.push({
            card: 'Alcance Técnico',
            field: 'metodologia',
            source_doc: doc.filename,
            doc_type: doc.doc_type,
            confidence: 0.88
          });
          break;

        case 'annex':
          if (extracted?.technical_specs) {
            consolidatedData.alcance = {
              ...consolidatedData.alcance,
              especificaciones_tecnicas: extracted.technical_specs
            };
          }
          break;
      }
    }

    // 5. Generar cards desde datos consolidados
    if (Object.keys(consolidatedData.general).length > 0) {
      cards.push({
        category: 'General',
        title: 'Información General del Contrato',
        fields: consolidatedData.general
      });
    }

    if (Object.keys(consolidatedData.alcance).length > 0) {
      cards.push({
        category: 'Alcance Técnico',
        title: 'Alcance y Objetivos',
        fields: consolidatedData.alcance
      });
    }

    if (consolidatedData.equipo.length > 0) {
      cards.push({
        category: 'Equipo y Experiencia',
        title: 'Equipo del Proyecto',
        fields: { equipo: consolidatedData.equipo }
      });
    }

    if (Object.keys(consolidatedData.seguridad).length > 0) {
      cards.push({
        category: 'Seguridad y Calidad',
        title: 'Planes de SSO y Calidad',
        fields: consolidatedData.seguridad
      });
    }

    if (Object.keys(consolidatedData.legal).length > 0) {
      cards.push({
        category: 'Legal y Administrativa',
        title: 'Aspectos Legales',
        fields: consolidatedData.legal
      });
    }

    // 6. Construir summary_json completo
    const summaryJson = {
      contract_code,
      summary_version: 'v2.0-consolidated',
      cards,
      provenance: {
        type: 'consolidated',
        items: provenanceItems,
        source_documents: documents.map(d => ({
          filename: d.filename,
          doc_type: d.doc_type,
          processed_at: d.created_at,
          file_size: d.file_size
        }))
      },
      meta: {
        consolidated_at: new Date().toISOString(),
        total_documents: documents.length,
        excluded_types: ['edp', 'memorandum']
      }
    };

    // 7. Upsert en contract_summaries
    const { error: upsertError } = await supabase
      .from('contract_summaries')
      .upsert({
        contract_code,
        contract_id,
        summary_json: summaryJson,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'contract_code'
      });

    if (upsertError) throw upsertError;

    console.log(`✅ Resumen consolidado generado: ${cards.length} secciones`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        cards_generated: cards.length,
        documents_processed: documents.length,
        summary: summaryJson
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error consolidando resumen:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
