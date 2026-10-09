import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { SessionProvider } from '../features/auth';
import { ConnectionMonitor } from './ConnectionMonitor';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 300_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionMonitor>
        <SessionProvider>
          {children}
          <Toaster position="top-right" closeButton visibleToasts={3} />
        </SessionProvider>
      </ConnectionMonitor>
    </QueryClientProvider>
  );
}
