import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ExtractionQualityMetrics {
  contract_code: string;
  summary_completeness: number;
  risks_count: number;
  risks_by_severity: {
    alta: number;
    media: number;
    baja: number;
  };
  obligations_count: number;
  obligations_by_status: {
    pending: number;
    overdue: number;
    completed: number;
  };
  warnings: string[];
  review_required: boolean;
  last_extraction: string | null;
}

export const useExtractionQuality = (contractCode: string) => {
  return useQuery({
    queryKey: ['extraction-quality', contractCode],
    queryFn: async (): Promise<ExtractionQualityMetrics> => {
      // 1. Get summary completeness
      const { data: summary } = await supabase
        .from('contract_summaries')
        .select('*')
        .eq('contract_code', contractCode)
        .single();

      const summaryFields = [
        'validity_start',
        'validity_end',
        'budget_total',
        'parties',
        'milestones',
        'compliance_requirements'
      ];

      const completedFields = summaryFields.filter(field => {
        const value = summary?.[field as keyof typeof summary];
        return value !== null && value !== undefined;
      });

      const summary_completeness = summary 
        ? Math.round((completedFields.length / summaryFields.length) * 100)
        : 0;

      // 2. Get risks statistics
      const { data: risks } = await supabase
        .from('contract_risks')
        .select('severity')
        .eq('contract_code', contractCode);

      const risks_by_severity = {
        alta: risks?.filter(r => r.severity === 'alta').length || 0,
        media: risks?.filter(r => r.severity === 'media').length || 0,
        baja: risks?.filter(r => r.severity === 'baja').length || 0,
      };

      // 3. Get obligations statistics
      const { data: obligations } = await supabase
        .from('contract_obligations')
        .select('status, next_due_date')
        .eq('contract_code', contractCode);

      const now = new Date();
      const obligations_by_status = {
        pending: obligations?.filter(o => 
          o.status === 'pending' && 
          (!o.next_due_date || new Date(o.next_due_date) >= now)
        ).length || 0,
        overdue: obligations?.filter(o => 
          o.status === 'pending' && 
          o.next_due_date && 
          new Date(o.next_due_date) < now
        ).length || 0,
        completed: obligations?.filter(o => 
          o.status === 'completed' || o.status === 'approved'
        ).length || 0,
      };

      // 4. Check for warnings
      const warnings: string[] = [];
      
      if (!summary) {
        warnings.push('Ficha técnica no extraída');
      } else {
        if (summary_completeness < 80) {
          warnings.push(`Ficha técnica incompleta (${summary_completeness}%)`);
        }
        if ((summary.raw_json as any)?.meta?.warnings) {
          warnings.push(...(summary.raw_json as any).meta.warnings);
        }
      }

      if (!risks || risks.length === 0) {
        warnings.push('No se identificaron riesgos');
      } else if (risks.length < 4) {
        warnings.push(`Pocos riesgos identificados (${risks.length})`);
      }

      if (obligations_by_status.overdue > 0) {
        warnings.push(`${obligations_by_status.overdue} obligación(es) vencida(s)`);
      }

      // 5. Get last extraction date
      const { data: latestDoc } = await supabase
        .from('documents')
        .select('created_at')
        .eq('contract_id', (await supabase.from('contracts').select('id').eq('code', contractCode).single()).data?.id)
        .eq('doc_type', 'contract')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        contract_code: contractCode,
        summary_completeness,
        risks_count: risks?.length || 0,
        risks_by_severity,
        obligations_count: obligations?.length || 0,
        obligations_by_status,
        warnings,
        review_required: warnings.length > 0 || summary_completeness < 60,
        last_extraction: latestDoc?.created_at || null,
      };
    },
    enabled: !!contractCode,
  });
};

export const useAllContractsQuality = () => {
  return useQuery({
    queryKey: ['extraction-quality-all'],
    queryFn: async () => {
      const { data: contracts } = await supabase
        .from('contracts')
        .select('code')
        .order('code');

      if (!contracts) return [];

      const qualityMetrics = await Promise.all(
        contracts.map(async (contract) => {
          const { data: summary } = await supabase
            .from('contract_summaries')
            .select('*')
            .eq('contract_code', contract.code)
            .single();

          const { data: risks } = await supabase
            .from('contract_risks')
            .select('id')
            .eq('contract_code', contract.code);

          const { data: obligations } = await supabase
            .from('contract_obligations')
            .select('id, status, next_due_date')
            .eq('contract_code', contract.code);

          const summaryFields = ['validity_start', 'validity_end', 'budget_total', 'parties', 'milestones'];
          const completedFields = summaryFields.filter(field => summary?.[field as keyof typeof summary] != null);
          const summary_completeness = summary ? Math.round((completedFields.length / summaryFields.length) * 100) : 0;

          const now = new Date();
          const overdue = obligations?.filter(o => 
            o.status === 'pending' && 
            o.next_due_date && 
            new Date(o.next_due_date) < now
          ).length || 0;

          return {
            contract_code: contract.code,
            summary_completeness,
            risks_count: risks?.length || 0,
            obligations_overdue: overdue,
            has_data: !!summary || (risks && risks.length > 0),
          };
        })
      );

      return qualityMetrics;
    },
  });
};
