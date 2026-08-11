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

export interface TripsListResponse {
  status: string;
  data: TripResponse[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    filter: string;
  };
  counts: {
    all: number;
    scheduled: number;
    active: number;
    completed: number;
    cancelled: number;
    awaiting: number;
  };
}

/** Backend: `filter` is validated `in:all,active,scheduled,completed,cancelled,awaiting`. */
export type TripFilterValue = 'all' | 'active' | 'scheduled' | 'completed' | 'cancelled' | 'awaiting';

export interface TripsListParams {
  page?: number;
  filter?: TripFilterValue;
  /** Backend allows 1–50, defaults to 15. */
  per_page?: number;
}

/** Backend: `status` is validated `in:all,pending,confirmed,cancelled,completed,no_show`. */
export type BookingStatusValue = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type BookingFilterValue = 'all' | BookingStatusValue;

export interface BookingResponse {
  id: number;
  status: BookingStatusValue;
  seats: number;
  communication_number: string | null;
  passenger: {
    id: number | null;
    name: string;
    email: string | null;
  };
  ride: {
    id: number | null;
    pickup_address: string | null;
    destination_address: string | null;
    departure_time: string | null;
    price_per_seat: string | number | null;
    ride_status: string | null;
    driver: {
      id: number | null;
      name: string;
    };
  };
  total_price: number;
  booked_at: string;
  completed_at: string | null;
}

export interface BookingsListParams {
  page?: number;
  status?: BookingFilterValue;
  per_page?: number;
  user_id?: number;
  ride_id?: number;
}

/**
 * Note: unlike `/admin/trips`, this payload carries **no `counts` block** — the
 * only figure available is `meta.total` for the requested status. See REQ-2 in
 * docs/api/backend-issues.md.
 */
export interface BookingsListResponse {
  status: string;
  data: BookingResponse[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    filter: string;
  };
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LiveTripResponse {
  id: number;
  trip_ref: string;
  driver: {
    id: number | null;
    name: string;
    profile_photo: string | null;
    communication_number: string | null;
  };
  route: {
    from: string;
    to: string;
    pickup_coords: LatLng | null;
    destination_coords: LatLng | null;
    // GeoJSON LineString: coordinates are [lng, lat] pairs
    geometry: { type: string; coordinates: [number, number][] } | null;
  };
  timing: {
    departure_time: string;
    minutes_elapsed: number;
    eta_minutes: number | null;
    duration_total: number | null;
  };
  passengers: { id: number | null; name: string; seats: number }[];
  passenger_count: number;
  vehicle_type: string | null;
  distance_km: number | null;
}

export interface PopularRouteResponse {
  from: string;
  to: string;
  trip_count: number;
  total_passengers: number;
  demand_percentage: number;
  demand_level: 'Very High' | 'High' | 'Medium' | 'Low';
}

export interface TopDriverResponse {
  rank: number;
  id: number;
  name: string;
  profile_photo: string | null;
  avg_rating: number | null;
  rating_count: number;
  total_rides: number;
}

export const tripsApi = {
  getAllTrips: async ({
    page = 1,
    filter = 'all',
    per_page,
  }: TripsListParams = {}): Promise<TripsListResponse> => {
    // Backend expects `filter` (all|active|scheduled|completed|cancelled|awaiting)
    const response = await api.get(ENDPOINTS.TRIPS.ALL, {
      params: { page, filter, ...(per_page ? { per_page } : {}) },
    });
    return response.data;
  },
  getLiveTrips: async (): Promise<LiveTripResponse[]> => {
    const response = await api.get(ENDPOINTS.TRIPS.LIVE);
    return response.data.data || response.data;
  },
  getPopularRoutes: async (limit = 10): Promise<PopularRouteResponse[]> => {
    const response = await api.get(ENDPOINTS.TRIPS.POPULAR_ROUTES, { params: { limit } });
    return response.data.data || response.data;
  },
  getTopDrivers: async (limit = 10): Promise<TopDriverResponse[]> => {
    const response = await api.get(ENDPOINTS.DRIVERS.TOP, { params: { limit } });
    return response.data.data || response.data;
  },
  cancelTrip: async (id: number | string, reason: string) => {
    // Staff cancellation endpoint requires a reason (min 10 chars)
    const response = await api.post(ENDPOINTS.STAFF.CANCEL_TRIP(id), { reason });
    return response.data;
  },
  getBookings: async ({
    page = 1,
    status = 'all',
    per_page,
    user_id,
    ride_id,
  }: BookingsListParams = {}): Promise<BookingsListResponse> => {
    const response = await api.get(ENDPOINTS.STAFF.BOOKINGS, {
      params: {
        page,
        status,
        ...(per_page ? { per_page } : {}),
        ...(user_id ? { user_id } : {}),
        ...(ride_id ? { ride_id } : {}),
      },
    });
    return response.data;
  },
  cancelBooking: async (id: number | string, reason: string) => {
    // Same rule as trip cancellation: reason is required, min 10 / max 500 chars.
    // The backend 422s unless the booking is still `pending` or `confirmed`.
    const response = await api.post(ENDPOINTS.STAFF.CANCEL_BOOKING(id), { reason });
    return response.data;
  },
};
