import api from '../../../services/api';

export interface RideStats {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  awaiting_confirmation: number;
}

export interface FinancialStats {
  sycash: {
    current_balance: string;
    total_creation_fees: string;
  };
  primary_admin: {
    current_balance: string;
    total_collected: string;
    total_disbursed: string;
  };
  active_rides_locked: string;
}

export interface ReportData {
  ride_stats: RideStats;
  financial_stats: FinancialStats;
  date_range: {
    start: string;
    end: string;
  };
}

export const reportsApi = {
  /**
   * Generate financial report (Primary admin only)
   * @param startDate Start date (Y-m-d format) - optional
   * @param endDate End date (Y-m-d format) - optional
   */
  generateFinancialReport: async (startDate?: string, endDate?: string): Promise<{
    status: string;
    report_data: ReportData;
  }> => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await api.get('/admin/reports', { params });
    return response.data;
  },

  /**
   * Export report to PDF (Primary admin only)
   */
  exportReportToPdf: async (startDate?: string, endDate?: string): Promise<Blob> => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await api.get('/admin/export/pdf', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

