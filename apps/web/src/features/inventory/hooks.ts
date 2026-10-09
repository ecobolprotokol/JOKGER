import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { readInventoryItems, recordStockMovement, upsertInventoryItem } from './api';
import type { InventoryItemInput, StockMovementInput } from './api';

export function useInventoryItems() {
  return useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: async () => {
      const result = await readInventoryItems();
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
  });
}

export function useRecordStockMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StockMovementInput) => {
      const result = await recordStockMovement(input);
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: async (_movement, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'movements', input.itemId] }),
        queryClient.invalidateQueries({ queryKey: ['audit'] }),
      ]);
    },
  });
}

export function useUpsertInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InventoryItemInput) => {
      const result = await upsertInventoryItem(input);
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] }),
        queryClient.invalidateQueries({ queryKey: ['audit'] }),
      ]);
    },
  });
}
