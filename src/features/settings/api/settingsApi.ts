import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export type PolicyType = 'privacy' | 'cancellation';

export interface PolicySectionResponse {
  title: string;
  intro: string | null;
  points: string[];
}

export interface PolicyResponse {
  last_updated_label: string | null;
  sections: PolicySectionResponse[];
  updated_at: string | null;
}

export interface PolicySettingsResponse {
  company: string | null;
  app_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  consent_label: string | null;
}

export interface PolicyPayload {
  settings: PolicySettingsResponse;
  privacy: PolicyResponse | null;
  cancellation: PolicyResponse | null;
}

export interface UpdatePolicyRequest {
  last_updated_label: string | null;
  sections: PolicySectionResponse[];
}

export const settingsApi = {
  getPolicies: async (): Promise<{ status: string; data: PolicyPayload }> => {
    const response = await api.get(ENDPOINTS.POLICIES.ALL);
    return response.data;
  },

  updatePolicy: async (
    type: PolicyType,
    payload: UpdatePolicyRequest
  ): Promise<{ status: string; message: string; data: { last_updated_label: string | null; sections: PolicySectionResponse[] } }> => {
    const response = await api.put(ENDPOINTS.POLICIES.UPDATE(type), payload);
    return response.data;
  },

  updateSettings: async (
    payload: PolicySettingsResponse
  ): Promise<{ status: string; message: string; data: PolicySettingsResponse }> => {
    const response = await api.put(ENDPOINTS.POLICIES.SETTINGS, payload);
    return response.data;
  },
};
