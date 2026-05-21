import { useState, useEffect, useMemo, useCallback } from 'react';
import { supportApi } from '../api/supportApi';

export interface Complaint {
  id: string;
  user: string;
  userType: 'driver' | 'passenger';
  userAvatar: string;
  category: string;
  date: string;
  status: 'pending' | 'processing' | 'resolved';
  content: string;
  tripId: string;
  location: string;
  userRating: string;
}

export type StatusFilter = 'all' | Complaint['status'];

export const useSupport = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [replyText, setReplyText] = useState('');

  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await supportApi.getComplaints();
      const data = response.data || [];
      const mappedComplaints: Complaint[] = data.map((c: any) => ({
        id: `#CMP-${c.id}`,
        user: c.user?.name || 'مستخدم غير معروف',
        userType: c.user?.type || 'passenger',
        userAvatar: c.user?.profile_photo || `https://i.pravatar.cc/100?u=${c.user?.id || Math.random()}`,
        category: c.subject || c.category || 'شكوى عامة',
        date: c.created_at || 'Recently',
        status: (c.status as Complaint['status']) || 'pending',
        content: c.description || c.content || '',
        tripId: c.ride_id ? `TRIP-${c.ride_id}` : 'N/A',
        location: c.location || 'غير محدد',
        userRating: c.user?.rating || 'N/A',
      }));
      setComplaints(mappedComplaints);
      if (mappedComplaints.length > 0 && !selectedComplaint) {
        setSelectedComplaint(mappedComplaints[0]);
      }
    } catch (err) {
      console.error('Failed to load complaints', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedComplaint]);

  useEffect(() => {
    void fetchComplaints();
  }, [fetchComplaints]);

  const visibleComplaints = useMemo(() => {
    if (statusFilter === 'all') {
      return complaints;
    }
    return complaints.filter((item) => item.status === statusFilter);
  }, [complaints, statusFilter]);

  const markComplaintAsProcessing = useCallback((complaintId: string) => {
    setComplaints((prev) =>
      prev.map((entry) => (entry.id === complaintId ? { ...entry, status: 'processing' } : entry))
    );
    setSelectedComplaint((prev) =>
      prev && prev.id === complaintId ? { ...prev, status: 'processing' } : prev
    );
  }, []);

  return {
    complaints,
    isLoading,
    selectedComplaint,
    setSelectedComplaint,
    statusFilter,
    setStatusFilter,
    replyText,
    setReplyText,
    visibleComplaints,
    markComplaintAsProcessing,
  };
};
