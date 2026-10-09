import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOrder } from './api';
import type { CreateOrderInput } from './schemas';

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const result = await createOrder(input);
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: async (order) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['order', order.id] }),
        queryClient.invalidateQueries({ queryKey: ['shift', 'active'] }),
        queryClient.invalidateQueries({ queryKey: ['open-bills'] }),
        queryClient.invalidateQueries({ queryKey: ['payments', 'pending'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] }),
        queryClient.invalidateQueries({ queryKey: ['report'] }),
      ]);
    },
  });
}
