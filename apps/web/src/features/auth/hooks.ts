import { useQuery } from '@tanstack/react-query';
import { readProfile } from './api';
import { useAuthSession } from './SessionProvider';

export function useProfile() {
  const { session } = useAuthSession();
  return useQuery({
    queryKey: ['session', session?.user.id],
    queryFn: async () => {
      if (!session) {
        return null;
      }
      const result = await readProfile(session.user.id);
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    enabled: Boolean(session),
    staleTime: 30_000,
  });
}
