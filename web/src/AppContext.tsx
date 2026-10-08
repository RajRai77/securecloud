import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { HealthResult } from './api';
import { fetchHealth } from './api';

// ─── Toast ────────────────────────────────────────────────────
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ─── Lockdown helper ──────────────────────────────────────────
const SETTINGS_KEY = 'sc_security_settings';

function getLockdownState(): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!parsed.lockdownMode;
  } catch { return false; }
}

// ─── App Context ──────────────────────────────────────────────
interface AppContextValue {
  health: HealthResult | null;
  healthLoading: boolean;
  refreshHealth: () => void;

  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;

  searchQuery: string;
  setSearchQuery: (q: string) => void;

  /** True when Security Lockdown Mode is active */
  isLockdown: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLockdown, setIsLockdown] = useState(() => getLockdownState());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch {
      setHealth({ status: 'offline', nextcloud: false, checkedAt: new Date().toISOString() });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    intervalRef.current = setInterval(refreshHealth, 12000);
    const onFocus = () => refreshHealth();
    window.addEventListener('focus', onFocus);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshHealth]);

  // Poll localStorage for lockdown changes (cross-tab via storage event)
  useEffect(() => {
    const onStorage = () => setIsLockdown(getLockdownState());
    window.addEventListener('storage', onStorage);
    // Also poll every 2s so changes in the same tab propagate
    const poll = setInterval(() => setIsLockdown(getLockdownState()), 2000);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(poll);
    };
  }, []);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  return (
    <AppContext.Provider
      value={{ health, healthLoading, refreshHealth, toasts, addToast, removeToast, searchQuery, setSearchQuery, isLockdown }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
