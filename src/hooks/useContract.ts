import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

// Use existing types from the database
export type Contract = Tables<"contracts">;
export type ContractTask = Tables<"obligations">;
export type PaymentState = any; // Will use payment_states when migration is applied
export type SLAAlert = Tables<"alerts">;
export type TeamMember = any; // Will use team_members when migration is applied

export const useContracts = () => {
  return useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          payment_states (
            amount_uf,
            status
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Calcular métricas en tiempo real desde payment_states
      return data?.map(contract => {
        const paymentStates = (contract.payment_states as any) || [];
        const spent_uf = paymentStates
          .filter((ps: any) => ['approved', 'submitted'].includes(ps.status))
          .reduce((sum: number, ps: any) => sum + (ps.amount_uf || 0), 0);
        
        const budget_uf = (contract.metadata as any)?.budget_uf || contract.contract_value || 0;
        const overall_progress_pct = budget_uf > 0 
          ? Math.round((spent_uf / budget_uf) * 100) 
          : 0;
        
        // Enriquecer el contrato con métricas calculadas en tiempo real
        return {
          ...contract,
          calculated_metrics: {
            spent_uf,
            available_uf: budget_uf - spent_uf,
            overall_progress_pct,
            budget_uf
          }
        };
      });
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
