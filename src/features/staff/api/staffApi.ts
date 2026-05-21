import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export const staffApi = {
  getAllStaff: async () => {
    const response = await api.get(ENDPOINTS.EMPLOYEES.ALL);
    return response.data;
  },
  toggleStaffStatus: async (id: string | number) => {
    const response = await api.patch(ENDPOINTS.EMPLOYEES.TOGGLE_ACTIVE(id));
    return response.data;
  },
  resetStaffPassword: async (id: string | number) => {
    const response = await api.patch(ENDPOINTS.EMPLOYEES.RESET_PASSWORD(id));
    return response.data;
  }
};
