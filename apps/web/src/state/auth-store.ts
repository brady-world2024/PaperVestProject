import { create } from 'zustand';
import type { AuthResponse, AuthUser } from '@papervest/shared-types';

import { webApi } from '@/lib/api';

type AuthStatus = 'hydrating' | 'anonymous' | 'authenticated';

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  initialize: () => Promise<void>;
  completeAuth: (response: AuthResponse) => Promise<void>;
  clearSession: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
};

let refreshPromise: Promise<string | null> | null = null;
let initializePromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'hydrating',
  user: null,
  initialize: async () => {
    if (initializePromise) {
      return initializePromise;
    }

    set({
      status: 'hydrating',
      user: null,
    });

    initializePromise = (async () => {
      try {
        await webApi.initializeCsrf();
      } catch {
        set({
          status: 'anonymous',
          user: null,
        });
        return;
      }

      try {
        const session = await webApi.getSession();
        set({
          status: 'authenticated',
          user: session.user,
        });
        return;
      } catch (error) {
        if (webApi.getApiErrorStatus(error) !== 401) {
          set({
            status: 'anonymous',
            user: null,
          });
          return;
        }
      }

      const refreshed = await get().refreshSession();
      if (!refreshed) {
        set({
          status: 'anonymous',
          user: null,
        });
      }
    })().finally(() => {
      initializePromise = null;
    });

    return initializePromise;
  },
  completeAuth: async (response) => {
    set({
      status: 'authenticated',
      user: response.user,
    });
  },
  clearSession: async () => {
    set({
      status: 'anonymous',
      user: null,
    });
  },
  signOut: async () => {
    try {
      await webApi.logout();
    } catch {
      // Cookie clearing is best-effort; stale UI state should still be removed locally.
    } finally {
      await get().clearSession();
    }
  },
  refreshSession: async () => {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      try {
        const nextSession = await webApi.refreshAuth({
          deviceName: 'PaperVest Web',
        });
        set({
          status: 'authenticated',
          user: nextSession.user,
        });
        return 'cookie-session';
      } catch {
        await get().clearSession();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },
}));
