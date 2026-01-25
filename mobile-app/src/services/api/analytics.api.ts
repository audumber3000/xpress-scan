import { BaseApiService } from './base.api';

export interface Analytics {
  patientVisits: number[];
  totalVisits: number;
  totalPatients: number;
  dailyRevenue: number;
  percentageChange: string;
  period: '1W' | '1M' | '3M' | '6M' | 'All';
}

export class AnalyticsApiService extends BaseApiService {
  private formatLocalDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async getAnalytics(period: '1W' | '1M' | '3M' | '6M' | 'All'): Promise<Analytics | null> {
    try {
      console.log('📊 [API] Fetching analytics for period:', period);

      const now = new Date();
      let dateFrom = new Date();

      if (period === '1W') {
        dateFrom.setDate(now.getDate() - 7);
      } else if (period === '1M') {
        dateFrom.setMonth(now.getMonth() - 1);
      } else if (period === '6M') {
        dateFrom.setMonth(now.getMonth() - 6);
      } else {
        dateFrom.setFullYear(now.getFullYear() - 1);
      }

      const dateFromStr = this.formatLocalDate(dateFrom);
      const dateToStr = this.formatLocalDate(now);

      const headers = await this.getAuthHeaders();

      // Fetch appointments, metrics, and revenue
      const [appointmentsRes, metricsRes, revenueRes] = await Promise.all([
        fetch(`${this.baseURL}/appointments?date_from=${dateFromStr}&date_to=${dateToStr}`, { headers }),
        fetch(`${this.baseURL}/dashboard/metrics`, { headers }),
        fetch(`${this.baseURL}/dashboard/revenue?period=week`, { headers })
      ]);

      if (!appointmentsRes.ok || !metricsRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const appointments = await appointmentsRes.json();
      const metrics = await metricsRes.json();
      const revenueData = revenueRes.ok ? await revenueRes.json() : [];

      console.log(`✅ [API] Data received. Appts: ${appointments.length}, Metrics: ${!!metrics}`);

      let patientVisits: number[] = [];

      if (period === '1W') {
        // Correctly bucket by day of week [Sun(0) .. Sat(6)]
        patientVisits = new Array(7).fill(0);
        appointments.forEach((apt: any) => {
          // Parse YYYY-MM-DD manually as local to avoid TZ shifting to "yesterday"
          const parts = apt.appointment_date.split('-');
          if (parts.length === 3) {
            const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const dayIndex = date.getDay();
            patientVisits[dayIndex] = (patientVisits[dayIndex] || 0) + 1;
          }
        });
      } else {
        // Group by month Jan(0) .. Dec(11)
        patientVisits = new Array(12).fill(0);
        appointments.forEach((apt: any) => {
          const parts = apt.appointment_date.split('-');
          if (parts.length >= 2) {
            const monthIndex = parseInt(parts[1]) - 1;
            patientVisits[monthIndex] = (patientVisits[monthIndex] || 0) + 1;
          }
        });
      }

      // Calculate daily revenue from the revenue endpoint (today's entry)
      const todayDayName = now.toLocaleDateString('en-US', { weekday: 'short' });
      const todayRevenueEntry = Array.isArray(revenueData) ? revenueData.find((r: any) => r.day === todayDayName) : null;
      const dailyRevenue = todayRevenueEntry ? todayRevenueEntry.revenue : (metrics.appointments_today?.value || 0) * 850;

      return {
        patientVisits,
        totalVisits: appointments.length,
        totalPatients: metrics.total_patients?.value || 0,
        dailyRevenue: dailyRevenue,
        percentageChange: `${metrics.total_patients?.change_type === 'up' ? '+' : '-'}${metrics.total_patients?.change || 0}%`,
        period: period,
      };
    } catch (error) {
      console.error('❌ [API] Error fetching analytics:', error);
      return null;
    }
  }
}

export const analyticsApiService = new AnalyticsApiService();