import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { extractApiError } from '../../../services/apiError';
import {
  supportApi,
  COMPLAINT_INDEX_STATUSES,
  ESCALATED_STATUSES,
} from '../api/supportApi';
import type {
  ComplaintAttachmentResponse,
  ComplaintCounts,
  ComplaintDateFilter,
  ComplaintIndexStatus,
  ComplaintResponse,
  ComplaintStatusValue,
  ComplaintType,
  EscalatedCounts,
  EscalatedResolveStatus,
  EscalatedStatus,
  RespondStatus,
} from '../api/supportApi';

export interface Complaint {
  id: string;
  rawId: number;
  user: string;
  userEmail: string;
  /** The complaint payload carries no photo; the initials <Avatar> renders instead. */
  userPhoto: null;
  /** Raw enum value, for the client-side type translation. */
  type: ComplaintType | null;
  /** Translated in the ACTIVE language — never the API's Arabic-only `type_label`. */
  category: string;
  title: string;
  date: string;
  status: ComplaintStatusValue;
  content: string;
  resolutionNotes: string | null;
  assignedTo: string | null;
  assignedToId: number | null;
  attachments: ComplaintAttachmentResponse[];
}

/** Inbox tabs. `escalated` is absent on purpose — `index` 422s on it. */
export type InboxStatusFilter = 'all' | ComplaintIndexStatus;
export type SupportView = 'inbox' | 'escalated';
export type StatusFilter = InboxStatusFilter | EscalatedStatus;
export type TypeFilter = 'all' | ComplaintType;
export type DateFilter = 'all' | ComplaintDateFilter;

export const SUPPORT_PER_PAGE_OPTIONS = [5, 10, 25, 50] as const;

/**
 * `resolved` and `closed` are valid in BOTH vocabularies, so membership tests
 * must be per-endpoint whitelists rather than "is it an escalated-ish word".
 * An earlier cut of this guard treated `resolved` as escalated-only and silently
 * dropped it from the inbox request, turning the Resolved tab into an unfiltered
 * list — a unit test caught it.
 */
const isIndexStatus = (value: StatusFilter): value is ComplaintIndexStatus =>
  (COMPLAINT_INDEX_STATUSES as readonly string[]).includes(value);

const isEscalatedStatus = (value: StatusFilter): value is EscalatedStatus =>
  (ESCALATED_STATUSES as readonly string[]).includes(value);

const mapComplaint = (c: ComplaintResponse, t: TFunction, language: string): Complaint => ({
  id: `#CMP-${c.id}`,
  rawId: c.id,
  user: c.user?.name?.trim() || t('common.unknown_user'),
  userEmail: c.user?.email || '',
  userPhoto: null,
  type: (c.type as ComplaintType | null) ?? null,
  // `c.type_label` is Arabic-only from ComplaintType::label(); translating the
  // code ourselves is the only way the English UI reads as English.
  category: c.type ? t(`support.type.${c.type}`) : c.title || t('common.general_complaint'),
  title: c.title || '',
  date: c.created_at ? new Date(c.created_at).toLocaleDateString(language) : '',
  status: c.status,
  content: c.description || c.title || '',
  resolutionNotes: c.resolution_notes,
  assignedTo: c.assigned_to?.name ?? null,
  assignedToId: c.assigned_to?.id ?? null,
  attachments: c.attachments ?? [],
});

export interface OpenComplaintResult {
  complaint: Complaint;
  /** True when `show()` actually mutated the row (pending → in_review + assigned). */
  wasAssignedToMe: boolean;
}

interface UseSupportOptions {
  /**
   * Whether this employee may call `/staff/escalated-complaints` at all — that
   * route is `staff:admin,system_admin`, so a `support_agent` would get a hard
   * 403. When false the escalated counts are never fetched and stay null, and
   * the KPI row renders three cards instead of inventing a fourth.
   */
  canSeeEscalated?: boolean;
}

