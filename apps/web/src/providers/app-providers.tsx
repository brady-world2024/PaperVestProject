'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { webApi } from '@/lib/api';
import { useAuthStore } from '@/state/auth-store';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  useEffect(() => {
    webApi.setAuthHandlers({
      refreshSession: () => useAuthStore.getState().refreshSession(),
      onAuthenticationFailure: async () => {
        queryClient.clear();
        await useAuthStore.getState().clearSession();
      },
    });
    void useAuthStore.getState().initialize();
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
