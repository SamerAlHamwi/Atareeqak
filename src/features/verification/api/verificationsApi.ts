import api from '../../../services/api';

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
    const response = await api.get('/admin/verifications/pending');
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
    const response = await api.post(`/admin/verifications/${userId}/approve`);
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
    const response = await api.post(`/admin/verifications/${userId}/reject`);
    return response.data;
  },
};

