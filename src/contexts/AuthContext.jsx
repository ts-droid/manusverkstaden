import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, AuthError } from '../lib/api-client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Try to restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const refreshed = await apiClient.refresh();
        if (refreshed) {
          const { user: me } = await apiClient.getMe();
          setUser(me);
        }
      } catch {
        // No valid session
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const u = await apiClient.login(email, password);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const u = await apiClient.register(email, password, name);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await apiClient.logout();
    setUser(null);
  }, []);

  const value = { user, loading, login, register, logout, isAuthenticated: !!user };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
