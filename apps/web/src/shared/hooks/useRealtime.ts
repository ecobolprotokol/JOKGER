import { useEffect } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useConnectionStore } from '../stores/connection';

type RealtimeTable = 'orders' | 'payments';

type UseRealtimeOptions = {
  table: RealtimeTable;
  filter: string;
  queryKey: QueryKey;
};

export function useRealtime({ table, filter, queryKey }: UseRealtimeOptions): void {
  const queryClient = useQueryClient();
  const setRealtime = useConnectionStore((state) => state.setRealtime);
  const serializedQueryKey = JSON.stringify(queryKey);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setRealtime('degraded');
      return;
    }

    const channel = client
      .channel(`realtime:${table}:${filter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => {
        const parsedQueryKey = JSON.parse(serializedQueryKey) as QueryKey;
        void queryClient.invalidateQueries({ queryKey: parsedQueryKey });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtime('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtime('degraded');
        } else {
          setRealtime('connecting');
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [filter, queryClient, serializedQueryKey, setRealtime, table]);
}
