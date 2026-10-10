import { useQuery } from '@tanstack/react-query';
import { readAuditRows } from './api';

export function useAuditRows() {
  return useQuery({
    queryKey: ['audit'],
    queryFn: async () => {
      const result = await readAuditRows();
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}
