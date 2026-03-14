import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent, trackPageView, trackSessionStart } from '../shared/analytics';

const SCROLL_THRESHOLDS = [25, 50, 75, 100];
const DOWNLOAD_FILE_RE = /\.(pdf|docx?|xlsx?|pptx?|csv|zip|rar|7z|mp3|mp4|webm|ogg|png|jpe?g|webp)$/i;

function getRouteKey(location) {
  return `${location.pathname}${location.search || ''}`;
}

function getRouteGroup(path) {
  if (path.startsWith('/admin')) return 'admin';
  if (path === '/') return 'home';
  if (path.startsWith('/auth')) return 'auth';
  if (path.startsWith('/tests')) return 'tests';
  if (path.startsWith('/blog')) return 'blog';
  if (path.startsWith('/library')) return 'library';
  if (path.startsWith('/ranking')) return 'ranking';
  if (path.startsWith('/game-zone')) return 'game_zone';
  if (path.startsWith('/dashboard')) return 'dashboard';
  if (path.startsWith('/ai')) return 'ai';
  return 'other';
}

function buildRouteMeta(path) {
  return {
    route_group: getRouteGroup(path),
    path_depth: path.split('?')[0].split('/').filter(Boolean).length,
    is_admin: path.startsWith('/admin')
  };
}

function getSafeText(value, fallback = '') {
  const cleaned = String(value || fallback)
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 180);
}

function getSafeUrl(url) {
  return `${url.origin}${url.pathname}${url.search}`.slice(0, 500);
}

function stringifySafe(value) {
  try {
    return JSON.stringify(value);
  } catch (_err) {
    return String(value || '');
  }
}

function isDownloadLink(anchor, url) {
  return anchor.hasAttribute('download') || DOWNLOAD_FILE_RE.test(url.pathname);
}

function createErrorSignature(kind, details) {
  return `${kind}|${Object.values(details).join('|')}`.slice(0, 500);
}

