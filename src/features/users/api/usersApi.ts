import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export const usersApi = {
  getAllUsers: async () => {
    const response = await api.get(ENDPOINTS.USERS.ALL);
    return response.data;
  },
  banUser: async (id: string | number) => {
    const response = await api.post(ENDPOINTS.USERS.BAN(id));
    return response.data;
  },
  unbanUser: async (id: string | number) => {
    const response = await api.post(ENDPOINTS.USERS.UNBAN(id));
    return response.data;
  },
  getUserStatus: async (id: string | number) => {
    const response = await api.get(ENDPOINTS.USERS.STATUS(id));
    return response.data;
  },
};
