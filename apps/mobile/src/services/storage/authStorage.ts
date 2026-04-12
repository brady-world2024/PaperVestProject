import * as SecureStore from 'expo-secure-store';

import { AuthSession } from '../api/types';

const SESSION_KEY = 'papervest.auth.session';

export async function loadStoredSession() {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as AuthSession;
}

export async function saveStoredSession(session: AuthSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
