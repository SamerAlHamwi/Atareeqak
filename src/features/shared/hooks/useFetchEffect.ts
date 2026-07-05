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
 */
export function useFetchEffect(fetch: () => Promise<void>, pollIntervalMs?: number): void {
  useEffect(() => {
    void fetch();
    if (pollIntervalMs === undefined) {
      return;
    }
    const interval = setInterval(() => void fetch(), pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetch, pollIntervalMs]);
}
