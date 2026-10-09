import { useQuery } from '@tanstack/react-query';
import { readMenuCatalog } from './api';

export function useMenuCatalog() {
  return useQuery({
    queryKey: ['menu', 'catalog'],
    queryFn: async () => {
      const result = await readMenuCatalog();
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
  });
}
