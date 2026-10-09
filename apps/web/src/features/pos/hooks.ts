import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addItemsToOpenBill, closeOpenBill, createOrder, voidOpenBillItem } from './api';
import type { CreateOrderInput } from './schemas';
import type { OpenBillPayment } from './api';

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

function useInvalidateBill(orderId: string) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['order', orderId] }),
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
      queryClient.invalidateQueries({ queryKey: ['open-bills'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] }),
      queryClient.invalidateQueries({ queryKey: ['history'] }),
      queryClient.invalidateQueries({ queryKey: ['report'] }),
    ]);
  };
}

export function useAddItemsToOpenBill(orderId: string) {
  const invalidate = useInvalidateBill(orderId);
  return useMutation({
    mutationFn: async (input: { clientRef: string; items: CreateOrderInput['items'] }) => {
      const result = await addItemsToOpenBill(input.clientRef, orderId, input.items);
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: invalidate,
  });
}

export function useVoidOpenBillItem(orderId: string) {
  const invalidate = useInvalidateBill(orderId);
  return useMutation({
    mutationFn: async ({ itemId, reason }: { itemId: string; reason: string }) => {
      const result = await voidOpenBillItem(itemId, reason);
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: invalidate,
  });
}

export function useCloseOpenBill(orderId: string) {
  const invalidate = useInvalidateBill(orderId);
  return useMutation({
    mutationFn: async (input: {
      clientRef: string;
      payments: OpenBillPayment[];
      voucherCode: string | null;
    }) => {
      const result = await closeOpenBill({ ...input, orderId });
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: invalidate,
  });
}
