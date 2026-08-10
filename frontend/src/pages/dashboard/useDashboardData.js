import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';

import React from 'react';
import { METRIC_ICONS, ToothIcon } from './icons';
import { formatCompactMoney, formatMoney, formatCount } from './format';

// MetricCard is shared with Payments and takes a rendered node, so the icon
// lookup happens here where the dashboard's icon set is in scope.
const iconNode = (key) => React.createElement(METRIC_ICONS[key] || ToothIcon);

const DEFAULT_METRICS = [
  { key: 'revenue', title: 'Revenue collected', display: '—', change: 0, changeType: 'up', icon: iconNode('revenue'), variant: 'hero' },
  { key: 'patients', title: 'Total patients', display: '—', change: 0, changeType: 'up', icon: iconNode('tooth'), variant: 'spark' },
  { key: 'outstanding', title: 'Outstanding', display: '—', change: 0, changeType: 'up', icon: iconNode('revenue'), variant: 'meter', invert: true },
  { key: 'appointments', title: 'Appointments', display: '—', change: 0, changeType: 'up', icon: iconNode('calendar'), variant: 'breakdown' },
];

// Which detail endpoint backs each metric card's drawer.
// `usesPeriod` endpoints get ?period=<globalPeriod> appended at fetch time.
const METRIC_DETAIL_ENDPOINTS = {
  patients:     { path: '/dashboard/patients/details', usesPeriod: true },
  revenue:      { path: '/dashboard/revenue/details',  usesPeriod: true },
  appointments: { path: '/dashboard/appointments/today', usesPeriod: true },
  outstanding:  { path: '/dashboard/revenue/details',  usesPeriod: true },
};

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * Turn the raw /metrics payload into four ready-to-render cards.
 *
 * The narrative sentences live here rather than in the component so the card
 * stays a dumb renderer and every string that names a figure sits next to the
 * figure it names.
 */
function buildMetrics(d) {
  const rev = d.revenue || {};
  const pat = d.total_patients || {};
  const out = d.outstanding || {};
  const app = d.appointments || {};

  const collectedPct = pct(rev.value, rev.billed);
  const agedPct = pct(out.aged_amount, out.value);

  return [
    {
      key: 'revenue',
      title: 'Revenue collected',
      display: formatCompactMoney(rev.value),
      change: rev.change,
      changeType: rev.change_type,
      icon: iconNode('revenue'),
      variant: 'hero',
      story: rev.billed > 0
        ? `Collected ${formatMoney(rev.value)} of ${formatMoney(rev.billed)} billed. The gap is what's still owed.`
        : 'No invoices raised in this period yet.',
      storyShort: rev.billed > 0 ? `of ${formatCompactMoney(rev.billed)} billed` : 'No invoices yet',
      meterPercent: collectedPct,
      meterLeft: rev.billed > 0 ? `${collectedPct}% collected` : '',
      meterRight: rev.collected_today > 0 ? `${formatCompactMoney(rev.collected_today)} today` : '',
      raw: rev,
    },
    {
      key: 'patients',
      title: 'Total patients',
      display: formatCount(pat.value),
      change: pat.change,
      changeType: pat.change_type,
      icon: iconNode('tooth'),
      variant: 'spark',
      sparkline: pat.sparkline || [],
      story: pat.last_30_days > 0
        ? `${formatCount(pat.last_30_days)} new in the last 30 days.`
        : 'No new registrations in the last 30 days.',
      storyShort: pat.last_30_days > 0 ? `+${formatCount(pat.last_30_days)} in 30 days` : 'None in 30 days',
      raw: pat,
    },
    {
      key: 'outstanding',
      title: 'Outstanding',
      display: formatCompactMoney(out.value),
      change: out.change,
      changeType: out.change_type,
      invert: true,
      icon: iconNode('revenue'),
      variant: 'meter',
      story: out.invoice_count > 0
        ? `Across ${formatCount(out.invoice_count)} ${out.invoice_count === 1 ? 'invoice' : 'invoices'}. ${formatMoney(out.aged_amount)} is over 30 days old.`
        : 'Nothing outstanding. Every invoice is settled.',
      storyShort: out.invoice_count > 0
        ? `${formatCount(out.invoice_count)} unpaid`
        : 'All settled',
      meterPercent: agedPct,
      meterTone: 'warn',
      meterLeft: out.invoice_count > 0 ? `${agedPct}% aged 30d+` : '',
      meterRight: out.oldest_days > 0 ? `oldest ${out.oldest_days}d` : '',
      raw: out,
    },
    {
      key: 'appointments',
      title: 'Appointments',
      display: formatCount(app.value),
      change: app.change,
      changeType: app.change_type,
      icon: iconNode('calendar'),
      variant: 'breakdown',
      rows: [
        { label: 'Completed', value: formatCount(app.completed), color: '#2a276e' },
        { label: 'Scheduled', value: formatCount(app.scheduled), color: '#9B8CFF' },
        { label: 'No-show', value: formatCount(app.missed), color: '#ef4444' },
      ],
      raw: app,
    },
  ];
}

