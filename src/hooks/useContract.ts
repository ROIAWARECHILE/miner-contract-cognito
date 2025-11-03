import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

// Use existing types from the database
export type Contract = Tables<"contracts">;
export type ContractTask = {
  id: string;
  contract_id: string;
  task_number: string;
  task_name: string;
  budget_uf: number | null;
  spent_uf: number | null;
  progress_percentage: number | null;
  created_at: string;
  updated_at: string;
};
export type PaymentState = any; // Will use payment_states when migration is applied
export type SLAAlert = Tables<"alerts">;
export type TeamMember = any; // Will use team_members when migration is applied

export type ContractProgress = {
  totalBudget: number;
  totalSpent: number;
  avgProgress: number;
  tasks: ContractTask[];
};

export const useContracts = () => {
  return useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useContract = (id: string | null) => {
  return useQuery({
    queryKey: ["contract", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useContractTasks = (contractId: string | null) => {
  return useQuery({
    queryKey: ["contract-tasks", contractId],
    queryFn: async () => {
      if (!contractId) return [];
      
      // Use obligations table as tasks
      const { data, error } = await supabase
        .from("obligations")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at");

      if (error) throw error;
      return data;
    },
    enabled: !!contractId,
  });
};

export const usePaymentStates = (contractId: string | null) => {
  return useQuery({
    queryKey: ["payment-states", contractId],
    queryFn: async () => {
      if (!contractId) return [];
      
      // Mock data for now - will be replaced when payment_states table is applied
      return [];
    },
    enabled: !!contractId,
  });
};

export const useSLAAlerts = (contractId?: string) => {
  return useQuery({
    queryKey: ["sla-alerts", contractId],
    queryFn: async () => {
      let query = supabase
        .from("alerts")
        .select("*")
        .in("status", ["new", "acknowledged", "in_progress"])
        .order("alert_date");

      if (contractId) {
        query = query.eq("entity_id", contractId).eq("entity_type", "contract");
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
};

export const useContractProgress = (contractId: string | null) => {
  return useQuery<ContractProgress | null>({
    queryKey: ["contract-progress", contractId],
    queryFn: async () => {
      if (!contractId) return null;
      
      // Using any to avoid type issues with contract_tasks table not in generated types
      const response = await (supabase as any)
        .from("contract_tasks")
        .select("*")
        .eq("contract_id", contractId);

      if (response.error) throw response.error;
      
      const tasks = response.data as ContractTask[];
      if (!tasks || tasks.length === 0) return null;

      const totalBudget = tasks.reduce((sum, t) => sum + (t.budget_uf || 0), 0);
      const totalSpent = tasks.reduce((sum, t) => sum + (t.spent_uf || 0), 0);
      const avgProgress = tasks.reduce((sum, t) => sum + (t.progress_percentage || 0), 0) / tasks.length;

      return {
        totalBudget,
        totalSpent,
        avgProgress: Math.round(avgProgress),
        tasks
      };
    },
    enabled: !!contractId,
  });
};

export const useContractDocuments = (contractId: string | null) => {
  return useQuery({
    queryKey: ["contract-documents", contractId],
    queryFn: async () => {
      if (!contractId) return [];
      
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!contractId,
  });
};

export const useCompany = (companyId: string | null) => {
  return useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
};

export const useTeamMembers = (contractId: string | null) => {
  return useQuery({
    queryKey: ["team-members", contractId],
    queryFn: async () => {
      if (!contractId) return [];
      
      // Mock data for now - will be replaced when team_members table is applied
      return [];
    },
    enabled: !!contractId,
  });
};
