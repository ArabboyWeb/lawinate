import axios from 'axios';

function resolveApiBaseUrl() {
  const configured = String(process.env.REACT_APP_API_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  // Full-stack default: same-origin (/api/*) behind reverse-proxy.
  return '';
}

const API_BASE = resolveApiBaseUrl();

const adminApi = axios.create({
  baseURL: API_BASE,
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem('admin_token');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
        window.location.assign('/admin/login');
      }
    }
    return Promise.reject(error);
  }
);

export default adminApi;
