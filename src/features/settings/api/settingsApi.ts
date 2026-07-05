import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export interface AppSettingsResponse {
  app_name: string;
  support_email: string;
  commission_rate: number;
  min_withdrawal: number;
  moderation_words: string;
  alert_message: string;
  maintenance_mode: boolean;
}

export const settingsApi = {
  getSettings: async (): Promise<{ status: string; data: AppSettingsResponse }> => {
    const response = await api.get(ENDPOINTS.SETTINGS);
    return response.data;
  },
  updateSettings: async (
    payload: Partial<AppSettingsResponse>
  ): Promise<{ status: string; message: string; data: AppSettingsResponse }> => {
    const response = await api.post(ENDPOINTS.SETTINGS, payload);
    return response.data;
  },
};
