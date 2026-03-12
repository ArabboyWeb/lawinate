import axios from 'axios';
import { resolveApiBaseUrl, shouldResetSession } from './shared/apiBase';

const API_BASE = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE,
  timeout: 25000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const cfg = error?.config || {};
    if (
      (error?.code === 'ERR_NETWORK' || /Network Error/i.test(String(error?.message || '')))
      && !cfg.__retry_once
    ) {
      cfg.__retry_once = true;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return api(cfg);
    }

    if (shouldResetSession(error, ['/api/profile'])) {
      localStorage.removeItem('token');
      localStorage.removeItem('admin_token');
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname || '';
        const publicPaths = ['/', '/auth', '/ranking', '/library', '/tests'];
        const isPublic = publicPaths.some((path) => currentPath === path || currentPath.startsWith('/tests/'));
        if (!isPublic && !currentPath.startsWith('/admin')) {
          window.location.assign('/auth');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
