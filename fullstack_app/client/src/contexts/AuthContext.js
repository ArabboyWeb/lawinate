import React, { createContext, useState, useEffect } from 'react';
import api from '../api';
import { trackEvent } from '../shared/analytics';

// Authentication context encapsulates the logic for logging in,
// registering, storing and removing the JWT token and user object.
// Components can consume this context to access the current user
// information and perform auth actions without duplicating code.

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const decodeBase64UrlJson = (encoded) => {
    const raw = String(encoded || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = raw + '==='.slice((raw.length + 3) % 4);
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const jsonText = typeof TextDecoder !== 'undefined'
      ? new TextDecoder('utf-8').decode(bytes)
      : decodeURIComponent(bytes.reduce((acc, byte) => `${acc}%${byte.toString(16).padStart(2, '0')}`, ''));
    return JSON.parse(jsonText);
  };

  const applyAuthToken = (token) => {
    if (!token) return;
    localStorage.setItem('token', token);
  };

  const applyAuthSession = (token, incomingUser) => {
    applyAuthToken(token);
    if (incomingUser && ['admin', 'moderator'].includes(incomingUser.role)) {
      localStorage.setItem('admin_token', token);
    } else {
      localStorage.removeItem('admin_token');
    }
    setUser(incomingUser || null);
  };

  const consumeGoogleCallbackParams = () => {
    if (typeof window === 'undefined') return false;

    if (window.location.pathname.startsWith('/admin')) {
      return false;
    }

    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    const userB64 = url.searchParams.get('user');
    const provider = url.searchParams.get('auth_provider');
    const error = url.searchParams.get('error');

    if (error) {
      localStorage.removeItem('token');
      setUser(null);
      const authUrl = new URL('/auth', window.location.origin);
      authUrl.searchParams.set('error', error);
      window.history.replaceState({}, '', authUrl.toString());
      return true;
    }

    if (provider === 'google' && token && userB64) {
      try {
        const decoded = decodeBase64UrlJson(userB64);
        applyAuthSession(token, decoded);

        const cleanUrl = new URL('/dashboard', window.location.origin);
        window.history.replaceState({}, '', cleanUrl.toString());
        trackEvent('login_success', {
          path: '/dashboard',
          meta: {
            provider: 'google'
          }
        });
        return true;
      } catch (_err) {
        localStorage.removeItem('token');
        setUser(null);
        const authUrl = new URL('/auth', window.location.origin);
        authUrl.searchParams.set('error', 'Google login data is invalid');
        window.history.replaceState({}, '', authUrl.toString());
        return true;
      }
    }

    return false;
  };

  // Restore the user from localStorage on first render.  If a token
  // exists, attempt to fetch the profile.  If the token is invalid,
  // remove it.
  useEffect(() => {
    if (consumeGoogleCallbackParams()) {
      setLoading(false);
      return;
    }

    const token = localStorage.getItem('token');
    if (token) {
      api
        .get('/api/profile')
        .then((res) => {
          const profileUser = res.data.user;
          if (profileUser && ['admin', 'moderator'].includes(profileUser.role)) {
            localStorage.setItem('admin_token', token);
          } else {
            localStorage.removeItem('admin_token');
          }
          setUser(profileUser);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Log the user in with email and password.  On success, store
  // the token and user in localStorage and update state.
  const login = async (email, password) => {
    const res = await api.post('/api/login', { email, password });
    applyAuthSession(res.data.token, res.data.user);
  };

  // Register a new user.  Accepts various user fields.  On success,
  // behave like login.
  const register = async (form) => {
    const res = await api.post('/api/register', form);
    applyAuthSession(res.data.token, res.data.user);
  };

  const loginWithGoogle = async (redirect = '/dashboard') => {
    const res = await api.get('/api/auth/google/url', { params: { redirect } });
    const url = res.data?.url;
    if (!url) {
      throw new Error('Google URL not returned');
    }

    if (typeof window !== 'undefined') {
      window.location.assign(url);
    }
  };

  // Log out: remove token and user from localStorage and state.
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, login, register, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
