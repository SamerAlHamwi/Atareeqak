import api from '../../../services/api';
import type {
  DashboardData,
  DashboardStats,
  GrowthChartData,
  CityDistribution,
  RecentActivity
} from '../../../types/index';

export const dashboardApi = {
  /**
   * Get full dashboard data (all widgets in one call)
   */
  getFullDashboard: async (): Promise<DashboardData> => {
    const response = await api.get<DashboardData>('/admin/dashboard');
    return response.data;
  },

  /**
   * Get only stats/KPI cards data
   */
  getStats: async (): Promise<{ status: string; data: DashboardStats }> => {
    const response = await api.get('/admin/dashboard/stats');
    return response.data;
  },

  /**
   * Get growth chart data for the last N months
   * @param months Number of months (1-12, default 6)
   */
  getGrowthChart: async (months: number = 6): Promise<{ status: string; data: { period: string; data: GrowthChartData[] } }> => {
    const response = await api.get('/admin/dashboard/growth', {
      params: { months },
    });
    return response.data;
  },

  /**
   * Get city distribution data
   */
  getCityDistribution: async (): Promise<{ status: string; data: CityDistribution[] }> => {
    const response = await api.get('/admin/dashboard/cities');
    return response.data;
  },

  /**
   * Get recent activities/bookings
   * @param limit Number of records to return (1-50, default 10)
   */
  getRecentActivities: async (limit: number = 10): Promise<{ status: string; data: RecentActivity[] }> => {
    const response = await api.get('/admin/dashboard/recent', {
      params: { limit },
    });
    return response.data;
  },
};

