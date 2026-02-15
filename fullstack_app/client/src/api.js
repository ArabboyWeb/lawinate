import axios from 'axios';

// Centralized axios instance for API requests.  The base URL is
// configurable via the REACT_APP_API_URL environment variable; if not
// provided, it defaults to the local development server.  An
// interceptor automatically attaches the JWT token from localStorage
// (if present) to all outgoing requests.

function resolveApiBaseUrl() {
  const configured = String(process.env.REACT_APP_API_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  // Full-stack default backend.
  return 'https://lawinate-sc7t.onrender.com';
}

const API_BASE = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE,
  timeout: 25000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
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

    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem('token');
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
