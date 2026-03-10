import axios from 'axios';
import { resolveApiBaseUrl, shouldResetSession } from '../shared/apiBase';

const API_BASE = resolveApiBaseUrl();

const adminApi = axios.create({
  baseURL: API_BASE,
  timeout: 25000,
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
  async (error) => {
    const cfg = error?.config || {};
    if (
      (error?.code === 'ERR_NETWORK' || /Network Error/i.test(String(error?.message || '')))
      && !cfg.__retry_once
    ) {
      cfg.__retry_once = true;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return adminApi(cfg);
    }

    if (shouldResetSession(error, ['/api/admin/auth/me'])) {
      localStorage.removeItem('admin_token');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
        window.location.assign('/admin/login');
      }
    }
    return Promise.reject(error);
  }
);

export default adminApi;
