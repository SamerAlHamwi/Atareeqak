import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import PageLoader from '../features/shared/components/PageLoader';

type Status = 'checking' | 'ok' | 'unconfigured';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

/**
 * A one-time boot check, not a network monitor.
 *
 * `vercel.json`'s `/api` rewrite pointed at a dead host for the entire life
 * of this project (docs/api/probe-results.md) and it shipped silently —
 * every page just fired its own request, failed on its own, and showed its
 * own `ErrorBanner`. That reads as "the app is broken", not "no backend is
 * configured for this deployment", and it took a live probe to even notice.
 *
 * This calls the one unauthenticated, always-public health route
 * (`GET /test`, confirmed live — see docs/api/local-backend.md) once on load,
 * and only overrides the app for a true network-level failure (no HTTP
 * response reached the browser at all — DNS failure, connection refused, or
 * an unset `$API_PROXY_TARGET` leaving the rewrite destination broken).
 * Anything that reaches a real server, even an error status, is left to the
 * normal per-page error handling — this guard's only job is the silent,
 * total-absence case a wall of individual ErrorBanners hides.
 */
const ApiConfigGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>('checking');
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API_BASE}/test`, { timeout: 5000 })
      .then(() => {
        if (!cancelled) {
          setStatus('ok');
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const isNetworkLevelFailure = axios.isAxiosError(error) && !error.response;
        setStatus(isNetworkLevelFailure ? 'unconfigured' : 'ok');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'checking') {
    return <PageLoader size="lg" fullScreen className="bg-surface" />;
  }

  if (status === 'unconfigured') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-surface text-center p-6">
        <span className="material-symbols-outlined text-5xl text-error">cloud_off</span>
        <h1 className="text-2xl font-extrabold font-headline text-primary">
          {t('common.api_unconfigured_title')}
        </h1>
        <p className="text-on-surface-variant max-w-md text-sm">
          {t('common.api_unconfigured_hint')}
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export default ApiConfigGuard;