const DEFAULT_WIDGETS = { patientStats: true, demographics: true, revenue: true, appointments: true };

/**
 * Owns all dashboard state + data fetching so the page component stays thin.
 */
export function useDashboardData() {
  // All-time by default: the dashboard should open on the clinic's whole story,
  // not on a month-to-date window that reads near-empty on the 1st.
  const [globalPeriod, setGlobalPeriod] = useState('all');
  const [clinicData, setClinicData] = useState(null);
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);

  const [patientStatsData, setPatientStatsData] = useState([]);
  const [demographicsData, setDemographicsData] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [appointmentData, setAppointmentData] = useState([]);

  const [loading, setLoading] = useState({
    patientStats: true,
    demographics: true,
    revenue: true,
    appointments: true,
  });

  const [visibleWidgets, setVisibleWidgets] = useState(DEFAULT_WIDGETS);

  const [selectedMetric, setSelectedMetric] = useState(null);
  const [drawerData, setDrawerData] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [today, setToday] = useState(null);
  const [todayLoading, setTodayLoading] = useState(true);

  const setLoadingFor = (key, val) => setLoading((prev) => ({ ...prev, [key]: val }));

  // Clinic info + saved widget prefs + today's overview (once — "today" is fixed).
  useEffect(() => {
    api.get('/auth/me').then((r) => setClinicData(r.clinic)).catch(() => {});
    api.get('/dashboard/preferences')
      .then((p) => p?.visible_widgets && setVisibleWidgets(p.visible_widgets))
      .catch(() => {});
    api.get('/dashboard/today')
      .then((d) => setToday(d))
      .catch(() => setToday(null))
      .finally(() => setTodayLoading(false));
  }, []);

  // Metrics + all charts refetch on period change.
  useEffect(() => {
    let active = true;

    api.get(`/dashboard/metrics?period=${globalPeriod}`)
      .then((d) => { if (active) setMetrics(buildMetrics(d || {})); })
      .catch(() => {});

    const loaders = [
      ['patientStats', `/dashboard/patient-stats?period=${globalPeriod}`, setPatientStatsData],
      ['demographics', `/dashboard/demographics?period=${globalPeriod}`, setDemographicsData],
      ['revenue', `/dashboard/revenue?period=${globalPeriod}`, setRevenueData],
      ['appointments', `/dashboard/appointments/trends?period=${globalPeriod}`, setAppointmentData],
    ];

    loaders.forEach(([key, url, setter]) => {
      setLoadingFor(key, true);
      api.get(url)
        .then((data) => { if (active) setter(Array.isArray(data) ? data : []); })
        .catch(() => { if (active) setter([]); })
        .finally(() => { if (active) setLoadingFor(key, false); });
    });

    return () => { active = false; };
  }, [globalPeriod]);

  const savePreferences = useCallback(async (newWidgets) => {
    setVisibleWidgets(newWidgets);
    try {
      await api.post('/dashboard/preferences', { visible_widgets: newWidgets });
    } catch {
      /* best-effort persistence */
    }
  }, []);

  const toggleWidget = useCallback((key) => {
    setVisibleWidgets((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      api.post('/dashboard/preferences', { visible_widgets: next }).catch(() => {});
      return next;
    });
  }, []);

  const openMetric = useCallback(async (metric) => {
    setSelectedMetric(metric);
    const cfg = METRIC_DETAIL_ENDPOINTS[metric.key];
    if (!cfg) { setDrawerData([]); return; }
    const url = cfg.usesPeriod ? `${cfg.path}?period=${globalPeriod}` : cfg.path;
    setDrawerLoading(true);
    try {
      const data = await api.get(url);
      // Most endpoints return an array; chairs/status returns an object — pass
      // the raw payload through and let the drawer render the right view.
      setDrawerData(data ?? []);
    } catch {
      setDrawerData([]);
    } finally {
      setDrawerLoading(false);
    }
  }, [globalPeriod]);

  const closeMetric = useCallback(() => {
    setSelectedMetric(null);
    setDrawerData([]);
  }, []);

  return {
    globalPeriod, setGlobalPeriod,
    clinicData, metrics,
    patientStatsData, demographicsData, revenueData, appointmentData,
    loading, visibleWidgets, toggleWidget, savePreferences,
    selectedMetric, drawerData, drawerLoading, openMetric, closeMetric,
    today, todayLoading,
  };
}
