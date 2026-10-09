import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelOrder, changeOrderStatus, readRecentOrders, returnCompletedOrder } from './api';
import type { OrderStatus } from './api';
import { useConnectionStore } from '../../shared/stores/connection';

export function useRecentOrders() {
  const realtime = useConnectionStore((state) => state.realtime);
  return useQuery({
    queryKey: ['orders', { recent: 100 }],
    queryFn: async () => {
      const result = await readRecentOrders();
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    refetchInterval: realtime === 'degraded' ? 30_000 : false,
  });
}

export function useChangeOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const result = await changeOrderStatus(orderId, status);
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: async (order) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['order', order.id] }),
        queryClient.invalidateQueries({ queryKey: ['history'] }),
      ]);
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const result = await cancelOrder(orderId, reason);
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: async (order) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['order', order.id] }),
        queryClient.invalidateQueries({ queryKey: ['history'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] }),
        queryClient.invalidateQueries({ queryKey: ['payments', 'pending'] }),
        queryClient.invalidateQueries({ queryKey: ['shift', 'active'] }),
        queryClient.invalidateQueries({ queryKey: ['report'] }),
      ]);
    },
  });
}

export function useReturnCompletedOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const result = await returnCompletedOrder(orderId, reason);
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: async (order) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['order', order.id] }),
        queryClient.invalidateQueries({ queryKey: ['history'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] }),
        queryClient.invalidateQueries({ queryKey: ['payments', 'pending'] }),
        queryClient.invalidateQueries({ queryKey: ['shift', 'active'] }),
        queryClient.invalidateQueries({ queryKey: ['report'] }),
      ]);
    },
  });
}
