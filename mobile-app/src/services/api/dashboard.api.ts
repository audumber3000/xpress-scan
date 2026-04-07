import { BaseApiService } from './base.api';

export interface DashboardMetrics {
  total_patients: { value: number; change: number; change_type: 'up' | 'down' };
  appointments: { value: number; change: number; change_type: 'up' | 'down' };
  checking: { value: number; change: number; change_type: 'up' | 'down' };
  revenue: { value: number; change: number; change_type: 'up' | 'down' };
}

export class DashboardApiService extends BaseApiService {
  async getMetrics(period: 'today' | 'yesterday' | '7days' | 'month' = 'today'): Promise<DashboardMetrics | null> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(`${this.baseURL}/dashboard/metrics?period=${period}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ [API] Error fetching dashboard metrics:', error);
      return null;
    }
  }
}

export const dashboardApiService = new DashboardApiService();
