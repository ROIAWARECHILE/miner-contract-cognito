import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContractAnalytics {
  spent_uf: number;
  available_uf: number;
  overall_progress_pct: number;
  total_budget_uf: number;
}

export interface ContractTask {
  id: string;
  task_number: string;
  task_name: string;
  budget_uf: number;
  spent_uf: number;
  progress_percentage: number;
}

export interface PaymentState {
  id: string;
  edp_number: number;
  period_label: string;
  period_start: string;
  period_end: string;
  amount_uf: number;
  uf_rate: number;
  amount_clp: number;
  status: string;
}

export const useContractAnalytics = (contractCode: string) => {
  return useQuery({
    queryKey: ['contract-analytics', contractCode],
    queryFn: async () => {
      const { data: contract, error } = await supabase
        .from('contracts')
        .select(`
          id,
          code,
          metadata,
          contract_value,
          payment_states (
            amount_uf,
            status
          )
        `)
        .eq('code', contractCode)
        .maybeSingle();

      if (error) throw error;
      if (!contract) {
        return {
          spent_uf: 0,
          available_uf: 0,
          overall_progress_pct: 0,
          total_budget_uf: 0,
        } as ContractAnalytics;
      }

      const paymentStates = contract.payment_states || [];
      const spentUf = paymentStates
        .filter((ps: any) => ['approved', 'submitted'].includes(ps.status))
        .reduce((sum: number, ps: any) => sum + (ps.amount_uf || 0), 0);

      const totalBudget = (contract.metadata as any)?.budget_uf || contract.contract_value || 0;
      const availableUf = totalBudget - spentUf;
      const overallProgressPct = totalBudget > 0 
        ? Math.min(100, Math.max(0, (spentUf / totalBudget) * 100))
        : 0;

      return {
        spent_uf: spentUf,
        available_uf: availableUf,
        overall_progress_pct: overallProgressPct,
        total_budget_uf: totalBudget,
      } as ContractAnalytics;
    },
    retry: 1,
  });
};

export const useContractTasks = (contractCode: string) => {
  return useQuery({
    queryKey: ['contract-tasks', contractCode],
    queryFn: async () => {
      const { data: contract } = await supabase
        .from('contracts')
        .select('id')
        .eq('code', contractCode)
        .maybeSingle();

      if (!contract) return [];

      const { data: tasks, error } = await supabase
        .from('contract_tasks')
        .select('*')
        .eq('contract_id', contract.id)
        .order('task_number');

      if (error) {
        console.warn('Error fetching tasks:', error);
        return [];
      }

      return tasks as ContractTask[];
    },
    retry: 1,
  });
};

export const usePaymentStates = (contractCode: string) => {
  return useQuery({
    queryKey: ['payment-states', contractCode],
    queryFn: async () => {
      const { data: contract } = await supabase
        .from('contracts')
        .select('id')
        .eq('code', contractCode)
        .maybeSingle();

      if (!contract) return [];

      const { data: payments, error } = await supabase
        .from('payment_states')
        .select('*')
        .eq('contract_id', contract.id)
        .order('edp_number');

      if (error) {
        console.warn('Error fetching payments:', error);
        return [];
      }

      return payments as PaymentState[];
    },
    retry: 1,
  });
};

export const useProcessDocuments = () => {
  return async () => {
    const { data, error } = await supabase.functions.invoke('process-dominga-documents');

    if (error) throw error;

    return data;
  };
};

// S-Curve data from memorandums
export interface SCurveDataPoint {
  month: string;
  planned: number;
  actual: number;
}

export const useContractSCurve = (contractCode: string) => {
  return useQuery({
    queryKey: ['contract-scurve', contractCode],
    queryFn: async () => {
      // Get contract to find contract_id
      const { data: contract } = await supabase
        .from('contracts')
        .select('id')
        .eq('code', contractCode)
        .maybeSingle();

      if (!contract) return [];

      // Fetch all technical_reports (memorandums) for this contract
      const { data: reports, error } = await supabase
        .from('technical_reports')
        .select('edp_number, curve, created_at')
        .eq('contract_id', contract.id)
        .order('created_at', { ascending: false });

      if (error || !reports || reports.length === 0) {
        return [];
      }

      // Group by edp_number and take the most recent memorandum for each
      const latestByEDP = new Map();
      reports.forEach(report => {
        if (!latestByEDP.has(report.edp_number) || 
            new Date(report.created_at) > new Date(latestByEDP.get(report.edp_number).created_at)) {
          latestByEDP.set(report.edp_number, report);
        }
      });

      // Combine all curve data
      const combinedData = new Map<string, { planned: number; actual: number }>();
      
      latestByEDP.forEach(report => {
        const curve = report.curve as any;
        if (!curve || !curve.dates || !curve.planned || !curve.executed) return;

        const dates = curve.dates as string[];
        const planned = curve.planned as number[];
        const executed = curve.executed as number[];

        dates.forEach((dateStr, idx) => {
          // Convert date to month format (e.g., "Jul-25")
          const date = new Date(dateStr);
          const monthKey = date.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
          
          const existing = combinedData.get(monthKey) || { planned: 0, actual: 0 };
          
          // Take the maximum values (cumulative)
          combinedData.set(monthKey, {
            planned: Math.max(existing.planned, planned[idx] || 0),
            actual: Math.max(existing.actual, executed[idx] || 0)
          });
        });
      });

      // Sort by date and convert to array
      const sortedData = Array.from(combinedData.entries())
        .sort((a, b) => {
          const dateA = new Date(a[0]);
          const dateB = new Date(b[0]);
          return dateA.getTime() - dateB.getTime();
        })
        .map(([month, values]) => ({
          month: month.charAt(0).toUpperCase() + month.slice(1).replace('-', ' '),
          planned: Math.round(values.planned * 10) / 10,
          actual: Math.round(values.actual * 10) / 10
        }));

      return sortedData as SCurveDataPoint[];
    },
    retry: 1,
  });
};

// Hook para cargar executive summary
export function useExecutiveSummary(contractCode: string) {
  return useQuery({
    queryKey: ['contract-executive-summary', contractCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_summaries')
        .select('raw_json')
        .eq('contract_code', contractCode)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      
      // Extraer executive_summary del raw_json
      const execSummary = data?.raw_json?.executive_summary;
      return execSummary || null;
    },
    enabled: !!contractCode
  });
}
