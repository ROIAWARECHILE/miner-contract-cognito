import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

export const useDeleteContract = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const deleteContract = async (contractId: string, contractCode: string) => {
    if (!confirm(
      `⚠️ ¿Estás seguro de eliminar el contrato ${contractCode}?\n\n` +
      `Esta acción eliminará:\n` +
      `• El contrato y todos sus documentos\n` +
      `• Todos los EDPs y tareas\n` +
      `• El resumen ejecutivo\n` +
      `• Todos los archivos en Storage\n\n` +
      `Esta acción NO SE PUEDE DESHACER.`
    )) {
      return false;
    }

    setIsDeleting(true);

    try {
      console.log('🗑️ Eliminando contrato:', contractId);

      // Llamar a la edge function
      const { data, error } = await supabase.functions.invoke('delete-contract', {
        body: { contract_id: contractId }
      });

      if (error) {
        console.error('Error eliminando contrato:', error);
        throw new Error(error.message || 'Error al eliminar el contrato');
      }

      if (!data?.success) {
        throw new Error('La eliminación falló en el servidor');
      }

      console.log('✅ Contrato eliminado:', data);

      toast.success(
        `Contrato ${contractCode} eliminado exitosamente`,
        {
          description: `${data.deleted_records?.documents || 0} documentos eliminados, ${data.files_deleted || 0} archivos eliminados del storage`
        }
      );

      // Invalidar queries y navegar
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
      await queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      
      navigate('/');
      
      return true;

    } catch (error: any) {
      console.error('Error en deleteContract:', error);
      toast.error(
        'Error al eliminar contrato',
        {
          description: error.message || 'Por favor intenta nuevamente'
        }
      );
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return { deleteContract, isDeleting };
};
