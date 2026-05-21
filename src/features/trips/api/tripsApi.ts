import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export interface TripResponse {
  id: number;
  trip_ref: string;
  driver: {
    id: number;
    name: string;
    profile_photo: string | null;
  };
  route: {
    from: string;
    to: string;
  };
  timing: {
    departure_time: string;
    label: string;
    time_only: string;
  };
  passengers: {
    booked: number;
    total: number;
    label: string;
  };
  status: 'active' | 'scheduled' | 'completed' | 'cancelled' | 'awaiting';
  payment_method: string;
  vehicle_type: string;
  price_per_seat: number;
}

export const tripsApi = {
  getAllTrips: async (page = 1, status = 'all'): Promise<{ data: TripResponse[], current_page: number, last_page: number, total: number }> => {
    // Note: Adjust the generic get return type if needed.
    const response = await api.get(ENDPOINTS.TRIPS.ALL, {
      params: { page, status },
    });
    // The backend uses paginate, so response.data usually has data, current_page, etc.
    // Ensure we handle standard laravel pagination wrapper
    return response.data;
  },
  getLiveTrips: async (): Promise<TripResponse[]> => {
    const response = await api.get(ENDPOINTS.TRIPS.LIVE);
    // Might be wrapped in response.data.data depending on backend
    return response.data.data || response.data;
  },
  getPopularRoutes: async () => {
    const response = await api.get(ENDPOINTS.TRIPS.POPULAR_ROUTES);
    return response.data.data || response.data;
  },
  cancelTrip: async (id: number | string) => {
    const response = await api.post(ENDPOINTS.STAFF.CANCEL_TRIP(id));
    return response.data;
  }
};
