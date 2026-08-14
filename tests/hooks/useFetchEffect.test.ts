import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFetchEffect } from '../../src/features/shared/hooks/useFetchEffect';
import type { IsStale } from '../../src/features/shared/hooks/useFetchEffect';

describe('useFetchEffect', () => {
  it('fetches once on mount', async () => {
    const fetch = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useFetchEffect(fetch));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it('re-fetches when the callback identity changes (e.g. a filter)', async () => {
    const fetchA = vi.fn().mockResolvedValue(undefined);
    const fetchB = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ fetch }) => useFetchEffect(fetch), {
      initialProps: { fetch: fetchA },
    });
    await waitFor(() => expect(fetchA).toHaveBeenCalledTimes(1));

    rerender({ fetch: fetchB });
    await waitFor(() => expect(fetchB).toHaveBeenCalledTimes(1));
    expect(fetchA).toHaveBeenCalledTimes(1);
  });

  it('stale-response guard: a slow first request resolving after a fast second one does not overwrite it', async () => {
    // Simulates changing a filter twice in quick succession: the first
    // (now-superseded) request is slow, the second is fast and resolves
    // first. Without the guard, the slow first response would still commit
    // when it eventually finished, clobbering the fast second one — exactly
    // the bug this hook exists to close.
    const committed: string[] = [];

    let resolveFirst!: () => void;
    const firstRequest = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    const fetchFirst = vi.fn(async (isStale: IsStale) => {
      await firstRequest; // held open until the test lets it proceed
      if (!isStale()) {
        committed.push('first');
      }
    });
    const fetchSecond = vi.fn(async (isStale: IsStale) => {
      if (!isStale()) {
        committed.push('second');
      }
    });

    const { rerender } = renderHook(({ fn }) => useFetchEffect(fn), {
      initialProps: { fn: fetchFirst },
    });
    await waitFor(() => expect(fetchFirst).toHaveBeenCalledTimes(1));

    // A new callback identity is exactly how a real hook re-invokes this
    // effect when a filter/page changes — the second (fast) request starts
    // and resolves while the first is still pending.
    rerender({ fn: fetchSecond });
    await waitFor(() => expect(committed).toEqual(['second']));

    // Now let the slow first request's continuation run — it must observe
    // itself as stale and drop its write.
    resolveFirst();
    await fetchFirst.mock.results[0].value;

    expect(committed).toEqual(['second']);
  });

  it('a lone in-flight fetch observes itself as current, not stale', async () => {
    const seen: boolean[] = [];
    const fetch = vi.fn(async (isStale: IsStale) => {
      await Promise.resolve();
      seen.push(isStale());
    });

    renderHook(() => useFetchEffect(fetch));

    await waitFor(() => expect(seen).toEqual([false]));
  });
});
