import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export interface ReviewParty {
  id: number | null;
  name: string;
}

export interface ReviewResponse {
  id: number;
  comment: string;
  commenter: ReviewParty;
  recipient: ReviewParty;
  created_at: string;
}

export interface ReviewsListResponse {
  status: string;
  data: ReviewResponse[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export type ReviewDateFilter = 'last_7_days' | 'last_30_days';

export const reviewsApi = {
  /**
   * UC-ADM-03: list user-to-user profile comments (any staff role)
   */
  getReviews: async (
    params: {
      user_id?: number;
      search?: string;
      date?: ReviewDateFilter;
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<ReviewsListResponse> => {
    const response = await api.get(ENDPOINTS.STAFF.REVIEWS, { params });
    return response.data;
  },
  deleteReview: async (id: number): Promise<{ status: string; message: string }> => {
    const response = await api.delete(ENDPOINTS.STAFF.DELETE_REVIEW(id));
    return response.data;
  },
};