const AnalyticsTracker = () => {
  const location = useLocation();
  const routeKey = getRouteKey(location);
  const activeRouteRef = useRef({ path: '', startedAt: 0 });
  const maxScrollRef = useRef(0);
  const scrollMarksRef = useRef(new Set());
  const lastExitRef = useRef({ signature: '', at: 0 });
  const lastErrorRef = useRef({ signature: '', at: 0 });
  const timingTrackedRef = useRef(false);

  const emitPageExit = (reason, nextPath = '') => {
    const activeRoute = activeRouteRef.current;
    if (!activeRoute.path || !activeRoute.startedAt) return;

    const durationMs = Math.max(0, Date.now() - activeRoute.startedAt);
    const signature = `${activeRoute.path}|${reason}|${nextPath}`;
    const now = Date.now();

    if (
      lastExitRef.current.signature === signature
      && now - lastExitRef.current.at < 1500
    ) {
      return;
    }

    lastExitRef.current = { signature, at: now };

    trackEvent('page_exit', {
      path: activeRoute.path,
      meta: {
        ...buildRouteMeta(activeRoute.path),
        reason,
        next_path: nextPath || undefined,
        duration_ms: durationMs,
        max_scroll_percent: maxScrollRef.current
      }
    });
  };

  useEffect(() => {
    const previousPath = activeRouteRef.current.path;
    if (previousPath) {
      emitPageExit('route_change', routeKey);
    }

    activeRouteRef.current = {
      path: routeKey,
      startedAt: Date.now()
    };
    maxScrollRef.current = 0;
    scrollMarksRef.current = new Set();

    trackPageView({
      path: routeKey,
      meta: buildRouteMeta(routeKey)
    });
  }, [routeKey]);

  useEffect(() => {
    trackSessionStart({
      path: routeKey,
      meta: buildRouteMeta(routeKey)
    });
  }, [routeKey]);

  useEffect(() => {
    const handleScroll = () => {
      const doc = document.documentElement;
      const scrollable = Math.max(doc.scrollHeight - window.innerHeight, 0);
      const currentPercent = scrollable <= 0
        ? 100
        : Math.min(100, Math.round((window.scrollY / scrollable) * 100));

      if (currentPercent > maxScrollRef.current) {
        maxScrollRef.current = currentPercent;
      }

      SCROLL_THRESHOLDS.forEach((threshold) => {
        if (currentPercent < threshold || scrollMarksRef.current.has(threshold)) return;

        scrollMarksRef.current.add(threshold);
        trackEvent('scroll_depth', {
          path: activeRouteRef.current.path || routeKey,
          meta: {
            ...buildRouteMeta(activeRouteRef.current.path || routeKey),
            percent: threshold
          }
        });
      });
    };

    const handleDocumentClick = (event) => {
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      let url;
      try {
        url = new URL(href, window.location.href);
      } catch (_err) {
        return;
      }

      const download = isDownloadLink(anchor, url);
      const external = url.origin !== window.location.origin;

      if (!download && !external) return;

      trackEvent(download ? 'download_click' : 'outbound_click', {
        path: activeRouteRef.current.path || routeKey,
        meta: {
          ...buildRouteMeta(activeRouteRef.current.path || routeKey),
          target_url: getSafeUrl(url),
          target_host: getSafeText(url.host),
          link_text: getSafeText(anchor.textContent, anchor.getAttribute('aria-label')),
          open_in_new_tab: anchor.target === '_blank',
          rel: getSafeText(anchor.getAttribute('rel')),
          protocol: getSafeText(url.protocol.replace(':', '')),
        }
      });
    };

    const handlePageHide = () => {
      emitPageExit('unload');
    };

    const handleError = (event) => {
      const details = {
        message: getSafeText(event.message),
        source: getSafeText(event.filename),
        line: Number(event.lineno) || 0,
        column: Number(event.colno) || 0
      };
      const signature = createErrorSignature('js_error', details);
      const now = Date.now();

      if (
        lastErrorRef.current.signature === signature
        && now - lastErrorRef.current.at < 2000
      ) {
        return;
      }

      lastErrorRef.current = { signature, at: now };

      trackEvent('js_error', {
        path: activeRouteRef.current.path || routeKey,
        meta: {
          ...buildRouteMeta(activeRouteRef.current.path || routeKey),
          ...details
        }
      });
    };

    const handleRejection = (event) => {
      const reason = event.reason;
      const details = {
        reason: getSafeText(
          typeof reason === 'string'
            ? reason
            : reason?.message || stringifySafe(reason || {})
        )
      };
      const signature = createErrorSignature('unhandled_rejection', details);
      const now = Date.now();

      if (
        lastErrorRef.current.signature === signature
        && now - lastErrorRef.current.at < 2000
      ) {
        return;
      }

      lastErrorRef.current = { signature, at: now };

      trackEvent('unhandled_rejection', {
        path: activeRouteRef.current.path || routeKey,
        meta: {
          ...buildRouteMeta(activeRouteRef.current.path || routeKey),
          ...details
        }
      });
    };

    const trackInitialTiming = () => {
      if (timingTrackedRef.current) return;
      timingTrackedRef.current = true;

      const navigationEntry = performance.getEntriesByType('navigation')[0];
      if (!navigationEntry) return;

      trackEvent('page_timing', {
        path: activeRouteRef.current.path || routeKey,
        meta: {
          ...buildRouteMeta(activeRouteRef.current.path || routeKey),
          ttfb_ms: Math.round(navigationEntry.responseStart || 0),
          dom_interactive_ms: Math.round(navigationEntry.domInteractive || 0),
          dom_content_loaded_ms: Math.round(navigationEntry.domContentLoadedEventEnd || 0),
          load_ms: Math.round(navigationEntry.loadEventEnd || 0),
          transfer_size: Math.round(navigationEntry.transferSize || 0)
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    if (document.readyState === 'complete') {
      trackInitialTiming();
    } else {
      window.addEventListener('load', trackInitialTiming, { once: true });
    }

    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('load', trackInitialTiming);
    };
  }, [routeKey]);

  return null;
};

export default AnalyticsTracker;
