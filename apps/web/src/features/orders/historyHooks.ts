import { useMutation, useQuery } from '@tanstack/react-query';
import { readHistoryCashiers, readHistoryExport, readHistoryOrders } from './historyApi';
import type { HistoryFilters } from './historyApi';

export function useHistoryOrders(filters: HistoryFilters) {
  return useQuery({
    queryKey: ['history', filters],
    queryFn: async () => {
      const result = await readHistoryOrders(filters);
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}

export function useHistoryCashiers() {
  return useQuery({
    queryKey: ['history', 'cashiers'],
    queryFn: async () => {
      const result = await readHistoryCashiers();
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}

export function useExportHistory(filters: Omit<HistoryFilters, 'page' | 'pageSize'>) {
  return useMutation({
    mutationFn: async () => {
      const result = await readHistoryExport(filters);
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}
