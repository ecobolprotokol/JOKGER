import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  readActivePaymentAccounts,
  readPaymentAccounts,
  setPaymentAccountActive,
  upsertPaymentAccount,
} from './api';
import type { PaymentAccountInput } from './api';

export function useActivePaymentAccounts() {
  return useQuery({
    queryKey: ['payment-accounts'],
    queryFn: async () => {
      const result = await readActivePaymentAccounts();
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
  });
}

export function usePaymentAccounts() {
  return useQuery({
    queryKey: ['payment-accounts', 'all'],
    queryFn: async () => {
      const result = await readPaymentAccounts();
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}

export function useUpsertPaymentAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PaymentAccountInput) => {
      const result = await upsertPaymentAccount(input);
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payment-accounts'] });
      await queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useSetPaymentAccountActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ accountId, active }: { accountId: string; active: boolean }) => {
      const result = await setPaymentAccountActive(accountId, active);
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payment-accounts'] });
      await queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}
