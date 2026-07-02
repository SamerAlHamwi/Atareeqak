import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export interface ComplaintUserResponse {
  id: number | null;
  name: string;
  email: string | null;
}

export interface ComplaintResponse {
  id: number;
  title: string | null;
  description: string | null;
  type: string | null;
  type_label: string | null;
  status: 'pending' | 'in_review' | 'resolved' | 'closed' | 'escalated';
  status_label: string;
  status_color: string;
  is_escalated: boolean;
  resolution_notes: string | null;
  resolved_at: string | null;
  assigned_to: { id: number; name: string; role: string } | null;
  user: ComplaintUserResponse;
  attachments: { id: number; url: string; original_name: string; mime_type: string }[] | null;
  created_at: string;
  updated_at: string;
}

export interface ComplaintCounts {
  all: number;
  pending: number;
  in_review: number;
  resolved: number;
  closed: number;
}

export interface ComplaintsListResponse {
  status: string;
  data: ComplaintResponse[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  counts: ComplaintCounts;
}

export interface EscalatedCounts {
  escalated: number;
  resolved: number;
  closed: number;
}

export interface EscalatedComplaintsResponse {
  status: string;
  data: ComplaintResponse[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  counts: EscalatedCounts;
}

export type RespondStatus = 'in_review' | 'resolved' | 'closed';
export type EscalatedResolveStatus = 'resolved' | 'closed';

export const supportApi = {
  getComplaints: async (
    params: { status?: string; type?: string; page?: number; per_page?: number } = {}
  ): Promise<ComplaintsListResponse> => {
    const response = await api.get(ENDPOINTS.STAFF.COMPLAINTS, { params });
    return response.data;
  },
  getComplaint: async (id: string | number): Promise<{ status: string; data: ComplaintResponse }> => {
    const response = await api.get(ENDPOINTS.STAFF.COMPLAINT(id));
    return response.data;
  },
  respondComplaint: async (
    id: string | number,
    resolutionNotes: string,
    status: RespondStatus
  ): Promise<{ status: string; message: string; data: ComplaintResponse }> => {
    // Backend expects resolution_notes (min 10 chars) + target status
    const response = await api.patch(ENDPOINTS.STAFF.RESPOND_COMPLAINT(id), {
      resolution_notes: resolutionNotes,
      status,
    });
    return response.data;
  },
  escalateComplaint: async (
    id: string | number,
    reason: string
  ): Promise<{ status: string; message: string; data: ComplaintResponse }> => {
    // Backend expects a reason (min 10 chars)
    const response = await api.patch(ENDPOINTS.STAFF.ESCALATE_COMPLAINT(id), { reason });
    return response.data;
  },
  getEscalatedComplaints: async (
    params: { status?: string; type?: string; page?: number; per_page?: number } = {}
  ): Promise<EscalatedComplaintsResponse> => {
    const response = await api.get(ENDPOINTS.STAFF.ESCALATED_COMPLAINTS, { params });
    return response.data;
  },
  resolveEscalatedComplaint: async (
    id: string | number,
    resolutionNotes: string,
    status: EscalatedResolveStatus = 'resolved'
  ): Promise<{ status: string; message: string; data: ComplaintResponse }> => {
    const response = await api.patch(ENDPOINTS.STAFF.RESOLVE_ESCALATED(id), {
      resolution_notes: resolutionNotes,
      status,
    });
    return response.data;
  },
};
