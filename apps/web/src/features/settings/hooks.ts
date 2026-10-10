import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createStaff,
  readStaff,
  readStoreSettings,
  setStaffActive,
  setStaffRole,
  updateStoreSettings,
} from './api';
import type { StaffCreationInput, StaffProfile, StoreSettingsPatch } from './api';

export function useStoreSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const result = await readStoreSettings();
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
  });
}

export function useSaveStoreSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (settings: StoreSettingsPatch) => {
      const result = await updateStoreSettings(settings);
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: async () => client.invalidateQueries({ queryKey: ['settings'] }),
  });
}

export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const result = await readStaff();
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}

function useStaffMutation<TInput, TOutput>(mutationFn: (input: TInput) => Promise<TOutput>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => client.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function useCreateStaff() {
  return useStaffMutation<StaffCreationInput, { id: string; email: string; full_name: string }>(
    async (input) => {
      const result = await createStaff(input);
      if (!result.ok) throw result.error;
      return result.data;
    },
  );
}

export function useSetStaffRole() {
  return useStaffMutation<{ userId: string; role: StaffProfile['role'] }, StaffProfile>(
    async (input) => {
      const result = await setStaffRole(input.userId, input.role);
      if (!result.ok) throw result.error;
      return result.data;
    },
  );
}

export function useSetStaffActive() {
  return useStaffMutation<{ userId: string; active: boolean }, StaffProfile>(async (input) => {
    const result = await setStaffActive(input.userId, input.active);
    if (!result.ok) throw result.error;
    return result.data;
  });
}
