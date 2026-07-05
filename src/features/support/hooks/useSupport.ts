import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import { supportApi } from '../api/supportApi';
import type {
  ComplaintResponse,
  ComplaintCounts,
  EscalatedCounts,
  RespondStatus,
  EscalatedResolveStatus,
} from '../api/supportApi';

export interface Complaint {
  id: string;
  rawId: number;
  user: string;
  userEmail: string;
  userAvatar: string;
  category: string;
  date: string;
  status: 'pending' | 'in_review' | 'resolved' | 'closed' | 'escalated';
  content: string;
  resolutionNotes: string | null;
  assignedTo: string | null;
}

export type StatusFilter = 'all' | Complaint['status'];
export type SupportView = 'inbox' | 'escalated';

const mapComplaint = (c: ComplaintResponse, t: TFunction): Complaint => ({
  id: `#CMP-${c.id}`,
  rawId: c.id,
  user: c.user?.name || t('common.unknown_user'),
  userEmail: c.user?.email || '',
  userAvatar: `https://i.pravatar.cc/100?u=${c.user?.id ?? c.id}`,
  category: c.type_label || c.title || t('common.general_complaint'),
  date: c.created_at ? new Date(c.created_at).toLocaleDateString('ar-SY') : '',
  status: c.status,
  content: c.description || c.title || '',
  resolutionNotes: c.resolution_notes,
  assignedTo: c.assigned_to?.name ?? null,
});

export const useSupport = () => {
  const { t } = useTranslation();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [counts, setCounts] = useState<ComplaintCounts | null>(null);
  const [escalatedCounts, setEscalatedCounts] = useState<EscalatedCounts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [statusFilter, setStatusFilterState] = useState<StatusFilter>('all');
  const [view, setViewState] = useState<SupportView>('inbox');
  const [replyText, setReplyText] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const setView = useCallback((next: SupportView) => {
    setViewState(next);
    setStatusFilterState('all');
    setSelectedComplaint(null);
    setReplyText('');
    setPage(1);
  }, []);

  const setStatusFilter = useCallback((next: StatusFilter) => {
    setStatusFilterState(next);
    setPage(1);
  }, []);

  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page,
        ...(statusFilter === 'all' ? {} : { status: statusFilter }),
      };
      let mappedComplaints: Complaint[];
      let meta: { current_page: number; last_page: number; per_page: number; total: number } | undefined;
      if (view === 'escalated') {
        const response = await supportApi.getEscalatedComplaints(params);
        mappedComplaints = (response.data || []).map((c) => mapComplaint(c, t));
        setEscalatedCounts(response.counts ?? null);
        meta = response.meta;
      } else {
        const response = await supportApi.getComplaints(params);
        mappedComplaints = (response.data || []).map((c) => mapComplaint(c, t));
        setCounts(response.counts ?? null);
        meta = response.meta;
      }
      setLastPage(meta?.last_page ?? 1);
      setTotal(meta?.total ?? mappedComplaints.length);
      setComplaints(mappedComplaints);
      setSelectedComplaint((prev) => {
        if (prev) {
          return mappedComplaints.find((c) => c.id === prev.id) ?? mappedComplaints[0] ?? null;
        }
        return mappedComplaints[0] ?? null;
      });
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to load complaints');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, view, page, t]);

  useFetchEffect(fetchComplaints);

  const visibleComplaints = useMemo(() => {
    if (statusFilter === 'all') {
      return complaints;
    }
    return complaints.filter((item) => item.status === statusFilter);
  }, [complaints, statusFilter]);

  const applyUpdatedComplaint = useCallback((updated: ComplaintResponse) => {
    const mapped = mapComplaint(updated, t);
    setComplaints((prev) => prev.map((entry) => (entry.rawId === mapped.rawId ? mapped : entry)));
    setSelectedComplaint((prev) => (prev && prev.rawId === mapped.rawId ? mapped : prev));
  }, [t]);

  const respondToComplaint = useCallback(
    async (complaint: Complaint, notes: string, status: RespondStatus) => {
      const response = await supportApi.respondComplaint(complaint.rawId, notes, status);
      applyUpdatedComplaint(response.data);
    },
    [applyUpdatedComplaint]
  );

  const escalateComplaint = useCallback(
    async (complaint: Complaint, reason: string) => {
      const response = await supportApi.escalateComplaint(complaint.rawId, reason);
      applyUpdatedComplaint(response.data);
    },
    [applyUpdatedComplaint]
  );

  const resolveEscalatedComplaint = useCallback(
    async (complaint: Complaint, notes: string, status: EscalatedResolveStatus) => {
      const response = await supportApi.resolveEscalatedComplaint(complaint.rawId, notes, status);
      applyUpdatedComplaint(response.data);
      setEscalatedCounts((prev) =>
        prev
          ? {
              escalated: Math.max(0, prev.escalated - 1),
              resolved: status === 'resolved' ? prev.resolved + 1 : prev.resolved,
              closed: status === 'closed' ? prev.closed + 1 : prev.closed,
            }
          : prev
      );
    },
    [applyUpdatedComplaint]
  );

  return {
    complaints,
    counts,
    escalatedCounts,
    isLoading,
    error,
    selectedComplaint,
    setSelectedComplaint,
    statusFilter,
    setStatusFilter,
    view,
    setView,
    replyText,
    setReplyText,
    page,
    setPage,
    lastPage,
    total,
    visibleComplaints,
    refetch: fetchComplaints,
    respondToComplaint,
    escalateComplaint,
    resolveEscalatedComplaint,
  };
};
