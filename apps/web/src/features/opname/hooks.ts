import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { finalizeOpname, openOpname, readOpname, readOpnames, saveOpnameCounts } from './api';

export function useOpnames() {
  return useQuery({
    queryKey: ['opnames'],
    queryFn: async () => {
      const result = await readOpnames();
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}

export function useOpname(opnameId: string) {
  return useQuery({
    queryKey: ['opname', opnameId],
    queryFn: async () => {
      const result = await readOpname(opnameId);
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: Boolean(opnameId),
  });
}

export function useOpenOpname() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await openOpname();
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: async () => client.invalidateQueries({ queryKey: ['opnames'] }),
  });
}

export function useSaveOpnameCounts() {
  return useMutation({
    mutationFn: async ({
      opnameId,
      counts,
    }: {
      opnameId: string;
      counts: { inventory_item_id: string; counted_qty: number }[];
    }) => {
      const result = await saveOpnameCounts(opnameId, counts);
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}

export function useFinalizeOpname() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (opnameId: string) => {
      const result = await finalizeOpname(opnameId);
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: async (_result, opnameId) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['opname', opnameId] }),
        client.invalidateQueries({ queryKey: ['opnames'] }),
        client.invalidateQueries({ queryKey: ['inventory', 'items'] }),
      ]);
    },
  });
}
