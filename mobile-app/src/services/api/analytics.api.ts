import { BaseApiService } from './base.api';

export interface Analytics {
  patientVisits: number[];
  totalVisits: number;
  totalPatients: number;
  dailyRevenue: number;
  percentageChange: string;
  period: '1D' | '1W' | '1M' | '3M' | '6M' | 'All';
}

export class AnalyticsApiService extends BaseApiService {
  private formatLocalDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async getAnalytics(period: '1D' | '1W' | '1M' | '3M' | '6M' | 'All', clinicId?: string): Promise<Analytics | null> {
    try {
      console.log('📊 [API] Fetching analytics for period:', period, 'Clinic:', clinicId);

      const now = new Date();
      let dateFrom = new Date();

      if (period === '1D') {
        // Today only
        dateFrom = new Date(now);
      } else if (period === '1W') {
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
      const clinicParam = clinicId ? `&clinic_id=${clinicId}` : '';
      
      const periodMapping: Record<string, string> = {
        '1D': 'today',
        '1W': '7days',
        '1M': 'month',
      };
      const backendPeriod = periodMapping[period] || 'month';

      const [appointmentsRes, metricsRes, revenueRes] = await Promise.all([
        this.fetchWithTimeout(`${this.baseURL}/appointments/?date_from=${dateFromStr}&date_to=${dateToStr}${clinicParam}`, { headers }),
        this.fetchWithTimeout(`${this.baseURL}/dashboard/metrics?period=${backendPeriod}${clinicParam}`, { headers }),
        this.fetchWithTimeout(`${this.baseURL}/dashboard/revenue?period=${backendPeriod}${clinicParam}`, { headers })
      ]);

      if (!appointmentsRes.ok || !metricsRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const appointments = await appointmentsRes.json();
      const metrics = await metricsRes.json();
      const revenueData = revenueRes.ok ? await revenueRes.json() : [];

      console.log(`✅ [API] Data received. Appts: ${appointments.length}, Metrics: ${!!metrics}`);

      let patientVisits: number[] = [];

      if (period === '1D') {
        // Just one bucket for today
        patientVisits = [appointments.length];
      } else if (period === '1W') {
        // Last 7 days relative to now (trailing week)
        patientVisits = new Array(7).fill(0);
        appointments.forEach((apt: any) => {
          const parts = apt.appointment_date.split('-');
          if (parts.length === 3) {
            const aptDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const diffTime = now.getTime() - aptDate.getTime();
            const dayDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            // dayDiff 0 = today, 1 = yesterday, ..., 6 = 6 days ago
            if (dayDiff >= 0 && dayDiff < 7) {
              const dayIndex = 6 - dayDiff; // 0 = 6 days ago, 6 = today
              patientVisits[dayIndex] = (patientVisits[dayIndex] || 0) + 1;
            }
          }
        });
      } else {
        // Group by 5-day intervals for current month (approx 6 buckets)
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        patientVisits = new Array(6).fill(0); // 6 buckets (1-5, 6-10, 11-15, 16-20, 21-25, 26+)
        appointments.forEach((apt: any) => {
          const parts = apt.appointment_date.split('-');
          if (parts.length === 3 && parseInt(parts[1]) === now.getMonth() + 1) {
            const day = parseInt(parts[2]);
            if (day >= 1 && day <= daysInMonth) {
              const bucketIndex = Math.min(Math.floor((day - 1) / 5), 5);
              patientVisits[bucketIndex]++;
            }
          }
        });
      }

      // Use the revenue value directly from backend metrics
      const revenueValue = metrics.revenue?.value || 0;

      return {
        patientVisits,
        totalVisits: appointments.length,
        totalPatients: metrics.appointments?.value || 0, // Using appointments as Patients seen
        dailyRevenue: revenueValue,
        percentageChange: `${metrics.revenue?.change_type === 'up' ? '+' : '-'}${metrics.revenue?.change || 0}%`,
        period: period,
      };
    } catch (error) {
      console.error('❌ [API] Error fetching analytics:', error);
      return null;
    }
  }
}

export const analyticsApiService = new AnalyticsApiService();