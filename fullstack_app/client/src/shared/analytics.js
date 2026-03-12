import { resolveApiBaseUrl } from './apiBase';

const API_BASE = resolveApiBaseUrl();
const VISITOR_KEY = 'lawinate_analytics_visitor_id';
const SESSION_KEY = 'lawinate_analytics_session_id';
const ATTRIBUTION_KEY = 'lawinate_analytics_attribution';
const LANDING_REFERRER_KEY = 'lawinate_analytics_referrer';
const LAST_PAGE_KEY = 'lawinate_analytics_last_page';

function canUseBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function readStorage(storage, key) {
  try {
    return storage.getItem(key);
  } catch (_err) {
    return '';
  }
}

function writeStorage(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch (_err) {
    // Ignore storage failures.
  }
}

function randomId(prefix) {
  const part = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${part}`;
}

function getOrCreateVisitorId() {
  if (!canUseBrowser()) return randomId('anon');
  const existing = readStorage(window.localStorage, VISITOR_KEY);
  if (existing) return existing;
  const next = randomId('anon');
  writeStorage(window.localStorage, VISITOR_KEY, next);
  return next;
}

function getOrCreateSessionId() {
  if (!canUseBrowser()) return randomId('sess');
  const existing = readStorage(window.sessionStorage, SESSION_KEY);
  if (existing) return existing;
  const next = randomId('sess');
  writeStorage(window.sessionStorage, SESSION_KEY, next);
  return next;
}

function stripSensitiveParams(search = '') {
  const params = new URLSearchParams(search);
  ['token', 'user', 'auth_provider', 'error'].forEach((key) => params.delete(key));
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function getCurrentPath(explicitPath = '') {
  if (explicitPath) {
    const url = new URL(explicitPath, 'https://lawinate.local');
    return `${url.pathname}${stripSensitiveParams(url.search)}`;
  }

  if (!canUseBrowser()) return '/';
  return `${window.location.pathname}${stripSensitiveParams(window.location.search)}`;
}

function parseAttributionFromLocation() {
  if (!canUseBrowser()) {
    return {
      source: 'direct',
      medium: '(none)',
      campaign: '',
      term: '',
      content: ''
    };
  }

  const params = new URLSearchParams(window.location.search);
  const source = params.get('utm_source') || '';
  const medium = params.get('utm_medium') || '';
  const campaign = params.get('utm_campaign') || '';
  const term = params.get('utm_term') || '';
  const content = params.get('utm_content') || '';

  if (source || medium || campaign || term || content) {
    return {
      source: source || 'campaign',
      medium: medium || 'utm',
      campaign,
      term,
      content
    };
  }

  const referrer = document.referrer || '';
  if (!referrer) {
    return {
      source: 'direct',
      medium: '(none)',
      campaign: '',
      term: '',
      content: ''
    };
  }

  try {
    const refUrl = new URL(referrer);
    if (refUrl.hostname === window.location.hostname) {
      return {
        source: 'direct',
        medium: '(none)',
        campaign: '',
        term: '',
        content: ''
      };
    }

    const hostname = refUrl.hostname.replace(/^www\./, '');
    const isSearchEngine = /google\.|bing\.|yahoo\.|yandex\.|duckduckgo\./i.test(hostname);

    return {
      source: hostname || 'referral',
      medium: isSearchEngine ? 'organic' : 'referral',
      campaign: '',
      term: '',
      content: ''
    };
  } catch (_err) {
    return {
      source: 'referral',
      medium: 'referral',
      campaign: '',
      term: '',
      content: ''
    };
  }
}

function getSessionAttribution() {
  if (!canUseBrowser()) {
    return parseAttributionFromLocation();
  }

  const fromUrl = parseAttributionFromLocation();
  const hasExplicitCampaign = fromUrl.campaign
    || fromUrl.term
    || fromUrl.content
    || fromUrl.medium !== '(none)'
    || fromUrl.source !== 'direct';

  if (hasExplicitCampaign) {
    writeStorage(window.sessionStorage, ATTRIBUTION_KEY, JSON.stringify(fromUrl));
    return fromUrl;
  }

  const stored = readStorage(window.sessionStorage, ATTRIBUTION_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (_err) {
      // Ignore malformed storage entries.
    }
  }

  writeStorage(window.sessionStorage, ATTRIBUTION_KEY, JSON.stringify(fromUrl));
  return fromUrl;
}

function getLandingReferrer() {
  if (!canUseBrowser()) return '';
  const stored = readStorage(window.sessionStorage, LANDING_REFERRER_KEY);
  if (stored) return stored;
  const referrer = document.referrer || '';
  if (referrer) {
    try {
      const refUrl = new URL(referrer);
      if (refUrl.hostname === window.location.hostname) {
        return '';
      }
    } catch (_err) {
      // Keep non-URL referrers as-is.
    }

    writeStorage(window.sessionStorage, LANDING_REFERRER_KEY, referrer);
  }
  return referrer;
}

function getDefaultMeta() {
  if (!canUseBrowser()) return {};
  return {
    language: navigator.language || '',
    screen_width: window.screen?.width || 0,
    screen_height: window.screen?.height || 0,
    viewport_width: window.innerWidth || 0,
    viewport_height: window.innerHeight || 0,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  };
}

function postAnalytics(payload) {
  const headers = { 'Content-Type': 'application/json' };
  const token = canUseBrowser() ? readStorage(window.localStorage, 'token') : '';
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(`${API_BASE}/api/analytics/track`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => undefined);
}

export function trackPageView(options = {}) {
  if (!canUseBrowser()) return Promise.resolve();

  const path = getCurrentPath(options.path);
  const signature = `${path}|${document.title || ''}`;
  const now = Date.now();
  const lastRaw = readStorage(window.sessionStorage, LAST_PAGE_KEY);

  if (lastRaw) {
    try {
      const last = JSON.parse(lastRaw);
      if (last.signature === signature && now - Number(last.at || 0) < 1500) {
        return Promise.resolve();
      }
    } catch (_err) {
      // Ignore malformed dedupe state.
    }
  }

  writeStorage(window.sessionStorage, LAST_PAGE_KEY, JSON.stringify({ signature, at: now }));

  const attribution = getSessionAttribution();

  return postAnalytics({
    event_name: 'page_view',
    visitor_id: getOrCreateVisitorId(),
    session_id: getOrCreateSessionId(),
    path,
    page_title: options.pageTitle || document.title || '',
    referrer: getLandingReferrer(),
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign,
    term: attribution.term,
    content: attribution.content,
    meta: {
      ...getDefaultMeta(),
      ...(options.meta || {})
    }
  });
}

export function trackEvent(eventName, options = {}) {
  if (!canUseBrowser()) return Promise.resolve();

  const attribution = getSessionAttribution();

  return postAnalytics({
    event_name: String(eventName || '').toLowerCase(),
    visitor_id: getOrCreateVisitorId(),
    session_id: getOrCreateSessionId(),
    path: getCurrentPath(options.path),
    page_title: options.pageTitle || document.title || '',
    referrer: getLandingReferrer(),
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign,
    term: attribution.term,
    content: attribution.content,
    meta: {
      ...getDefaultMeta(),
      ...(options.meta || {})
    }
  });
}
