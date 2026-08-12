import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export type VerificationDocumentType = 'face_id' | 'back_id' | 'license' | 'mechanic_card';

/** The four values allowed by the `photos.type` enum, in review order. */
export const VERIFICATION_DOCUMENT_TYPES: readonly VerificationDocumentType[] = [
  'face_id',
  'back_id',
  'license',
  'mechanic_card',
];

export interface VerificationDocument {
  type: VerificationDocumentType;
  url: string;
}

export interface PendingVerification {
  user_id: number;
  name: string;
  email: string;
  gender: string | null;
  address: string | null;
  /** Derived server-side: a `license` or `mechanic_card` photo makes it a driver. */
  type: 'driver' | 'passenger';
  profile_photo: string | null;
  documents: VerificationDocument[];
  submitted_at: string;
}

export interface PendingVerificationsResponse {
  status: string;
  /** Server-side count of the whole queue — this endpoint is never paginated. */
  total: number;
  data: PendingVerification[];
}

export interface ApproveVerificationResponse {
  status: string;
  message: string;
  data: {
    user_id: number;
    national_id: string;
    verification_status: string;
    is_verified_driver: boolean;
    is_verified_passenger: boolean;
  };
}

export interface RejectVerificationResponse {
  status: string;
  message: string;
  data: {
    user_id: number;
    verification_status: string;
  };
}

export const verificationsApi = {
  /**
   * UC-ADM-10: the whole pending queue in one response — no pagination, no
   * filter params. `StaffAdminController::pendingVerifications` caches it for
   * 2 minutes under `staff.pending-verifications`; approve and reject both
   * `Cache::forget` that key, so a refetch after a mutation is always fresh.
   * A *new* submission from the user side can lag by up to the TTL.
   */
  listPendingVerifications: async (): Promise<PendingVerificationsResponse> => {
    const response = await api.get(ENDPOINTS.STAFF.PENDING_VERIFICATIONS);
    return response.data;
  },

  /**
   * UC-ADM-11: approve a pending verification.
   *
   * `national_id` is **required** (`required|string|max:50`) — the reviewer
   * reads it off the submitted ID document; it is never present in the pending
   * payload. The backend also rejects a value already linked to another
   * account with a 422 carrying `conflicting_user_id`.
   */
  approveVerification: async (
    userId: number,
    nationalId: string
  ): Promise<ApproveVerificationResponse> => {
    const response = await api.post(ENDPOINTS.STAFF.APPROVE_VERIFICATION(userId), {
      national_id: nationalId,
    });
    return response.data;
  },

  /**
   * UC-ADM-11: reject a pending verification.
   *
   * `reason` is validated as `nullable|string|max:500` — optional, and with no
   * minimum length (unlike the 10-char ban/cancel/escalate reasons). When given
   * it is appended to the Arabic notification the user receives; when omitted
   * the user is told to correct their data and resubmit.
   */
  rejectVerification: async (
    userId: number,
    reason?: string
  ): Promise<RejectVerificationResponse> => {
    const response = await api.post(
      ENDPOINTS.STAFF.REJECT_VERIFICATION(userId),
      reason ? { reason } : {}
    );
    return response.data;
  },
};
