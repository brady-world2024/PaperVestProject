import { PropsWithChildren, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { configureApiClient } from '../services/api/client';
import { useAuthStore } from '../state/authStore';
import { appTheme } from '../theme';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: appTheme.colors.background,
    card: appTheme.colors.surface,
    border: appTheme.colors.border,
    text: appTheme.colors.textPrimary,
    primary: appTheme.colors.accent,
  },
};

export function AppProviders({ children }: PropsWithChildren) {
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
    configureApiClient({
      getAccessToken: () => useAuthStore.getState().session?.accessToken ?? null,
      refreshSession: () => useAuthStore.getState().refreshSession(),
      onAuthenticationFailure: async () => {
        queryClient.clear();
        await useAuthStore.getState().clearSession();
      },
    });
    void useAuthStore.getState().initialize();
  }, [queryClient]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer theme={navigationTheme}>
          <StatusBar style="dark" />
          {children}
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
