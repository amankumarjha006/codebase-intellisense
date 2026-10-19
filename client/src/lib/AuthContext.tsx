import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { realApi, API_URL, ApiError, type CurrentUser } from './api';
import { classifyAuthError, buildSignInUrl } from './auth';

// On startup, delete any legacy cached user
try {
  localStorage.removeItem('cb_user');
} catch (e) {
  void e;
}

interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  error: ApiError | Error | null;
  signIn: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<CurrentUser | null>;
  markSessionExpired: () => void;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | Error | null>(null);

  const fetchUser = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await realApi.getCurrentUser();
      setUser(data);
      return data;
    } catch (err: unknown) {
      const errorKind = classifyAuthError(err);
      if (errorKind === 'unauthenticated') {
        // 401 means not signed in
        setUser(null);
        setError(null);
      } else {
        // Network errors, 5xx, or unreachable backend kept in error state
        setUser(null);
        setError(err instanceof ApiError || err instanceof Error ? err : new Error('Network error'));
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const markSessionExpired = React.useCallback(() => {
    setUser(null);
    navigate('/', { replace: true });
  }, [navigate]);

  const signIn = React.useCallback(() => {
    window.location.href = buildSignInUrl(API_URL);
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await realApi.logout();
    } catch (err) {
      console.warn('Logout request failed:', err);
    } finally {
      setUser(null);
      setError(null);
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
      markSessionExpired,
    }),
    [user, loading, error, signIn, logout, fetchUser, markSessionExpired]
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
