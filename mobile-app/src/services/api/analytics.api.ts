import { BaseApiService } from './base.api';

/**
 * The five ranges, named the way the BACKEND names them.
 *
 * This used to be a private '1D' | '1W' | '1M' | '3M' | '6M' | 'All' vocabulary
 * that got translated to the server's words on the way out, through a map with
 * exactly three entries. Everything not in that map silently fell through to
 * "month", so '3M' and '6M' had always been quietly returning month figures,
 * and the two ranges the server does support, `yesterday` and `all`, could not
 * be asked for at all.
 *
 * Speaking the server's vocabulary directly removes the translation and the
 * places it can go wrong. `backend/domains/analytics/routes/dashboard.py`
 * (`_period_bounds`) is the single source of truth for what each one means.
 */
export type Period = 'today' | 'yesterday' | '7days' | 'month' | 'all';

export interface Analytics {
  patientVisits: number[];
  totalVisits: number;
  totalPatients: number;
  /** Booked appointments for the period (dashboard/metrics → appointments) */
  appointments: number;
  /** Patients currently in "checking" status for the period (dashboard/metrics → checking) */
  checking: number;
  dailyRevenue: number;
  percentageChange: string;
  /** Signed period-over-period % change per metric, e.g. "+5%" / "-3%". */
  patientsChange: string;
  appointmentsChange: string;
  checkingChange: string;
  revenueChange: string;
  period: Period;

  // ── The supporting detail the web dashboard shows and the phone did not ────
  // `/dashboard/metrics` has always returned all of this. The phone read four
  // numbers out of it and dropped the rest, so its KPI tiles showed a figure
  // with nothing to judge it by: "₹3,620" with no sense of whether that is most
  // of what was billed or a fraction of it.

  /** What was invoiced in the period, against which revenue is the collection. */
  billed: number;
  collectedToday: number;
  /** Money owed, and how bad it is. An INCREASE here is bad news, not good. */
  outstanding: number;
  outstandingChange: string;
  outstandingInvoiceCount: number;
  outstandingAged: number;
  outstandingOldestDays: number;
  /** New registrations in the last 30 days, whatever period is selected. */
  patientsLast30Days: number;
  appointmentsCompleted: number;
  appointmentsScheduled: number;
  appointmentsMissed: number;
}

/** Format a backend metric `{ change }` (already signed) into "+5%" / "-3%". */
function formatChange(metric: any): string {
  const change = Number(metric?.change ?? 0);
  return `${change >= 0 ? '+' : ''}${change}%`;
}

export class AnalyticsApiService extends BaseApiService {
  private formatLocalDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Date window for the appointments that feed the CHART.
   *
   * Deliberately mirrors `_period_bounds` on the server, so the line under a
   * KPI covers the days that KPI counted. The one exception is `all`: asking
   * for every appointment since 2000 to draw a sparkline would pull the entire
   * history down a phone connection, so the chart shows the last twelve months
   * while the KPI above it stays a true all-time figure.
   */
  private windowFor(period: Period, now: Date): { from: Date; to: Date } {
    const from = new Date(now);
    const to = new Date(now);

    if (period === 'today') return { from, to };
    if (period === 'yesterday') {
      from.setDate(from.getDate() - 1);
      to.setDate(to.getDate() - 1);
      return { from, to };
    }
    if (period === '7days') {
      from.setDate(from.getDate() - 6);
      return { from, to };
    }
    if (period === 'month') {
      from.setDate(1);
      return { from, to };
    }
    // all: twelve months of chart, not twenty five years of payload
    from.setMonth(from.getMonth() - 11);
    from.setDate(1);
    return { from, to };
  }

