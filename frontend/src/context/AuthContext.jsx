import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authAPI, getAuthToken, setAuthToken, STANDALONE } from '../services/api.js';

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
      // Modo autônomo não tem contas nem sessão: existe um único usuário local.
      if (STANDALONE) {
        try {
          const me = await authAPI.me();
          if (!cancelled) setUser(normalizeUser(me));
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

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
    if (STANDALONE) return; // não há de onde sair
    setAuthToken(null);
    setUser(null);
  }, []);

  const updateLocalUser = useCallback((nextUser) => {
    setUser(normalizeUser(nextUser));
  }, []);

  /**
   * Marca a apresentação de primeiro uso como vista. O estado local muda na hora
   * para a janela fechar sem esperar a rede; se a chamada falhar, o pior caso é a
   * apresentação reaparecer no próximo acesso.
   */
  const completeOnboarding = useCallback(async () => {
    setUser((current) =>
      current ? { ...current, onboardingCompletedAt: new Date().toISOString() } : current,
    );
    try {
      const updated = await authAPI.completeOnboarding();
      setUser(normalizeUser(updated));
    } catch {
      // Silencioso de propósito: é preferência de exibição, não dado do usuário.
    }
  }, []);

  /**
   * Reabre a apresentação. Mexe só no estado local — a data no banco continua lá,
   * então concluir de novo não sobrescreve quando o usuário viu pela primeira vez.
   */
  const replayOnboarding = useCallback(() => {
    setUser((current) => (current ? { ...current, onboardingCompletedAt: null } : current));
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
      completeOnboarding,
      replayOnboarding,
    }),
    [
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      updateLocalUser,
      completeOnboarding,
      replayOnboarding,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
