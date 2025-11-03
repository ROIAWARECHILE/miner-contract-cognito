import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type Document = Tables<"documents">;

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
