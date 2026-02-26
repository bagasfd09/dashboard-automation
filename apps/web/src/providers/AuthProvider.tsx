'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { api, setAccessToken } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const REFRESH_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true until first session check
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // On mount — try to restore session via refresh token cookie
  useEffect(() => {
    (async () => {
      try {
        // refreshToken() sends the httpOnly cookie automatically (credentials: 'include')
        // It returns both accessToken and user so we don't need a separate getMe() call
        const data = await api.refreshToken();
        setAccessToken(data.accessToken);
        setUser(data.user);
        setIsAuthenticated(true);
      } catch {
        // No valid session — user needs to log in
        setAccessToken(null);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []); // runs once on mount

  // Auto-refresh access token every 14 minutes while authenticated.
  // Uses isAuthenticated as trigger so it starts/stops cleanly.
  useEffect(() => {
    if (!isAuthenticated) return;

    const id = setInterval(async () => {
      try {
        const data = await api.refreshToken();
        setAccessToken(data.accessToken);
        if (data.user) setUser(data.user);
      } catch {
        // Refresh failed mid-session — force logout
        setAccessToken(null);
        setUser(null);
        setIsAuthenticated(false);
        router.push('/auth/login');
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isAuthenticated, router]);

  // Listen for 401 events dispatched by apiFetch when a non-refresh call fails
  useEffect(() => {
    const handler = () => {
      setAccessToken(null);
      setUser(null);
      setIsAuthenticated(false);
      router.push('/auth/login');
    };
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, [router]);

  const refreshUser = useCallback(async () => {
    const me = await api.getMe();
    setUser(me);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login(email, password);
    setAccessToken(data.accessToken);
    setUser(data.user);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore network errors on logout
    }
    setAccessToken(null);
    setUser(null);
    setIsAuthenticated(false);
    router.push('/auth/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
