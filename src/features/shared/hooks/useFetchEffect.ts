import { useEffect, useRef } from 'react';

/** Lets a fetch callback check, right before it commits state, whether a newer fetch has since started. */
export type IsStale = () => boolean;

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
 *
 * **Stale-response guard.** Every list page in the app is built on this hook,
 * fetches on every render whose `fetch` identity changed (a filter, a page, a
 * poll tick, a tab refocus), and nothing serialised those requests — change a
 * filter twice quickly and whichever response happened to resolve *last* won,
 * even if it was answering the *first*, now-superseded, request. `fetch`
 * receives an `isStale` callback: it is safe (returns `false`) until a later
 * invocation of `fetch` has started, and becomes permanently `true` the
 * instant one does. A hook calls it right before committing a response to
 * state and simply returns early if it is stale, so a slow first response
 * can never overwrite a fast second one.
 */
export function useFetchEffect(fetch: (isStale: IsStale) => Promise<void>, pollIntervalMs?: number): void {
  // A ref, not state: bumping it must never itself trigger a re-render, and it
  // has to survive across effect re-runs (a new filter) as well as within one
  // (a poll tick), which a value captured by the effect's closure could not.
  const sequenceRef = useRef(0);

  useEffect(() => {
    const runFetch = () => {
      sequenceRef.current += 1;
      const mine = sequenceRef.current;
      const isStale: IsStale = () => sequenceRef.current !== mine;
      void fetch(isStale);
    };

    runFetch();
    if (pollIntervalMs === undefined) {
      return;
    }

    // `document` is absent under SSR/non-DOM test envs; treat that as "visible".
    const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

    let interval: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (interval === undefined) {
        interval = setInterval(runFetch, pollIntervalMs);
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
        runFetch();
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
