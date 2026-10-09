import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPaymentProofUrl, readPendingPayments, verifyPayment } from './api';

export function usePendingPayments() {
  return useQuery({
    queryKey: ['payments', 'pending'],
    queryFn: async () => {
      const result = await readPendingPayments();
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    staleTime: 0,
  });
}

export function usePaymentProof(path: string | null) {
  return useQuery({
    queryKey: ['proof', path],
    queryFn: async () => {
      if (!path) return null;
      const result = await createPaymentProofUrl(path);
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    enabled: Boolean(path),
    staleTime: 9 * 60_000,
    gcTime: 0,
  });
}

export function useVerifyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      paymentId,
      approve,
      note,
    }: {
      paymentId: string;
      approve: boolean;
      note: string | null;
    }) => {
      const result = await verifyPayment(paymentId, approve, note);
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: async (payment) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payments', 'pending'] }),
        queryClient.invalidateQueries({ queryKey: ['order', payment.order_id] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['shift', 'active'] }),
        queryClient.invalidateQueries({ queryKey: ['report'] }),
      ]);
    },
  });
}
