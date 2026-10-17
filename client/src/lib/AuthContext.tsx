import * as React from 'react';
import { realApi, API_URL, ApiError, isMockEnabled, type CurrentUser } from './api';

interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  error: ApiError | null;
  signIn: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<CurrentUser | null>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<CurrentUser | null>(() => {
    try {
      const cached = localStorage.getItem('cb_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const fetchUser = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (isMockEnabled) {
        const mockUser: CurrentUser = {
          id: 'mock-user-1',
          email: 'alex.chen@devtools.co',
          full_name: 'Alex Chen',
          github: {
            username: 'alexc-dev',
            github_user_id: '123456',
          },
        };
        setUser(mockUser);
        try {
          localStorage.setItem('cb_user', JSON.stringify(mockUser));
        } catch {}
        return mockUser;
      }
      const data = await realApi.getCurrentUser();
      setUser(data);
      try {
        localStorage.setItem('cb_user', JSON.stringify(data));
      } catch {}
      return data;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      }
      setUser(null);
      try {
        localStorage.removeItem('cb_user');
      } catch {}
      return null;
    } finally {
      setLoading(false);
    }
  }, []);


  React.useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const signIn = React.useCallback(() => {
    window.location.href = `${API_URL}/auth/github`;
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await realApi.logout();
    } catch (err) {
      console.warn('Logout request failed:', err);
    } finally {
      setUser(null);
      try {
        localStorage.removeItem('cb_user');
      } catch {}
      window.location.href = '/';
    }
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      loading,
      error,
      signIn,
      logout,
      refreshUser: fetchUser,
    }),
    [user, loading, error, signIn, logout, fetchUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
