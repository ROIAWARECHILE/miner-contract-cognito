import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContractTask {
  id: string;
  contract_id: string;
  task_number: string;
  task_name: string;
  budget_uf: number;
  spent_uf: number;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface ContractProgress {
  totalBudget: number;
  totalSpent: number;
  available: number;
  avgProgress: number;
  tasks: ContractTask[];
}

export const useContractProgress = (contractId: string | null) => {
  return useQuery({
    queryKey: ["contract-progress", contractId],
    queryFn: async (): Promise<ContractProgress> => {
      if (!contractId) {
        return {
          totalBudget: 0,
          totalSpent: 0,
          available: 0,
          avgProgress: 0,
          tasks: []
        };
      }

      const { data: tasks, error } = await supabase
        .from('contract_tasks')
        .select('*')
        .eq('contract_id', contractId)
        .order('task_number', { ascending: true });

      if (error) throw error;

      const tasksData = tasks || [];
      const totalBudget = tasksData.reduce((sum, t) => sum + (Number(t.budget_uf) || 0), 0);
      const totalSpent = tasksData.reduce((sum, t) => sum + (Number(t.spent_uf) || 0), 0);
      const avgProgress = tasksData.length > 0 
        ? tasksData.reduce((sum, t) => sum + t.progress_percentage, 0) / tasksData.length
        : 0;

      return {
        totalBudget,
        totalSpent,
        available: totalBudget - totalSpent,
        avgProgress: Math.round(avgProgress),
        tasks: tasksData
      };
    },
    enabled: !!contractId,
  });
};