export const useSupport = ({ canSeeEscalated = false }: UseSupportOptions = {}) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [counts, setCounts] = useState<ComplaintCounts | null>(null);
  const [escalatedCounts, setEscalatedCounts] = useState<EscalatedCounts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [view, setViewState] = useState<SupportView>('inbox');
  const [statusFilter, setStatusFilterState] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilterState] = useState<TypeFilter>('all');
  const [dateFilter, setDateFilterState] = useState<DateFilter>('all');
  const [perPage, setPerPageState] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  /**
   * Switching views swaps the whole status vocabulary (`pending|in_review|…`
   * vs `escalated|resolved|closed`), so the filter is reset rather than carried
   * across — carrying `pending` into the escalated view would 422, and carrying
   * `escalated` into the inbox is the exact combination this phase must prevent.
   */
  const setView = useCallback((next: SupportView) => {
    setViewState(next);
    setStatusFilterState(next === 'escalated' ? 'escalated' : 'all');
    setTypeFilterState('all');
    setDateFilterState('all');
    setSelectedComplaint(null);
    setPage(1);
  }, []);

  // Every filter resets to page 1 — otherwise a narrower filter lands the user
  // on a page that no longer exists and renders an empty table.
  const setStatusFilter = useCallback((next: StatusFilter) => {
    setStatusFilterState(next);
    setPage(1);
  }, []);
  const setTypeFilter = useCallback((next: TypeFilter) => {
    setTypeFilterState(next);
    setPage(1);
  }, []);
  const setDateFilter = useCallback((next: DateFilter) => {
    setDateFilterState(next);
    setPage(1);
  }, []);
  const setPerPage = useCallback((next: number) => {
    setPerPageState(next);
    setPage(1);
  }, []);

  /**
   * `silent` skips the loading flag, so refetching purely to refresh `counts`
   * after `show()` does not blank the table the user is looking at.
   */
  const load = useCallback(
    async (silent: boolean, isStale: IsStale) => {
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const shared = {
          page,
          per_page: perPage,
          ...(typeFilter === 'all' ? {} : { type: typeFilter }),
          ...(dateFilter === 'all' ? {} : { date: dateFilter }),
        };

        let mapped: Complaint[];
        let meta;
        let nextCounts: ComplaintCounts | null | undefined;
        let nextEscalatedCounts: EscalatedCounts | null | undefined;

        if (view === 'escalated') {
          // Guard: only the escalated vocabulary can reach this endpoint.
          const status = isEscalatedStatus(statusFilter) ? statusFilter : 'escalated';
          const response = await supportApi.getEscalatedComplaints({ ...shared, status });
          mapped = (response.data || []).map((c) => mapComplaint(c, t, language));
          nextEscalatedCounts = response.counts ?? null;
          meta = response.meta;
        } else {
          /**
           * THE GUARD. `status=escalated` is not accepted by `index` and returns
           * 422. It cannot be selected in the inbox UI, and this whitelist makes
           * the request unrepresentable even if a caller forces the state —
           * hide-not-422, the Phase 3 convention. Anything not in the index
           * vocabulary (including `escalated`) is sent as no `status` at all.
           */
          const status = isIndexStatus(statusFilter) ? statusFilter : undefined;
          const response = await supportApi.getComplaints({
            ...shared,
            ...(status ? { status } : {}),
          });
          mapped = (response.data || []).map((c) => mapComplaint(c, t, language));
          nextCounts = response.counts ?? null;
          meta = response.meta;
        }

        if (isStale()) {
          return;
        }
        if (nextEscalatedCounts !== undefined) {
          setEscalatedCounts(nextEscalatedCounts);
        }
        if (nextCounts !== undefined) {
          setCounts(nextCounts);
        }
        setLastPage(meta?.last_page ?? 1);
        setTotal(meta?.total ?? mapped.length);
        setComplaints(mapped);
        // Keep the open detail panel pointed at the same complaint across a
        // refetch; fall back to the first row only when it has genuinely gone.
        setSelectedComplaint((prev) =>
          prev ? mapped.find((c) => c.rawId === prev.rawId) ?? null : null
        );
      } catch (err) {
        if (isStale()) {
          return;
        }
        setError(extractApiError(err, t('support.load_failed')));
      } finally {
        if (!silent && !isStale()) {
          setIsLoading(false);
        }
      }
    },
    [view, statusFilter, typeFilter, dateFilter, page, perPage, t, language]
  );

  const fetchComplaints = useCallback((isStale: IsStale) => load(false, isStale), [load]);

  useFetchEffect(fetchComplaints);
  // Not part of the effect's sequence — a Retry button's click should always commit.
  const refetch = useCallback(() => load(false, () => false), [load]);

  /**
   * The escalated counts feed a KPI card that is visible from the INBOX, so they
   * cannot come from the escalated list request — that only fires once the user
   * switches views. This reads the counts block on its own with the smallest
   * legal page (`per_page=1`), since the rows are not needed here.
   *
   * Skipped entirely when the role cannot call the endpoint, so no 403 is ever
   * provoked just to draw a card.
   */
  const loadEscalatedCounts = useCallback(async (isStale: IsStale = () => false) => {
    if (!canSeeEscalated) return;
    try {
      const response = await supportApi.getEscalatedComplaints({ per_page: 1, status: 'escalated' });
      if (isStale()) return;
      setEscalatedCounts(response.counts ?? null);
    } catch {
      // Non-blocking: the escalated KPI card is simply withheld rather than
      // taking the whole page down over a secondary figure.
      if (!isStale()) setEscalatedCounts(null);
    }
  }, [canSeeEscalated]);

  useFetchEffect(loadEscalatedCounts);

  const applyUpdatedComplaint = useCallback(
    (updated: ComplaintResponse) => {
      const mapped = mapComplaint(updated, t, language);
      setComplaints((prev) => prev.map((e) => (e.rawId === mapped.rawId ? mapped : e)));
      setSelectedComplaint((prev) => (prev && prev.rawId === mapped.rawId ? mapped : prev));
      return mapped;
    },
    [t, language]
  );

  /**
   * Opening a complaint is a WRITE, not a read — see `supportApi.getComplaint`.
   * A `pending`, unassigned row comes back `in_review` and assigned to the
   * caller, which shifts two badge counts. So: apply the server's row, and when
   * it actually moved, silently refetch so `counts` stops describing a state
   * that no longer exists. The caller is told, so the reassignment is visible
   * rather than something the user discovers later.
   */
  const openComplaint = useCallback(
    async (complaint: Complaint): Promise<OpenComplaintResult> => {
      setSelectedComplaint(complaint);
      const response = await supportApi.getComplaint(complaint.rawId);
      const mapped = applyUpdatedComplaint(response.data);

      const wasAssignedToMe =
        complaint.status === 'pending' && mapped.status === 'in_review' && !!mapped.assignedTo;

      if (wasAssignedToMe) {
        await load(true, () => false);
        // Re-assert AFTER the reconcile. `load()` rebuilds the selection from
        // the list rows, and the list is served from a 1-minute cache the open
        // only just busted — the `show()` response is the fresher, authoritative
        // row (it alone carries the new assignee), so it wins.
        applyUpdatedComplaint(response.data);
      }
      return { complaint: mapped, wasAssignedToMe };
    },
    [applyUpdatedComplaint, load]
  );

  /**
   * Every mutation follows the same shape: await the API (so a 422 — responding
   * to an escalated complaint, escalating a closed one — leaves the row exactly
   * as it was), apply the server's returned row, then reconcile the list so the
   * badges stop describing a state that no longer exists. All three endpoints
   * bust their own counts cache server-side, so the reconcile reads fresh.
   *
   * The returned row is re-applied AFTER the reconcile: it is the freshest
   * authority for the complaint that was acted on. When the action removes the
   * row from the current view (escalating out of the inbox), the re-apply is a
   * no-op — it only ever updates entries that are still present.
   */
  const runMutation = useCallback(
    async (mutate: () => Promise<{ data: ComplaintResponse }>) => {
      const response = await mutate();
      applyUpdatedComplaint(response.data);
      // Both blocks move: escalate/respond bust `staff.complaint-counts`, and
      // escalate/resolveEscalated change the escalated tally the KPI card shows.
      await Promise.all([load(true, () => false), loadEscalatedCounts()]);
      applyUpdatedComplaint(response.data);
    },
    [applyUpdatedComplaint, load, loadEscalatedCounts]
  );

  const respondToComplaint = useCallback(
    (complaint: Complaint, notes: string, status: RespondStatus) =>
      runMutation(() => supportApi.respondComplaint(complaint.rawId, notes, status)),
    [runMutation]
  );

  const escalateComplaint = useCallback(
    (complaint: Complaint, reason: string) =>
      runMutation(() => supportApi.escalateComplaint(complaint.rawId, reason)),
    [runMutation]
  );

  const resolveEscalatedComplaint = useCallback(
    (complaint: Complaint, notes: string, status: EscalatedResolveStatus) =>
      runMutation(() => supportApi.resolveEscalatedComplaint(complaint.rawId, notes, status)),
    [runMutation]
  );

  /**
   * The honest "all" badge. `counts.all` includes `escalated` rows that `index`
   * hard-excludes, so it overstates the list by the escalated count (12 vs 10 on
   * the live seed — BUG-9). The four status buckets sum to exactly what the
   * unfiltered list returns, so that sum is what the tab shows.
   */
  const inboxTotal = useMemo(
    () =>
      counts ? counts.pending + counts.in_review + counts.resolved + counts.closed : null,
    [counts]
  );

  return {
    complaints,
    counts,
    escalatedCounts,
    inboxTotal,
    isLoading,
    error,
    selectedComplaint,
    setSelectedComplaint,
    openComplaint,
    view,
    setView,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    dateFilter,
    setDateFilter,
    perPage,
    setPerPage,
    page,
    setPage,
    lastPage,
    total,
    refetch,
    respondToComplaint,
    escalateComplaint,
    resolveEscalatedComplaint,
  };
};
