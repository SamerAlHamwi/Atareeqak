import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export interface ComplaintUserResponse {
  id: number | null;
  name: string;
  email: string | null;
}

export interface ComplaintAttachmentResponse {
  id: number;
  url: string;
  original_name: string;
  mime_type: string;
}

export interface ComplaintResponse {
  id: number;
  title: string | null;
  description: string | null;
  type: string | null;
  /**
   * Arabic-only, straight from `ComplaintType::label()` — rendering it leaks
   * Arabic into the English UI. `status_label` has the mirror-image problem
   * (English-only, from `ComplaintStatus::label()`). Both are ignored by the
   * hook, which translates the `type` / `status` CODES client-side instead.
   * Same call the Phase 4 drivers page made for `comparison.text`.
   */
  type_label: string | null;
  status: ComplaintStatusValue;
  status_label: string;
  status_color: string;
  is_escalated: boolean;
  resolution_notes: string | null;
  resolved_at: string | null;
  assigned_to: { id: number; name: string; role: string } | null;
  user: ComplaintUserResponse;
  attachments: ComplaintAttachmentResponse[] | null;
  created_at: string;
  updated_at: string;
}

export type ComplaintStatusValue = 'pending' | 'in_review' | 'resolved' | 'closed' | 'escalated';

/**
 * The eight `ComplaintType` enum cases, in the order `StaffComplaintController`
 * declares them. `type` outside this list is rejected with 422.
 */
export const COMPLAINT_TYPES = [
  'trip_safety',
  'driver_behavior',
  'passenger_behavior',
  'ride_cancellation',
  'financial_issue',
  'account_issue',
  'technical_issue',
  'other',
] as const;
export type ComplaintType = (typeof COMPLAINT_TYPES)[number];

/** `date => sometimes|in:last_7_days,last_30_days` — those two values only. */
export const COMPLAINT_DATE_FILTERS = ['last_7_days', 'last_30_days'] as const;
export type ComplaintDateFilter = (typeof COMPLAINT_DATE_FILTERS)[number];

/**
 * `status => sometimes|in:pending,in_review,resolved,closed` on the INDEX route.
 * `escalated` is **not** in that list and 422s — escalated complaints are served
 * by the separate `/staff/escalated-complaints` endpoint, because `listAll()`
 * hard-excludes them (`where status != escalated`).
 */
export const COMPLAINT_INDEX_STATUSES = ['pending', 'in_review', 'resolved', 'closed'] as const;
export type ComplaintIndexStatus = (typeof COMPLAINT_INDEX_STATUSES)[number];

/** `status => sometimes|in:escalated,resolved,closed` on the escalated route. */
export const ESCALATED_STATUSES = ['escalated', 'resolved', 'closed'] as const;
export type EscalatedStatus = (typeof ESCALATED_STATUSES)[number];

export interface ComplaintsMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ComplaintCounts {
  /**
   * ⚠️ `all` is NOT the size of the list this endpoint returns. `statusCounts()`
   * sums a GROUP BY over **every** complaint row including `escalated`, while
   * `listAll()` excludes escalated — so on the live seed `counts.all` is 12 while
   * the unfiltered `meta.total` is 10. Filed as BUG-9. The UI therefore derives
   * the "all" tab badge as pending+in_review+resolved+closed, which is exactly
   * what the list can return, and never renders `counts.all`.
   */
  all: number;
  pending: number;
  in_review: number;
  resolved: number;
  closed: number;
}

export interface ComplaintsListResponse {
  status: string;
  data: ComplaintResponse[];
  meta: ComplaintsMeta;
  counts: ComplaintCounts;
}

export interface EscalatedCounts {
  escalated: number;
  /**
   * ⚠️ `resolved` and `closed` count **all** complaints in those states, not
   * only ones that passed through `escalated` — `escalatedStatusCounts()` runs a
   * bare `where('status', …)->count()`. The list agrees with them: passing
   * `status=resolved` here makes `listEscalated()` drop its escalated
   * constraint entirely and return every resolved complaint. Self-consistent,
   * but not "escalated → resolved". Filed as BUG-10; the UI labels these tabs
   * for what they actually contain.
   */
  resolved: number;
  closed: number;
}

