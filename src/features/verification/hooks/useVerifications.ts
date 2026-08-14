import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { extractApiError } from '../../../services/apiError';
import { verificationsApi } from '../api/verificationsApi';
import type {
  ApproveVerificationResponse,
  PendingVerification,
  RejectVerificationResponse,
  VerificationDocument,
} from '../api/verificationsApi';

export interface VerificationRequest {
  userId: number;
  name: string;
  email: string;
  gender: string | null;
  address: string | null;
  photo: string | null;
  type: 'driver' | 'passenger';
  documents: VerificationDocument[];
  submittedAt: string;
  submittedLabel: string;
}

export type VerificationTypeFilter = 'all' | 'driver' | 'passenger';

interface UseVerificationsReturn {
  requests: VerificationRequest[];
  visibleRequests: VerificationRequest[];
  /** Server-provided queue size, not `requests.length`. */
  total: number | null;
  isLoading: boolean;
  error: string | null;
  updatedAt: Date | null;
  selectedRequest: VerificationRequest | null;
  setSelectedRequest: (request: VerificationRequest | null) => void;
  typeFilter: VerificationTypeFilter;
  setTypeFilter: (filter: VerificationTypeFilter) => void;
  driverCount: number;
  passengerCount: number;
  approveRequest: (
    request: VerificationRequest,
    nationalId: string
  ) => Promise<ApproveVerificationResponse>;
  rejectRequest: (
    request: VerificationRequest,
    reason?: string
  ) => Promise<RejectVerificationResponse>;
  refresh: () => Promise<void>;
}

const mapRequest = (
  item: PendingVerification,
  t: TFunction,
  language: string
): VerificationRequest => ({
  userId: item.user_id,
  name: item.name?.trim() || t('common.unknown'),
  email: item.email || '',
  gender: item.gender ?? null,
  address: item.address ?? null,
  photo: item.profile_photo ?? null,
  type: item.type,
  documents: item.documents || [],
  submittedAt: item.submitted_at,
  submittedLabel: item.submitted_at
    ? new Date(item.submitted_at).toLocaleDateString(language)
    : '',
});

export const useVerifications = (): UseVerificationsReturn => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [typeFilter, setTypeFilter] = useState<VerificationTypeFilter>('all');

  /**
   * `silent` skips the loading flag so the post-mutation reconcile does not
   * blank the list that was just optimistically updated.
   */
  const load = useCallback(
    async (silent: boolean, isStale: IsStale) => {
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const response = await verificationsApi.listPendingVerifications();
        if (isStale()) {
          return;
        }
        const mapped = (response.data || []).map((item) => mapRequest(item, t, language));
        setRequests(mapped);
        // The server's own count, not mapped.length — the two are asserted equal
        // by the verification script rather than assumed here.
        setTotal(typeof response.total === 'number' ? response.total : mapped.length);
        setUpdatedAt(new Date());
        setSelectedRequest((prev) => {
          if (prev) {
            return mapped.find((r) => r.userId === prev.userId) ?? mapped[0] ?? null;
          }
          return mapped[0] ?? null;
        });
      } catch (err) {
        if (isStale()) {
          return;
        }
        setError(extractApiError(err, t('verifications.load_failed')));
      } finally {
        if (!silent && !isStale()) {
          setIsLoading(false);
        }
      }
    },
    [t, language]
  );

  const fetchRequests = useCallback((isStale: IsStale) => load(false, isStale), [load]);

  useFetchEffect(fetchRequests);
  // Not part of the effect's sequence — a Retry button's click should always commit.
  const refresh = useCallback(() => load(false, () => false), [load]);

  /**
   * Client-side filter, and deliberately so: `GET /staff/verifications/pending`
   * accepts **no** query parameters and returns the entire queue unpaginated,
   * so this is the only place a type filter can exist. It is not the
   * `visibleTrips`/`visibleDrivers`/`visibleComplaints` bug class removed in
   * Phases 3–5: those re-filtered an already server-filtered page on a derived
   * UI status, blanking rows the server had deliberately returned. Here the
   * predicate compares against `type` exactly as the server emitted it, over
   * the complete set.
   */
  const visibleRequests = useMemo(() => {
    if (typeFilter === 'all') {
      return requests;
    }
    return requests.filter((request) => request.type === typeFilter);
  }, [requests, typeFilter]);

  // Exact, not an estimate: the payload is the whole queue in one response, so
  // counting it client-side is the same number the server would report.
  const driverCount = useMemo(
    () => requests.filter((request) => request.type === 'driver').length,
    [requests]
  );
  const passengerCount = useMemo(
    () => requests.filter((request) => request.type === 'passenger').length,
    [requests]
  );

  const removeLocally = useCallback((userId: number) => {
    setRequests((prev) => {
      const next = prev.filter((request) => request.userId !== userId);
      setSelectedRequest((selected) =>
        selected?.userId === userId ? next[0] ?? null : selected
      );
      return next;
    });
    setTotal((prev) => (prev === null ? prev : Math.max(0, prev - 1)));
  }, []);

  /**
   * Both mutations follow the same shape: await the API (so a 422 — a duplicate
   * national ID, a request that is no longer pending — leaves the row where it
   * is), drop the row locally for an immediate response, then re-read the list
   * to reconcile. The reconcile is safe against the endpoint's 2-minute cache
   * because approve and reject both bust `staff.pending-verifications`.
   */
  const approveRequest = useCallback(
    async (request: VerificationRequest, nationalId: string) => {
      const response = await verificationsApi.approveVerification(request.userId, nationalId);
      removeLocally(request.userId);
      await load(true, () => false);
      return response;
    },
    [removeLocally, load]
  );

  const rejectRequest = useCallback(
    async (request: VerificationRequest, reason?: string) => {
      const response = await verificationsApi.rejectVerification(request.userId, reason);
      removeLocally(request.userId);
      await load(true, () => false);
      return response;
    },
    [removeLocally, load]
  );

  return {
    requests,
    visibleRequests,
    total,
    isLoading,
    error,
    updatedAt,
    selectedRequest,
    setSelectedRequest,
    typeFilter,
    setTypeFilter,
    driverCount,
    passengerCount,
    approveRequest,
    rejectRequest,
    refresh,
  };
};
