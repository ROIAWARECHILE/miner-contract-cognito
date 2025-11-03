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
        .single();

      if (error) throw error;

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
        .single();

      if (!contract) return [];

      const { data: tasks, error } = await supabase
        .from('contract_tasks')
        .select('*')
        .eq('contract_id', contract.id)
        .order('task_number');

      if (error) throw error;

      return tasks as ContractTask[];
    },
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
        .single();

      if (!contract) return [];

      const { data: payments, error } = await supabase
        .from('payment_states')
        .select('*')
        .eq('contract_id', contract.id)
        .order('edp_number');

      if (error) throw error;

      return payments as PaymentState[];
    },
  });
};

export const useProcessDocuments = () => {
  return async () => {
    const { data, error } = await supabase.functions.invoke('process-dominga-documents');

    if (error) throw error;

    return data;
  };
};
