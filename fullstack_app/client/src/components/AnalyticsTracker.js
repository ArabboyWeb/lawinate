import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../shared/analytics';

const AnalyticsTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith('/admin')) {
      return;
    }

    trackPageView({
      path: `${location.pathname}${location.search || ''}`
    });
  }, [location.pathname, location.search]);

  return null;
};

export default AnalyticsTracker;
