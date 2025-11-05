import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useRealtimeContract(contractCode: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!contractCode) return;

    console.log(`🔴 Setting up realtime for contract: ${contractCode}`);

    // Subscribe to contract changes
    const contractChannel = supabase
      .channel(`contract-${contractCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contracts',
          filter: `code=eq.${contractCode}`
        },
        (payload) => {
          console.log('📡 Contract updated:', payload);
          toast.success('Contrato actualizado', {
            description: 'Los datos se han actualizado automáticamente'
          });
          
          // Invalidate all contract-related queries
          queryClient.invalidateQueries({ queryKey: ['contract-analytics', contractCode] });
          queryClient.invalidateQueries({ queryKey: ['contracts'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_states'
        },
        (payload) => {
          console.log('📡 Payment state updated:', payload);
          toast.info('EDP procesado', {
            description: 'Nuevo Estado de Pago agregado'
          });
          
          // Invalidate all contract-related queries to refresh dashboard cards
          queryClient.invalidateQueries({ queryKey: ['payment-states', contractCode] });
          queryClient.invalidateQueries({ queryKey: ['contract-analytics', contractCode] });
          queryClient.invalidateQueries({ queryKey: ['contracts'] });
          queryClient.invalidateQueries({ queryKey: ['contract-tasks'] });
          
          toast.success('Dashboard actualizado', {
            description: 'Las tarjetas reflejan los datos más recientes'
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contract_tasks'
        },
        (payload) => {
          console.log('📡 Task updated:', payload);
          
          // Invalidate task queries
          queryClient.invalidateQueries({ queryKey: ['contract-tasks', contractCode] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'technical_reports'
        },
        (payload) => {
          console.log('📡 Technical report (memorandum) updated:', payload);
          toast.info('Memorandum procesado', {
            description: 'Curva S actualizada con nuevos datos'
          });
          
          // Invalidate S-curve queries
          queryClient.invalidateQueries({ queryKey: ['contract-scurve', contractCode] });
        }
      )
      .subscribe((status) => {
        console.log(`🔴 Realtime subscription status: ${status}`);
      });

    return () => {
      console.log(`🔴 Cleaning up realtime for contract: ${contractCode}`);
      supabase.removeChannel(contractChannel);
    };
  }, [contractCode, queryClient]);
}
