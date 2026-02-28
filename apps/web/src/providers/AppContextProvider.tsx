'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Application } from '@/lib/types';

interface AppContextValue {
  selectedApp: Application | null;
  selectedEnv: string | null;
  setSelectedApp: (app: Application | null) => void;
  setSelectedEnv: (env: string | null) => void;
  clearAppContext: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEY_APP = 'qc-selected-app';
const STORAGE_KEY_ENV = 'qc-selected-env';

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [selectedApp, setSelectedAppState] = useState<Application | null>(null);
  const [selectedEnv, setSelectedEnvState] = useState<string | null>(null);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const storedApp = localStorage.getItem(STORAGE_KEY_APP);
      const storedEnv = localStorage.getItem(STORAGE_KEY_ENV);
      if (storedApp) setSelectedAppState(JSON.parse(storedApp));
      if (storedEnv) setSelectedEnvState(storedEnv);
    } catch {
      // ignore parse errors
    }
  }, []);

  const setSelectedApp = useCallback((app: Application | null) => {
    setSelectedAppState(app);
    setSelectedEnvState(null); // reset env when app changes
    if (app) {
      localStorage.setItem(STORAGE_KEY_APP, JSON.stringify(app));
    } else {
      localStorage.removeItem(STORAGE_KEY_APP);
    }
    localStorage.removeItem(STORAGE_KEY_ENV);
  }, []);

  const setSelectedEnv = useCallback((env: string | null) => {
    setSelectedEnvState(env);
    if (env) {
      localStorage.setItem(STORAGE_KEY_ENV, env);
    } else {
      localStorage.removeItem(STORAGE_KEY_ENV);
    }
  }, []);

  const clearAppContext = useCallback(() => {
    setSelectedAppState(null);
    setSelectedEnvState(null);
    localStorage.removeItem(STORAGE_KEY_APP);
    localStorage.removeItem(STORAGE_KEY_ENV);
  }, []);

  return (
    <AppContext.Provider value={{ selectedApp, selectedEnv, setSelectedApp, setSelectedEnv, clearAppContext }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppContextProvider');
  return ctx;
}
