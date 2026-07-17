import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, type User } from './api.js';

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const readUser = (): User | null => {
  const value = sessionStorage.getItem('wct_user');
  if (!value) return null;
  try {
    return JSON.parse(value) as User;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }): ReactNode => {
  const [user, setUser] = useState<User | null>(readUser);
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const response = await api.login(email, password);
    sessionStorage.setItem('wct_access_token', response.data.accessToken);
    sessionStorage.setItem('wct_user', JSON.stringify(response.data.user));
    setUser(response.data.user);
  }, []);
  const logout = useCallback((): void => {
    sessionStorage.removeItem('wct_access_token');
    sessionStorage.removeItem('wct_user');
    setUser(null);
  }, []);
  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
};
