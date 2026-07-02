import { useState, useEffect, useMemo, useCallback } from 'react';
import { verificationsApi } from '../api/verificationsApi';
import type { PendingVerification, VerificationDocument } from '../api/verificationsApi';

export interface VerificationRequest {
  userId: number;
  name: string;
  email: string;
  type: 'driver' | 'passenger';
  documents: VerificationDocument[];
  submittedAt: string;
  submittedDate: string;
}

export type VerificationTypeFilter = 'all' | 'driver' | 'passenger';

interface UseVerificationsReturn {
  requests: VerificationRequest[];
  visibleRequests: VerificationRequest[];
  isLoading: boolean;
  error: Error | null;
  selectedRequest: VerificationRequest | null;
  setSelectedRequest: (request: VerificationRequest | null) => void;
  typeFilter: VerificationTypeFilter;
  setTypeFilter: (filter: VerificationTypeFilter) => void;
  driverCount: number;
  passengerCount: number;
  approveRequest: (request: VerificationRequest) => Promise<void>;
  rejectRequest: (request: VerificationRequest) => Promise<void>;
  refresh: () => Promise<void>;
}

const mapRequest = (item: PendingVerification): VerificationRequest => ({
  userId: item.user_id,
  name: item.name || 'غير معروف',
  email: item.email || '',
  type: item.type,
  documents: item.documents || [],
  submittedAt: item.submitted_at,
  submittedDate: item.submitted_at ? new Date(item.submitted_at).toLocaleDateString('ar-SY') : '',
});

export const useVerifications = (): UseVerificationsReturn => {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [typeFilter, setTypeFilter] = useState<VerificationTypeFilter>('all');

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await verificationsApi.listPendingVerifications();
      const mapped = (response.data || []).map(mapRequest);
      setRequests(mapped);
      setSelectedRequest((prev) => {
        if (prev) {
          return mapped.find((r) => r.userId === prev.userId) ?? mapped[0] ?? null;
        }
        return mapped[0] ?? null;
      });
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to load verifications');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const visibleRequests = useMemo(() => {
    if (typeFilter === 'all') {
      return requests;
    }
    return requests.filter((request) => request.type === typeFilter);
  }, [requests, typeFilter]);

  const driverCount = useMemo(
    () => requests.filter((request) => request.type === 'driver').length,
    [requests]
  );
  const passengerCount = useMemo(
    () => requests.filter((request) => request.type === 'passenger').length,
    [requests]
  );

  const removeRequest = useCallback((userId: number) => {
    setRequests((prev) => {
      const next = prev.filter((request) => request.userId !== userId);
      setSelectedRequest((selected) =>
        selected?.userId === userId ? next[0] ?? null : selected
      );
      return next;
    });
  }, []);

  const approveRequest = useCallback(
    async (request: VerificationRequest) => {
      await verificationsApi.approveVerification(request.userId);
      removeRequest(request.userId);
    },
    [removeRequest]
  );

  const rejectRequest = useCallback(
    async (request: VerificationRequest) => {
      await verificationsApi.rejectVerification(request.userId);
      removeRequest(request.userId);
    },
    [removeRequest]
  );

  return {
    requests,
    visibleRequests,
    isLoading,
    error,
    selectedRequest,
    setSelectedRequest,
    typeFilter,
    setTypeFilter,
    driverCount,
    passengerCount,
    approveRequest,
    rejectRequest,
    refresh: fetchRequests,
  };
};
