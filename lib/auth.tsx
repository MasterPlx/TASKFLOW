'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const AUTH_KEY = 'tf_admin_authed';

function readAuthed(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(AUTH_KEY) === '1';
}

function writeAuthed(flag: boolean): void {
  if (typeof window === 'undefined') return;
  if (flag) sessionStorage.setItem(AUTH_KEY, '1');
  else sessionStorage.removeItem(AUTH_KEY);
}

function checkPassword(input: string): boolean {
  const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? '';
  return input.length > 0 && input === expected;
}

interface AuthContextValue {
  ready: boolean;
  authed: boolean;
  login: (pwd: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(readAuthed());
    setReady(true);
  }, []);

  const login = useCallback((pwd: string) => {
    if (checkPassword(pwd)) {
      writeAuthed(true);
      setAuthed(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    writeAuthed(false);
    setAuthed(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ready, authed, login, logout }),
    [ready, authed, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AuthProvider');
  return ctx;
}
