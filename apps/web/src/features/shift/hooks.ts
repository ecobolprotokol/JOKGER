import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { closeShift, openShift, readActiveShift } from './api';

export function useActiveShift() {
  return useQuery({
    queryKey: ['shift', 'active'],
    queryFn: async () => {
      const result = await readActiveShift();
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    staleTime: 0,
  });
}

export function useOpenShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (openingCash: number) => {
      const result = await openShift(openingCash);
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shift', 'active'] });
      await queryClient.invalidateQueries({ queryKey: ['shift', 'history'] });
    },
  });
}

export function useCloseShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ actualCash, note }: { actualCash: number; note: string | null }) => {
      const result = await closeShift(actualCash, note);
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shift', 'active'] });
      await queryClient.invalidateQueries({ queryKey: ['shift', 'history'] });
    },
  });
}
