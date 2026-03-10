import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import adminApi from './adminApi';

export const AdminAuthContext = createContext({
  admin: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const decodeBase64UrlJson = useCallback((encoded) => {
    const raw = String(encoded || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = raw + '==='.slice((raw.length + 3) % 4);
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const jsonText = typeof TextDecoder !== 'undefined'
      ? new TextDecoder('utf-8').decode(bytes)
      : decodeURIComponent(bytes.reduce((acc, byte) => `${acc}%${byte.toString(16).padStart(2, '0')}`, ''));
    return JSON.parse(jsonText);
  }, []);

  const applyAdminSession = useCallback((token, user) => {
    if (!token || !user) return;
    localStorage.setItem('admin_token', token);
    setAdmin(user);
  }, []);

  const consumeGoogleAdminCallbackParams = useCallback(() => {
    if (typeof window === 'undefined') return false;

    const url = new URL(window.location.href);
    const provider = url.searchParams.get('auth_provider');
    const token = url.searchParams.get('token');
    const userB64 = url.searchParams.get('user');
    const error = url.searchParams.get('error');
    const onAdminPath = window.location.pathname.startsWith('/admin');

    if (!onAdminPath) return false;

    if (error) {
      localStorage.removeItem('admin_token');
      setAdmin(null);
      const loginUrl = new URL('/admin/login', window.location.origin);
      loginUrl.searchParams.set('error', error);
      window.history.replaceState({}, '', loginUrl.toString());
      return true;
    }

    if (provider !== 'google' || !token || !userB64) {
      return false;
    }

    try {
      const decoded = decodeBase64UrlJson(userB64);
      if (!['admin', 'moderator'].includes(decoded.role)) {
        throw new Error('Admin access required');
      }

      applyAdminSession(token, decoded);
      window.history.replaceState({}, '', new URL('/admin/dashboard', window.location.origin).toString());
      return true;
    } catch (_err) {
      localStorage.removeItem('admin_token');
      setAdmin(null);
      const loginUrl = new URL('/admin/login', window.location.origin);
      loginUrl.searchParams.set('error', 'Google account has no admin access');
      window.history.replaceState({}, '', loginUrl.toString());
      return true;
    }
  }, [applyAdminSession, decodeBase64UrlJson]);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
    if (!token) {
      setAdmin(null);
      setLoading(false);
      return;
    }

    try {
      const res = await adminApi.get('/api/admin/auth/me');
      const user = res.data.user;
      if (user && ['admin', 'moderator'].includes(user.role)) {
        localStorage.setItem('admin_token', token);
        setAdmin(user);
      } else {
        localStorage.removeItem('admin_token');
        setAdmin(null);
      }
    } catch (_err) {
      localStorage.removeItem('admin_token');
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (consumeGoogleAdminCallbackParams()) {
      setLoading(false);
      return;
    }

    loadMe();
  }, [loadMe, consumeGoogleAdminCallbackParams]);

  const login = useCallback(async (email, password, rememberMe) => {
    const res = await adminApi.post('/api/admin/auth/login', {
      email,
      password,
      remember_me: rememberMe,
    });
    const user = res.data.user;
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      throw new Error('Admin access required');
    }
    applyAdminSession(res.data.token, user);
  }, [applyAdminSession]);

  const loginWithGoogle = useCallback(async (redirect = '/admin/dashboard') => {
    const res = await adminApi.get('/api/auth/google/url', { params: { redirect } });
    const url = res.data?.url;
    if (!url) {
      throw new Error('Google URL not returned');
    }
    if (typeof window !== 'undefined') {
      window.location.assign(url);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminApi.post('/api/admin/auth/logout');
    } catch (_err) {
      // ignore
    }
    localStorage.removeItem('admin_token');
    setAdmin(null);
  }, []);

  const value = useMemo(() => ({
    admin,
    loading,
    login,
    loginWithGoogle,
    logout,
    refresh: loadMe,
  }), [admin, loading, login, loginWithGoogle, logout, loadMe]);

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};
