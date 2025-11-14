import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useRealtimeContracts() {
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('🔴 Setting up global realtime for contracts');

    const channel = supabase
      .channel('contracts-global')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contracts'
        },
        (payload) => {
          console.log('📡 New contract created:', payload);
          
          const newContract = payload.new as any;
          toast.success(`🎉 Nuevo contrato creado`, {
            description: `${newContract.code} - ${newContract.title}`,
            duration: 8000
          });
          
          // Invalidar lista de contratos
          queryClient.invalidateQueries({ queryKey: ['contracts'] });
        }
      )
      .subscribe();

    return () => {
      console.log('🔴 Cleaning up contracts realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