export interface EscalatedComplaintsResponse {
  status: string;
  data: ComplaintResponse[];
  meta: ComplaintsMeta;
  counts: EscalatedCounts;
}

/** `status => required|in:in_review,resolved,closed` on respond. */
export const RESPOND_STATUSES = ['in_review', 'resolved', 'closed'] as const;
export type RespondStatus = (typeof RESPOND_STATUSES)[number];

/** `status => required|in:resolved,closed` on the escalated resolve. */
export const ESCALATED_RESOLVE_STATUSES = ['resolved', 'closed'] as const;
export type EscalatedResolveStatus = (typeof ESCALATED_RESOLVE_STATUSES)[number];

/** `resolution_notes => required|string|min:10|max:3000` (respond + resolve). */
export const RESOLUTION_NOTES_MIN = 10;
export const RESOLUTION_NOTES_MAX = 3000;
/** `reason => required|string|min:10|max:1000` (escalate). */
export const ESCALATE_REASON_MIN = 10;
export const ESCALATE_REASON_MAX = 1000;

export interface ComplaintsListParams {
  status?: ComplaintIndexStatus;
  type?: ComplaintType;
  date?: ComplaintDateFilter;
  user_id?: number;
  per_page?: number;
  page?: number;
}

export interface EscalatedListParams {
  status?: EscalatedStatus;
  type?: ComplaintType;
  date?: ComplaintDateFilter;
  per_page?: number;
  page?: number;
}

type ComplaintMutationResponse = { status: string; message: string; data: ComplaintResponse };

export const supportApi = {
  getComplaints: async (params: ComplaintsListParams = {}): Promise<ComplaintsListResponse> => {
    const response = await api.get(ENDPOINTS.STAFF.COMPLAINTS, { params });
    return response.data;
  },

  /**
   * ⚠️ NOT A READ. `StaffComplaintService::openComplaint()` transitions a
   * `pending`, unassigned complaint to `in_review` and sets
   * `assigned_to = <the calling employee>`, and the controller then forgets the
   * `staff.complaint-counts` cache. Escalated complaints are returned read-only
   * and are never reassigned. Callers must treat this as a mutation: refetch the
   * list (for fresh `counts`) and tell the user the complaint is now theirs.
   */
  getComplaint: async (
    id: string | number
  ): Promise<{ status: string; data: ComplaintResponse }> => {
    const response = await api.get(ENDPOINTS.STAFF.COMPLAINT(id));
    return response.data;
  },

  respondComplaint: async (
    id: string | number,
    resolutionNotes: string,
    status: RespondStatus
  ): Promise<ComplaintMutationResponse> => {
    const response = await api.patch(ENDPOINTS.STAFF.RESPOND_COMPLAINT(id), {
      resolution_notes: resolutionNotes,
      status,
    });
    return response.data;
  },

  escalateComplaint: async (
    id: string | number,
    reason: string
  ): Promise<ComplaintMutationResponse> => {
    const response = await api.patch(ENDPOINTS.STAFF.ESCALATE_COMPLAINT(id), { reason });
    return response.data;
  },

  getEscalatedComplaints: async (
    params: EscalatedListParams = {}
  ): Promise<EscalatedComplaintsResponse> => {
    const response = await api.get(ENDPOINTS.STAFF.ESCALATED_COMPLAINTS, { params });
    return response.data;
  },

  resolveEscalatedComplaint: async (
    id: string | number,
    resolutionNotes: string,
    status: EscalatedResolveStatus
  ): Promise<ComplaintMutationResponse> => {
    const response = await api.patch(ENDPOINTS.STAFF.RESOLVE_ESCALATED(id), {
      resolution_notes: resolutionNotes,
      status,
    });
    return response.data;
  },
};
