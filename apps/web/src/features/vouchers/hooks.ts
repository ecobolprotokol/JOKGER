import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { readVouchers, setVoucherActive, upsertVoucher, validateVoucher } from './api';
import type { VoucherInput } from './api';
import type { Result } from '../../shared/lib/errors';

async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
  const result = await promise;
  if (!result.ok) {
    throw result.error;
  }
  return result.data;
}

export function useVouchers() {
  return useQuery({
    queryKey: ['vouchers'],
    queryFn: () => unwrap(readVouchers()),
  });
}

export function useVoucherPreview(code: string | null, subtotal: number) {
  return useQuery({
    queryKey: ['vouchers', 'preview', code, subtotal],
    enabled: code !== null,
    queryFn: () => unwrap(validateVoucher(code ?? '', subtotal)),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useValidateVoucher() {
  return useMutation({
    mutationFn: ({ code, subtotal }: { code: string; subtotal: number }) =>
      unwrap(validateVoucher(code, subtotal)),
  });
}

function useInvalidateVouchers() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['vouchers'] }),
      queryClient.invalidateQueries({ queryKey: ['audit'] }),
      queryClient.invalidateQueries({ queryKey: ['report'] }),
    ]);
  };
}

export function useUpsertVoucher() {
  const invalidate = useInvalidateVouchers();
  return useMutation({
    mutationFn: (input: VoucherInput) => unwrap(upsertVoucher(input)),
    onSuccess: invalidate,
  });
}

export function useSetVoucherActive() {
  const invalidate = useInvalidateVouchers();
  return useMutation({
    mutationFn: ({ voucherId, active }: { voucherId: string; active: boolean }) =>
      unwrap(setVoucherActive(voucherId, active)),
    onSuccess: invalidate,
  });
}
