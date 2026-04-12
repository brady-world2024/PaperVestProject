import { create } from 'zustand';

import { refreshAuth } from '../services/api/papervestApi';
import { AuthResponse, AuthSession } from '../services/api/types';
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
} from '../services/storage/authStorage';

type AuthStatus = 'hydrating' | 'anonymous' | 'authenticated';

type AuthState = {
  status: AuthStatus;
  session: AuthSession | null;
  initialize: () => Promise<void>;
  completeAuth: (response: AuthResponse) => Promise<void>;
  clearSession: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
};

let refreshPromise: Promise<string | null> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'hydrating',
  session: null,
  initialize: async () => {
    const session = await loadStoredSession();
    set({
      status: session ? 'authenticated' : 'anonymous',
      session,
    });
  },
  completeAuth: async (response) => {
    await saveStoredSession(response);
    set({
      status: 'authenticated',
      session: response,
    });
  },
  clearSession: async () => {
    await clearStoredSession();
    set({
      status: 'anonymous',
      session: null,
    });
  },
  signOut: async () => {
    await get().clearSession();
  },
  refreshSession: async () => {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      const currentSession = get().session;
      if (!currentSession?.refreshToken) {
        await get().clearSession();
        return null;
      }

      try {
        const nextSession = await refreshAuth(
          currentSession.refreshToken,
          'PaperVest Mobile'
        );
        await saveStoredSession(nextSession);
        set({
          status: 'authenticated',
          session: nextSession,
        });
        return nextSession.accessToken;
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
