import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export const homeFor = (role) => ({ customer: '/customer/dashboard', provider: '/provider/dashboard', admin: '/admin/dashboard' }[role] || '/');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const clear = useCallback(() => { setToken(null); setUser(null); }, []);

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api.get('/auth/me').then((r) => setUser(r.user)).catch(clear).finally(() => setReady(true));
  }, [clear]);

  useEffect(() => {
    window.addEventListener('hg:unauthorized', clear);
    return () => window.removeEventListener('hg:unauthorized', clear);
  }, [clear]);

  const login = async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    setToken(r.token); setUser(r.user); return r.user;
  };
  const register = async (payload) => {
    const r = await api.post('/auth/register', payload);
    setToken(r.token); setUser(r.user); return r.user;
  };
  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* token may already be invalid */ }
    clear();
  };

  return <Ctx.Provider value={{ user, ready, login, register, logout }}>{children}</Ctx.Provider>;
}
