import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export const driversApi = {
  getAllDrivers: async () => {
    const response = await api.get(ENDPOINTS.DRIVERS.ALL);
    return response.data;
  },
  getDriverStats: async () => {
    const response = await api.get(ENDPOINTS.DRIVERS.STATS);
    return response.data;
  },
  getDriverActivity: async () => {
    const response = await api.get(ENDPOINTS.DRIVERS.ACTIVITY);
    return response.data;
  },
  getTopDrivers: async () => {
    const response = await api.get(ENDPOINTS.DRIVERS.TOP);
    return response.data;
  },
  getDriverProfile: async (id: string | number) => {
    const response = await api.get(ENDPOINTS.DRIVERS.PROFILE(id));
    return response.data;
  },
  getDriverDashboard: async (id: string | number) => {
    const response = await api.get(ENDPOINTS.DRIVERS.DRIVER_DASHBOARD(id));
    return response.data;
  },
  getVerificationEfficiency: async () => {
    const response = await api.get(ENDPOINTS.DRIVERS.VERIFICATION_EFFICIENCY);
    return response.data;
  }
};
