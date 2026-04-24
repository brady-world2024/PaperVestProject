import { refreshAuth } from '../../services/api/papervestApi';
import { useAuthStore } from '../../state/authStore';
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
} from '../../services/storage/authStorage';

jest.mock('../../services/api/papervestApi', () => ({
  refreshAuth: jest.fn(),
}));

jest.mock('../../services/storage/authStorage', () => ({
  loadStoredSession: jest.fn(),
  saveStoredSession: jest.fn(),
  clearStoredSession: jest.fn(),
}));

const mockedRefreshAuth = jest.mocked(refreshAuth);
const mockedLoadStoredSession = jest.mocked(loadStoredSession);
const mockedSaveStoredSession = jest.mocked(saveStoredSession);
const mockedClearStoredSession = jest.mocked(clearStoredSession);

const demoSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  accessTokenExpiresAt: '2026-01-15T16:00:00Z',
  user: {
    id: 'user-1',
    email: 'alice@example.com',
  },
};

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useAuthStore.setState({
      status: 'hydrating',
      session: null,
    });
  });

  it('hydrates an existing stored mobile session', async () => {
    mockedLoadStoredSession.mockResolvedValue(demoSession);

    await useAuthStore.getState().initialize();

    expect(mockedLoadStoredSession).toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().session).toEqual(demoSession);
  });

  it('refreshes the mobile session and persists the rotated tokens', async () => {
    const nextSession = {
      ...demoSession,
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
    };

    useAuthStore.setState({
      status: 'authenticated',
      session: demoSession,
    });
    mockedRefreshAuth.mockResolvedValue(nextSession);

    const accessToken = await useAuthStore.getState().refreshSession();

    expect(mockedRefreshAuth).toHaveBeenCalledWith('refresh-token', 'PaperVest Mobile');
    expect(mockedSaveStoredSession).toHaveBeenCalledWith(nextSession);
    expect(accessToken).toBe('next-access-token');
    expect(useAuthStore.getState().session).toEqual(nextSession);
  });

  it('clears local session state when refresh fails', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      session: demoSession,
    });
    mockedRefreshAuth.mockRejectedValue(new Error('refresh failed'));

    const accessToken = await useAuthStore.getState().refreshSession();

    expect(accessToken).toBeNull();
    expect(mockedClearStoredSession).toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(useAuthStore.getState().session).toBeNull();
  });
});
