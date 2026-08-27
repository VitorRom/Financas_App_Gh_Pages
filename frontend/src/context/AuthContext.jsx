import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authAPI, getAuthToken, setAuthToken } from '../services/api.js';

const AuthContext = createContext(null);

function parsePlanFeatures(plan) {
  if (!plan) return plan;
  const next = { ...plan };
  if (typeof next.features === 'string') {
    try {
      next.features = JSON.parse(next.features || '{}');
    } catch {
      next.features = {};
    }
  }
  return next;
}

export function normalizeUser(user) {
  if (!user?.subscription?.plan) return user;
  return {
    ...user,
    subscription: {
      ...user.subscription,
      plan: parsePlanFeatures(user.subscription.plan),
    },
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      return null;
    }
    const me = await authAPI.me();
    const normalized = normalizeUser(me);
    setUser(normalized);
    return normalized;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!getAuthToken()) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const me = await authAPI.me();
        if (!cancelled) setUser(normalizeUser(me));
      } catch {
        setAuthToken(null);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onSessionExpired = () => {
      setUser(null);
    };
    window.addEventListener('auth:session-expired', onSessionExpired);
    return () => window.removeEventListener('auth:session-expired', onSessionExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authAPI.login({ email, password });
    setAuthToken(data.token);
    setUser(normalizeUser(data.user));
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authAPI.register(payload);
    setAuthToken(data.token);
    setUser(normalizeUser(data.user));
    return data;
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  const updateLocalUser = useCallback((nextUser) => {
    setUser(normalizeUser(nextUser));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      updateLocalUser,
    }),
    [user, loading, login, register, logout, refreshUser, updateLocalUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
