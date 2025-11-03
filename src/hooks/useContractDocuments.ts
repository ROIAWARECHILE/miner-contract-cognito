import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useContractDocuments = (contractId: string | null) => {
  return useQuery({
    queryKey: ['contract-documents', contractId],
    queryFn: async () => {
      if (!contractId) return [];
      
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching documents:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!contractId,
  });
};

export const downloadDocument = async (storagePath: string) => {
  const { data, error } = await supabase.storage
    .from('contracts')
    .download(storagePath);
  
  if (error) {
    throw new Error('Error al descargar documento');
  }
  
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = storagePath.split('/').pop() || 'documento.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
