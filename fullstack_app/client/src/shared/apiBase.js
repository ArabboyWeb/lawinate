function isLocalHostname(hostname = '') {
  const normalized = String(hostname || '').toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]';
}

export function resolveApiBaseUrl() {
  const configured = String(process.env.REACT_APP_API_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    if (isLocalHostname(window.location.hostname)) {
      return 'http://localhost:3001';
    }
    return '';
  }

  return process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '';
}

export function shouldResetSession(error, protectedPaths = []) {
  const status = error?.response?.status;
  if (status === 401) return true;

  if (status !== 403) return false;

  const url = String(error?.config?.url || '');
  return protectedPaths.some((path) => url.includes(path));
}
