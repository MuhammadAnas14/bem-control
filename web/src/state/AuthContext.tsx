import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CurrentUser, OrganizationMembership } from '@bem-control/api-client';
import { apiClient } from '../lib/apiClient';
import { getSelectedOrgId, getToken, setSelectedOrgId, setToken } from './authStore';

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  selectedOrgId: string | null;
  selectedOrg: OrganizationMembership | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: {
    email: string;
    password: string;
    name: string;
    organizationName: string;
  }) => Promise<void>;
  logout: () => void;
  selectOrg: (orgId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(getSelectedOrgId());

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiClient.getCurrentUser();
      setUser(me);
      if (!getSelectedOrgId() && me.organizations.length > 0) {
        setSelectedOrgId(me.organizations[0].id);
        setSelectedOrgIdState(me.organizations[0].id);
      }
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token } = await apiClient.login({ email, password });
      setToken(token);
      await refreshUser();
    },
    [refreshUser]
  );

  const signup = useCallback(
    async (input: { email: string; password: string; name: string; organizationName: string }) => {
      const { token } = await apiClient.signup(input);
      setToken(token);
      await refreshUser();
    },
    [refreshUser]
  );

  const logout = useCallback(() => {
    setToken(null);
    setSelectedOrgId(null);
    setUser(null);
    setSelectedOrgIdState(null);
  }, []);

  const selectOrg = useCallback((orgId: string) => {
    setSelectedOrgId(orgId);
    setSelectedOrgIdState(orgId);
  }, []);

  const selectedOrg = useMemo(
    () => user?.organizations.find((o) => o.id === selectedOrgId) ?? null,
    [user, selectedOrgId]
  );

  const value = useMemo(
    () => ({ user, loading, selectedOrgId, selectedOrg, login, signup, logout, selectOrg }),
    [user, loading, selectedOrgId, selectedOrg, login, signup, logout, selectOrg]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
