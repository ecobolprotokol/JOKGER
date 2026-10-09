import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDLE_TIMEOUT_MS, useIdleTimeout } from './useIdleTimeout';

afterEach(() => {
  vi.useRealTimers();
});

describe('useIdleTimeout', () => {
  it('mengakhiri sesi aktif setelah delapan jam tanpa aktivitas', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    window.history.replaceState(null, '', '/pos');
    const queryClient = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useIdleTimeout(true), { wrapper });
    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(window.location.pathname).toBe('/login');
    expect(window.location.search).toBe('?reason=idle');
  });

  it('tidak memasang timer untuk sesi nonaktif', () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { unmount } = renderHook(() => useIdleTimeout(false), { wrapper });
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });
});
