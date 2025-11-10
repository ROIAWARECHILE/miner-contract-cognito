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

export const deleteDocumentFromStorage = async (fileUrl: string) => {
  // Extract storage path from file_url
  // Format: contracts/dominga/edp/EDP N°1- 4065.001.pdf
  const storagePath = fileUrl.replace(/^.*?contracts\//, '');
  
  console.log('🗑️ Eliminando archivo del Storage:', storagePath);
  
  const { error } = await supabase.storage
    .from('contracts')
    .remove([storagePath]);
  
  if (error) {
    console.warn('⚠️ Error eliminando del Storage (el archivo podría no existir):', error);
    // No throw error - el archivo podría ya no existir
  } else {
    console.log('✓ Archivo eliminado del Storage');
  }
};
