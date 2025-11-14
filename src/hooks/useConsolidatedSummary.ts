import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ConsolidatedData {
  general: Record<string, any>;
  alcance: Record<string, any>;
  equipo: any[];
  seguridad: Record<string, any>;
  legal: Record<string, any>;
  provenance: {
    documents: Array<{
      filename: string;
      doc_type: string;
      processed_at: string;
      file_size?: number;
    }>;
  };
}

export const useConsolidatedSummary = (contractId: string) => {
  return useQuery({
    queryKey: ['consolidated-summary', contractId],
    queryFn: async () => {
      if (!contractId) return null;

      // 1. Obtener el contrato base
      const { data: contract } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', contractId)
        .single();

      if (!contract) return null;

      // 2. Obtener TODOS los documentos procesados (EXCLUYENDO EDPs y Memorandums)
      const { data: documents } = await supabase
        .from('documents')
        .select('*')
        .eq('contract_id', contractId)
        .eq('processing_status', 'completed')
        .not('doc_type', 'in', '("edp","memorandum")')
        .order('created_at', { ascending: false });

      if (!documents || documents.length === 0) {
        return null;
      }

      // 3. Inicializar estructura consolidada
      const consolidated: ConsolidatedData = {
        general: {},
        alcance: {},
        equipo: [],
        seguridad: {},
        legal: {},
        provenance: { documents: [] }
      };

      // 4. Procesar cada documento según su tipo
      for (const doc of documents) {
        const extracted = doc.extracted_data as any;
        
        // Agregar al provenance
        consolidated.provenance.documents.push({
          filename: doc.filename,
          doc_type: doc.doc_type,
          processed_at: doc.created_at,
          file_size: doc.file_size
        });

        // Procesar según tipo de documento
        switch (doc.doc_type) {
          case 'contract':
            // Datos generales del contrato
            consolidated.general = {
              ...consolidated.general,
              nombre_contrato: extracted?.title || contract.title,
              contratista: extracted?.contractor,
              mandante: extracted?.client || contract.company_id,
              valor_total_uf: extracted?.budget_uf || contract.contract_value,
              fecha_inicio: extracted?.start_date || contract.start_date,
              fecha_termino: extracted?.end_date || contract.end_date,
              moneda: extracted?.currency || contract.currency,
              duracion_dias: extracted?.duration_days,
              modalidad: extracted?.payment_terms?.type || extracted?.contract_type,
              administrador_contrato: extracted?.admin
            };
            
            // Alcance desde contrato
            if (extracted?.scope || extracted?.objective) {
              consolidated.alcance = {
                ...consolidated.alcance,
                objetivo: extracted.scope || extracted.objective,
                entregables: extracted.key_deliverables || extracted.deliverables || [],
                actividades: extracted.tasks?.map((t: any) => t.name || t.description) || []
              };
            }
            
            // Equipo desde contrato
            if (extracted?.contacts && Array.isArray(extracted.contacts)) {
              consolidated.equipo = extracted.contacts.map((c: any) => ({
                nombre: c.name,
                cargo: c.role || c.position,
                email: c.email,
                telefono: c.phone,
                especialidad: c.specialty
              }));
            }

            // Legal desde contrato
            if (extracted?.payment_terms || extracted?.penalties) {
              consolidated.legal = {
                ...consolidated.legal,
                modalidad: extracted.payment_terms?.type,
                penalidades: extracted.penalties,
                garantias: extracted.guarantees || [],
                multas: extracted.fines || []
              };
            }
            break;

          case 'plan_sso':
            // Plan de Seguridad
            consolidated.seguridad = {
              ...consolidated.seguridad,
              plan_sso: {
                codigo: extracted?.doc_code || extracted?.code,
                vigencia: extracted?.validity_date || extracted?.valid_until,
                normas: extracted?.applicable_standards || extracted?.standards || [],
                responsable: extracted?.responsible || extracted?.responsible_person
              }
            };
            break;

          case 'plan_calidad':
            // Plan de Calidad
            consolidated.seguridad = {
              ...consolidated.seguridad,
              plan_calidad: {
                codigo: extracted?.doc_code || extracted?.code,
                normas: extracted?.quality_standards || extracted?.standards || [],
                responsable: extracted?.responsible || extracted?.responsible_person
              }
            };
            break;

          case 'propuesta_tecnica':
            // Complementar alcance con propuesta técnica
            consolidated.alcance = {
              ...consolidated.alcance,
              metodologia: extracted?.methodology,
              cronograma: extracted?.schedule,
              entregables: [
                ...(consolidated.alcance.entregables || []),
                ...(extracted?.deliverables || [])
              ],
              actividades: [
                ...(consolidated.alcance.actividades || []),
                ...(extracted?.activities || [])
              ]
            };

            // Equipo adicional de propuesta
            if (extracted?.team && Array.isArray(extracted.team)) {
              const newTeam = extracted.team.map((t: any) => ({
                nombre: t.name,
                cargo: t.role || t.position,
                email: t.email,
                telefono: t.phone,
                especialidad: t.specialty || t.expertise
              }));
              consolidated.equipo = [...consolidated.equipo, ...newTeam];
            }
            break;

          case 'annex':
            // Anexos técnicos pueden aportar a varias categorías
            if (extracted?.technical_specs) {
              consolidated.alcance = {
                ...consolidated.alcance,
                especificaciones_tecnicas: extracted.technical_specs
              };
            }
            
            if (extracted?.legal_clauses) {
              consolidated.legal = {
                ...consolidated.legal,
                clausulas_adicionales: extracted.legal_clauses
              };
            }
            break;

          default:
            console.log(`Tipo de documento no procesado: ${doc.doc_type}`);
        }
      }

      // 5. Limpieza y deduplicación
      // Eliminar duplicados del equipo por email
      if (consolidated.equipo.length > 0) {
        const uniqueTeam = consolidated.equipo.filter((member, index, self) =>
          index === self.findIndex((m) => m.email === member.email && member.email)
        );
        consolidated.equipo = uniqueTeam;
      }

      // Eliminar duplicados de arrays
      if (consolidated.alcance.entregables) {
        consolidated.alcance.entregables = [...new Set(consolidated.alcance.entregables)];
      }
      if (consolidated.alcance.actividades) {
        consolidated.alcance.actividades = [...new Set(consolidated.alcance.actividades)];
      }

      return consolidated;
    },
    enabled: !!contractId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};
