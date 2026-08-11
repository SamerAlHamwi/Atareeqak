import { useEffect } from 'react';

/**
 * Runs an async fetch callback on mount and whenever its identity changes
 * (e.g. a filter or page captured by the caller's useCallback), optionally
 * re-polling on an interval.
 *
 * Feature hooks flip their loading state synchronously at the start of the
 * fetch by design (the standard fetch-on-render data flow), which the
 * react-hooks/set-state-in-effect rule would flag at every call site; the
 * effect lives here once so that intent is documented in a single place.
 *
 * Polling pauses while the document is hidden — a background tab has nobody
 * watching it, so the requests are pure load on the API — and fires once
 * immediately when the tab becomes visible again so the view is never stale
 * by more than a round-trip after the user returns.
 */
export function useFetchEffect(fetch: () => Promise<void>, pollIntervalMs?: number): void {
  useEffect(() => {
    void fetch();
    if (pollIntervalMs === undefined) {
      return;
    }

    // `document` is absent under SSR/non-DOM test envs; treat that as "visible".
    const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

    let interval: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (interval === undefined) {
        interval = setInterval(() => void fetch(), pollIntervalMs);
      }
    };
    const stop = () => {
      if (interval !== undefined) {
        clearInterval(interval);
        interval = undefined;
      }
    };

    const handleVisibilityChange = () => {
      if (isHidden()) {
        stop();
      } else {
        void fetch();
        start();
      }
    };

    if (!isHidden()) {
      start();
    }
    document?.addEventListener?.('visibilitychange', handleVisibilityChange);

    return () => {
      stop();
      document?.removeEventListener?.('visibilitychange', handleVisibilityChange);
    };
  }, [fetch, pollIntervalMs]);
}
