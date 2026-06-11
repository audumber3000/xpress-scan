import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';

const DEFAULT_METRICS = [
  { title: 'Total Patients', value: 0, change: 0, changeType: 'up', icon: 'tooth' },
  { title: 'Appointments', value: 0, change: 0, changeType: 'up', icon: 'calendar' },
  { title: 'Checking', value: 0, change: 0, changeType: 'up', icon: 'chair' },
  { title: 'Revenue', value: 0, change: 0, changeType: 'up', icon: 'revenue' },
];

// Which detail endpoint backs each metric card's drawer.
// `usesPeriod` endpoints get ?period=<globalPeriod> appended at fetch time.
const METRIC_DETAIL_ENDPOINTS = {
  'Total Patients': { path: '/dashboard/patients/details', usesPeriod: true },
  Revenue:          { path: '/dashboard/revenue/details',  usesPeriod: true },
  Appointments:     { path: '/dashboard/appointments/today', usesPeriod: true },
  Checking:         { path: '/dashboard/chairs/status',    usesPeriod: false },
};

const DEFAULT_WIDGETS = { patientStats: true, demographics: true, revenue: true, appointments: true };

/**
 * Owns all dashboard state + data fetching so the page component stays thin.
 */
export function useDashboardData() {
  const [globalPeriod, setGlobalPeriod] = useState('month');
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
      .then((d) => {
        if (!active) return;
        setMetrics([
          { title: 'Total Patients', value: d.total_patients.value, change: d.total_patients.change, changeType: d.total_patients.change_type, icon: 'tooth' },
          { title: 'Appointments', value: d.appointments.value, change: d.appointments.change, changeType: d.appointments.change_type, icon: 'calendar' },
          { title: 'Checking', value: d.checking.value, change: d.checking.change, changeType: d.checking.change_type, icon: 'chair' },
          { title: 'Revenue', value: d.revenue.value, change: d.revenue.change, changeType: d.revenue.change_type, icon: 'revenue' },
        ]);
      })
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
    const cfg = METRIC_DETAIL_ENDPOINTS[metric.title];
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
