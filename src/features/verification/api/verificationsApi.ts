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
  type: 'driver' | 'passenger';
  documents: VerificationDocument[];
  submitted_at: string;
}

export const verificationsApi = {
  /**
   * List all pending verifications (Primary admin only)
   */
  listPendingVerifications: async (): Promise<{
    status: string;
    data: PendingVerification[];
  }> => {
    // Note: backend route is GET /admin/verifications (no /pending suffix, unlike the Postman collection)
    const response = await api.get(ENDPOINTS.VERIFICATIONS.PENDING);
    return response.data;
  },

  /**
   * Approve a verification request (Primary admin only)
   * @param userId The user's integer ID
   */
  approveVerification: async (userId: number): Promise<{
    status: string;
    message: string;
    user: {
      id: number;
      verification_status: string;
    };
  }> => {
    const response = await api.post(ENDPOINTS.VERIFICATIONS.APPROVE(userId));
    return response.data;
  },

  /**
   * Reject a verification request (Primary admin only)
   * @param userId The user's integer ID
   */
  rejectVerification: async (userId: number): Promise<{
    status: string;
    message: string;
  }> => {
    const response = await api.post(ENDPOINTS.VERIFICATIONS.REJECT(userId));
    return response.data;
  },
};

