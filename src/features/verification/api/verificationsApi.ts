import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export interface VerificationDocument {
  type: 'face_id' | 'back_id' | 'license' | 'mechanic_card';
  url: string;
}

export interface PendingVerification {
  user_id: number;
  name: string;
  email: string;
  gender: string | null;
  address: string | null;
  type: 'driver' | 'passenger';
  profile_photo: string | null;
  documents: VerificationDocument[];
  submitted_at: string;
}

export const verificationsApi = {
  /**
   * UC-ADM-11: list all pending verifications.
   * Uses the /staff/verifications routes (admin + system_admin), unlike the
   * /admin/verifications equivalents which require system_admin only.
   */
  listPendingVerifications: async (): Promise<{
    status: string;
    total: number;
    data: PendingVerification[];
  }> => {
    const response = await api.get(ENDPOINTS.STAFF.PENDING_VERIFICATIONS);
    return response.data;
  },

  /**
   * Approve a verification request (admin or system_admin)
   * @param userId The user's integer ID
   */
  approveVerification: async (userId: number): Promise<{
    status: string;
    message: string;
    data: {
      user_id: number;
      verification_status: string;
      is_verified_driver: boolean;
      is_verified_passenger: boolean;
    };
  }> => {
    const response = await api.post(ENDPOINTS.STAFF.APPROVE_VERIFICATION(userId));
    return response.data;
  },

  /**
   * Reject a verification request (admin or system_admin).
   * The backend notifies the user; an optional reason is included in that notification.
   * @param userId The user's integer ID
   */
  rejectVerification: async (
    userId: number,
    reason?: string
  ): Promise<{
    status: string;
    message: string;
    data: {
      user_id: number;
      verification_status: string;
    };
  }> => {
    const response = await api.post(
      ENDPOINTS.STAFF.REJECT_VERIFICATION(userId),
      reason ? { reason } : {}
    );
    return response.data;
  },
};