  async getAnalytics(period: Period, clinicId?: string): Promise<Analytics | null> {
    try {
      console.log('📊 [API] Fetching analytics for period:', period, 'Clinic:', clinicId);

      const now = new Date();
      const { from, to } = this.windowFor(period, now);
      const dateFromStr = this.formatLocalDate(from);
      const dateToStr = this.formatLocalDate(to);

      const headers = await this.getAuthHeaders();
      const clinicParam = clinicId ? `&clinic_id=${clinicId}` : '';

      const [appointmentsRes, metricsRes, revenueRes] = await Promise.all([
        this.fetchWithTimeout(`${this.baseURL}/appointments/?date_from=${dateFromStr}&date_to=${dateToStr}${clinicParam}`, { headers }),
        this.fetchWithTimeout(`${this.baseURL}/dashboard/metrics?period=${period}${clinicParam}`, { headers }),
        this.fetchWithTimeout(`${this.baseURL}/dashboard/revenue?period=${period}${clinicParam}`, { headers })
      ]);

      if (!appointmentsRes.ok || !metricsRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const appointments = await appointmentsRes.json();
      const metrics = await metricsRes.json();
      const revenueData = revenueRes.ok ? await revenueRes.json() : [];

      console.log(`✅ [API] Data received. Appts: ${appointments.length}, Metrics: ${!!metrics}`);

      // ── Chart buckets ──────────────────────────────────────────────────
      // One number per point on the line. The labels that go with them are
      // built by `periodLabels` on the Home screen; the two must stay the same
      // length or the axis drifts out of step with the data.
      const dayOf = (apt: any): Date | null => {
        const parts = String(apt.appointment_date || '').split('-');
        if (parts.length !== 3) return null;
        return new Date(+parts[0], +parts[1] - 1, +parts[2]);
      };

      let patientVisits: number[] = [];

      if (period === 'today' || period === 'yesterday') {
        // A single day is a single point. There is no shape to draw.
        patientVisits = [appointments.length];
      } else if (period === '7days') {
        patientVisits = new Array(7).fill(0);
        appointments.forEach((apt: any) => {
          const d = dayOf(apt);
          if (!d) return;
          const dayDiff = Math.floor((now.getTime() - d.getTime()) / 86400000);
          // 0 = today ... 6 = six days ago, drawn left to right oldest first
          if (dayDiff >= 0 && dayDiff < 7) patientVisits[6 - dayDiff] += 1;
        });
      } else if (period === 'month') {
        // Five-day buckets across the calendar month: 1-5, 6-10, ... 26+
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        patientVisits = new Array(6).fill(0);
        appointments.forEach((apt: any) => {
          const d = dayOf(apt);
          if (!d || d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return;
          const day = d.getDate();
          if (day >= 1 && day <= daysInMonth) {
            patientVisits[Math.min(Math.floor((day - 1) / 5), 5)] += 1;
          }
        });
      } else {
        // all: twelve monthly buckets, oldest first, ending on this month
        patientVisits = new Array(12).fill(0);
        appointments.forEach((apt: any) => {
          const d = dayOf(apt);
          if (!d) return;
          const monthsAgo =
            (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
          if (monthsAgo >= 0 && monthsAgo < 12) patientVisits[11 - monthsAgo] += 1;
        });
      }

      // Use the revenue value directly from backend metrics
      const revenueValue = metrics.revenue?.value || 0;

      const num = (v: any) => Number(v ?? 0) || 0;

      return {
        patientVisits,
        totalVisits: appointments.length,
        totalPatients: num(metrics.total_patients?.value),
        appointments: num(metrics.appointments?.value),
        checking: num(metrics.checking?.value),
        dailyRevenue: revenueValue,
        percentageChange: formatChange(metrics.revenue),
        patientsChange: formatChange(metrics.total_patients),
        appointmentsChange: formatChange(metrics.appointments),
        checkingChange: formatChange(metrics.checking),
        revenueChange: formatChange(metrics.revenue),
        period: period,

        billed: num(metrics.revenue?.billed),
        collectedToday: num(metrics.revenue?.collected_today),
        outstanding: num(metrics.outstanding?.value),
        outstandingChange: formatChange(metrics.outstanding),
        outstandingInvoiceCount: num(metrics.outstanding?.invoice_count),
        outstandingAged: num(metrics.outstanding?.aged_amount),
        outstandingOldestDays: num(metrics.outstanding?.oldest_days),
        patientsLast30Days: num(metrics.total_patients?.last_30_days),
        appointmentsCompleted: num(metrics.appointments?.completed),
        appointmentsScheduled: num(metrics.appointments?.scheduled),
        appointmentsMissed: num(metrics.appointments?.missed),
      };
    } catch (error) {
      console.error('❌ [API] Error fetching analytics:', error);
      return null;
    }
  }
}

export const analyticsApiService = new AnalyticsApiService();