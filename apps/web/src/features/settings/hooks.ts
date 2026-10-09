import { useQuery } from '@tanstack/react-query';
import { readStoreSettings } from './api';

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
