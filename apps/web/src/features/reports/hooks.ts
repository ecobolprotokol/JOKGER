import { useQuery } from '@tanstack/react-query';
import { readSalesReport } from './api';
import type { ReportRange } from './schemas';

export function useSalesReport(range: ReportRange, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', range.from, range.to],
    queryFn: async () => {
      const result = await readSalesReport(range);
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled,
  });
}
