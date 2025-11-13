import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface SummaryCard {
  category: string;
  title: string;
  badges?: string[];
  fields: Record<string, any>;
}

export interface ContractSummary {
  id: string;
  contract_code: string;
  summary_json?: {
    contract_code: string;
    summary_version: string;
    cards: SummaryCard[];
    provenance: {
      contract_file?: string;
      annexes?: string[];
    };
    meta: {
      confidence?: number;
      source_pages?: number[];
      last_updated?: string;
    };
  } | null;
  created_at: string;
  updated_at: string;
}

export const useContractSummary = (contractCode: string) => {
  const queryClient = useQueryClient();

  // Sprint 3: Realtime subscription for automatic updates
  useEffect(() => {
    if (!contractCode) return;

    console.log(`📡 [useContractSummary] Setting up realtime for: ${contractCode}`);

    const channel = supabase
      .channel(`contract_summary:${contractCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contract_summaries',
          filter: `contract_code=eq.${contractCode}`
        },
        (payload) => {
          console.log('📡 [useContractSummary] Realtime update received:', payload);
          
          // Invalidate query to trigger refetch
          queryClient.invalidateQueries({
            queryKey: ['contract-summary', contractCode]
          });
        }
      )
      .subscribe();

    return () => {
      console.log(`📡 [useContractSummary] Cleaning up realtime for: ${contractCode}`);
      channel.unsubscribe();
    };
  }, [contractCode, queryClient]);

  return useQuery({
    queryKey: ['contract-summary', contractCode],
    queryFn: async () => {
      if (!contractCode) return null;

      const { data, error } = await supabase
        .from('contract_summaries')
        .select('id, contract_code, summary_json, created_at, updated_at')
        .eq('contract_code', contractCode)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return data as unknown as ContractSummary;
    },
    enabled: !!contractCode,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};
