import { useState, useEffect, useMemo, useCallback } from 'react';
import { supportApi } from '../api/supportApi';
import type { ComplaintResponse, ComplaintCounts, RespondStatus } from '../api/supportApi';

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

const mapComplaint = (c: ComplaintResponse): Complaint => ({
  id: `#CMP-${c.id}`,
  rawId: c.id,
  user: c.user?.name || 'مستخدم غير معروف',
  userEmail: c.user?.email || '',
  userAvatar: `https://i.pravatar.cc/100?u=${c.user?.id ?? c.id}`,
  category: c.type_label || c.title || 'شكوى عامة',
  date: c.created_at ? new Date(c.created_at).toLocaleDateString('ar-SY') : '',
  status: c.status,
  content: c.description || c.title || '',
  resolutionNotes: c.resolution_notes,
  assignedTo: c.assigned_to?.name ?? null,
});

export const useSupport = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [counts, setCounts] = useState<ComplaintCounts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [replyText, setReplyText] = useState('');

  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await supportApi.getComplaints(
        statusFilter === 'all' ? {} : { status: statusFilter }
      );
      const mappedComplaints = (response.data || []).map(mapComplaint);
      setComplaints(mappedComplaints);
      setCounts(response.counts ?? null);
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
  }, [statusFilter]);

  useEffect(() => {
    void fetchComplaints();
  }, [fetchComplaints]);

  const visibleComplaints = useMemo(() => {
    if (statusFilter === 'all') {
      return complaints;
    }
    return complaints.filter((item) => item.status === statusFilter);
  }, [complaints, statusFilter]);

  const applyUpdatedComplaint = useCallback((updated: ComplaintResponse) => {
    const mapped = mapComplaint(updated);
    setComplaints((prev) => prev.map((entry) => (entry.rawId === mapped.rawId ? mapped : entry)));
    setSelectedComplaint((prev) => (prev && prev.rawId === mapped.rawId ? mapped : prev));
  }, []);

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

  return {
    complaints,
    counts,
    isLoading,
    error,
    selectedComplaint,
    setSelectedComplaint,
    statusFilter,
    setStatusFilter,
    replyText,
    setReplyText,
    visibleComplaints,
    respondToComplaint,
    escalateComplaint,
  };
};
