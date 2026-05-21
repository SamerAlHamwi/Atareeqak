import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';
import type {
  DashboardData,
  DashboardStats,
  GrowthChartData,
  CityDistribution,
  RecentActivity
} from '../../../types/index';

export const dashboardApi = {
  getFullDashboard: async (): Promise<DashboardData> => {
    const response = await api.get<DashboardData>(ENDPOINTS.DASHBOARD.BASE);
    return response.data;
  },

  getStats: async (): Promise<{ status: string; data: DashboardStats }> => {
    const response = await api.get(ENDPOINTS.DASHBOARD.STATS);
    return response.data;
  },

  getGrowthChart: async (months: number = 6): Promise<{ status: string; data: { period: string; data: GrowthChartData[] } }> => {
    const response = await api.get(ENDPOINTS.DASHBOARD.GROWTH, {
      params: { months },
    });
    return response.data;
  },

  getCityDistribution: async (): Promise<{ status: string; data: CityDistribution[] }> => {
    const response = await api.get(ENDPOINTS.DASHBOARD.CITIES);
    return response.data;
  },

  getRecentActivities: async (limit: number = 10): Promise<{ status: string; data: RecentActivity[] }> => {
    const response = await api.get(ENDPOINTS.DASHBOARD.RECENT, {
      params: { limit },
    });
    return response.data;
  },
};
