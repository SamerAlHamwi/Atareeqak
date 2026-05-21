import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export const supportApi = {
  getComplaints: async () => {
    const response = await api.get(ENDPOINTS.STAFF.COMPLAINTS);
    return response.data;
  },
  respondComplaint: async (id: string | number, responseMessage: string) => {
    const response = await api.patch(ENDPOINTS.STAFF.RESPOND_COMPLAINT(id), { response: responseMessage });
    return response.data;
  },
  escalateComplaint: async (id: string | number) => {
    const response = await api.patch(ENDPOINTS.STAFF.ESCALATE_COMPLAINT(id));
    return response.data;
  },
  getEscalatedComplaints: async () => {
    const response = await api.get(ENDPOINTS.STAFF.ESCALATED_COMPLAINTS);
    return response.data;
  },
  resolveEscalatedComplaint: async (id: string | number) => {
    const response = await api.patch(ENDPOINTS.STAFF.RESOLVE_ESCALATED(id));
    return response.data;
  }
};
