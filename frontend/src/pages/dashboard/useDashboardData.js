import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../utils/api';

import React from 'react';
import { METRIC_ICONS, ToothIcon } from './icons';
import { formatCompactMoney, formatMoney, formatCount } from './format';

// MetricCard is shared with Payments and takes a rendered node, so the icon
// lookup happens here where the dashboard's icon set is in scope.
const iconNode = (key) => React.createElement(METRIC_ICONS[key] || ToothIcon);

const DEFAULT_METRICS = [
  { key: 'revenue', title: 'Revenue collected', display: '—', change: 0, changeType: 'up', icon: iconNode('revenue'), variant: 'hero' },
  { key: 'patients', title: 'New patients', display: '—', change: 0, changeType: 'up', icon: iconNode('tooth'), variant: 'spark' },
  { key: 'outstanding', title: 'Outstanding', display: '—', change: 0, changeType: 'up', icon: iconNode('outstanding'), variant: 'meter', invert: true },
  { key: 'appointments', title: 'Appointments', display: '—', change: 0, changeType: 'up', icon: iconNode('calendar'), variant: 'breakdown' },
];

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * Turn the raw /metrics payload into four ready-to-render cards.
 *
 * The narrative sentences live here rather than in the component so the card
 * stays a dumb renderer and every string that names a figure sits next to the
 * figure it names.
 *
 * Every card now also carries `previous`, the value its percentage was measured
 * against. The card uses it to decide whether a percentage is worth printing at
 * all — see describeDelta in format.js. Without it, a clinic going from one
 * patient to nine renders "▲ 800%", which is true and useless.
 */
function buildMetrics(d) {
  const rev = d.revenue || {};
  const pat = d.total_patients || {};
  const out = d.outstanding || {};
  const app = d.appointments || {};

  // "All time" has no earlier window, so there is no honest trend to show.
  const comparable = d.comparable !== false;
  const trend = (m) => (comparable ? m.change : null);
  const labels = d.series_labels || null;

  const agedPct = pct(out.aged_amount, out.value);
  const missRate = pct(app.missed, app.value);

  const revSeries = Array.isArray(rev.series) ? rev.series : null;
  const hasRevBars = revSeries && revSeries.length >= 3 && revSeries.some((v) => v > 0);
  const bestDay = hasRevBars ? Math.max(...revSeries) : 0;

  const patSeries = Array.isArray(pat.series) ? pat.series : [];
  const unmarked = app.unmarked ?? 0;
  const upcoming = app.upcoming ?? app.scheduled ?? 0;

  return [
    {
      key: 'revenue',
      title: 'Revenue collected',
      display: formatCompactMoney(rev.value),
      change: trend(rev),
      changeType: rev.change_type,
      previous: rev.previous,
      value: rev.value,
      isMoney: true,
      icon: iconNode('revenue'),
      variant: 'hero',
      // Bars: money received per day (or month) across the period, so the
      // card answers "is it coming in steadily?". It used to be a meter of
      // collected-by-payment-date over billed-by-invoice-date, two different
      // groups of invoices that could pass 100%.
      sparkline: hasRevBars ? revSeries : null,
      sparklineLabels: hasRevBars ? labels : null,
      story: rev.billed > 0
        ? `${formatMoney(rev.billed)} billed in the same period${hasRevBars ? `. Best day ${formatCompactMoney(bestDay)}.` : '.'}`
        : 'No invoices raised in this period yet.',
      storyShort: hasRevBars ? `Best day ${formatCompactMoney(bestDay)}` : (rev.billed > 0 ? `of ${formatCompactMoney(rev.billed)} billed` : 'No invoices yet'),
      raw: rev,
    },
    {
      key: 'patients',
      title: 'New patients',
      display: formatCount(pat.value),
      change: trend(pat),
      changeType: pat.change_type,
      previous: pat.previous,
      value: pat.value,
      icon: iconNode('tooth'),
      variant: 'spark',
      // Same window as the headline (it used to be a fixed last-7-days).
      sparkline: patSeries.some((v) => v > 0) ? patSeries : [],
      sparklineLabels: labels,
      story: pat.returning > 0
        ? `${formatCount(pat.returning)} existing ${pat.returning === 1 ? 'patient' : 'patients'} came back for a visit.`
        : pat.value > 0 ? 'No returning patients seen in this period.' : 'Nobody new registered in this period.',
      storyShort: pat.returning > 0 ? `${formatCount(pat.returning)} came back` : 'None returning',
      raw: pat,
    },
    {
      key: 'outstanding',
      title: 'Outstanding',
      display: formatCompactMoney(out.value),
      // Not period-filtered, and the old "previous" was dues on invoices
      // raised before the period, which is not a balance change. A fact
      // replaces the trend: how many bills are past 90 days.
      change: null,
      value: out.value,
      isMoney: true,
      invert: true,
      badge: out.over_90_count > 0 ? `${formatCount(out.over_90_count)} over 90 days` : null,
      badgeTone: 'bad',
      icon: iconNode('outstanding'),
      variant: 'meter',
      story: out.invoice_count > 0
        ? `Across ${formatCount(out.invoice_count)} ${out.invoice_count === 1 ? 'invoice' : 'invoices'}. ${formatMoney(out.aged_amount)} is over 30 days old.`
        : 'Nothing outstanding. Every invoice is settled.',
      storyShort: out.invoice_count > 0
        ? `${formatCount(out.invoice_count)} unpaid`
        : 'All settled',
      meterPercent: agedPct,
      meterTone: 'warn',
      meterLeft: out.invoice_count > 0 ? `${agedPct}% older than 30 days` : '',
      meterRight: out.oldest_days > 0 ? `oldest ${out.oldest_days}d` : '',
      raw: out,
    },
    {
      key: 'appointments',
      title: 'Appointments',
      display: formatCount(app.value),
      change: trend(app),
      changeType: app.change_type,
      previous: app.previous,
      value: app.value,
      icon: iconNode('calendar'),
      variant: 'breakdown',
      // "Not marked yet" is past visits nobody closed: the row to act on.
      // It used to hide inside "Scheduled" with the ones still to come.
      rows: [
        { label: 'Done', value: formatCount(app.completed), color: '#2f9e6e' },
        { label: 'Upcoming', value: formatCount(upcoming), color: '#8b86dd' },
        ...(unmarked > 0 ? [{ label: 'Not marked yet', value: formatCount(unmarked), color: '#d99a1e' }] : []),
        { label: 'No-show', value: formatCount(app.missed), color: '#c23b3b' },
      ],
      story: app.value > 0
        ? missRate > 0
          ? `${missRate}% were missed or cancelled, ${formatCount(app.missed)} of ${formatCount(app.value)}.`
          : 'Nobody missed an appointment in this period.'
        : 'Nothing booked in this period.',
      storyShort: app.value > 0 && missRate > 0 ? `${missRate}% missed` : 'None missed',
      raw: app,
    },
  ];
}

/**
 * Which charts are on screen. These keys changed with the chart row itself, and
 * the merge in the preferences fetch below is what makes that safe — see there.
 */
const DEFAULT_WIDGETS = {
  cashflow: true,
  treatmentRevenue: true,
  chairLoad: true,
  receivables: true,
};

/**
 * Owns all dashboard state + data fetching so the page component stays thin.
 */
export function useDashboardData() {
  // All-time by default: the dashboard should open on the clinic's whole story,
  // not on a month-to-date window that reads near-empty on the 1st.
  const [globalPeriod, setGlobalPeriod] = useState('all');
  const [clinicData, setClinicData] = useState(null);
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);

  const [revenueData, setRevenueData] = useState([]);
  const [treatmentData, setTreatmentData] = useState(null);
  const [chairLoadData, setChairLoadData] = useState(null);
  const [receivablesData, setReceivablesData] = useState(null);

  const [loading, setLoading] = useState({
    revenue: true,
    treatments: true,
    chairLoad: true,
    receivables: true,
  });

  // Distinct from `loading`. A first fetch has nothing to show, so it gets a
  // skeleton. A refetch — which is what changing the period does — already has
  // a perfectly good chart on screen, and blanking all four cards to grey bars
  // and reflowing the page is a worse answer than dimming what is there.
  const [refreshing, setRefreshing] = useState({});
  const everLoaded = useRef({});

  const [visibleWidgets, setVisibleWidgets] = useState(DEFAULT_WIDGETS);
  const [selectedMetric, setSelectedMetric] = useState(null);

  const [ambient, setAmbient] = useState(null);
  const [today, setToday] = useState(null);
  const [todayLoading, setTodayLoading] = useState(true);

  const beginLoad = useCallback((key) => {
    if (everLoaded.current[key]) setRefreshing((p) => ({ ...p, [key]: true }));
    else setLoading((p) => ({ ...p, [key]: true }));
  }, []);

  const endLoad = useCallback((key) => {
    everLoaded.current[key] = true;
    setLoading((p) => ({ ...p, [key]: false }));
    setRefreshing((p) => ({ ...p, [key]: false }));
  }, []);

  // Clinic info + saved widget prefs + today's overview + receivables.
  //
  // Receivables belongs here rather than in the period effect: unpaid money is
  // unpaid regardless of which window the header shows, so the endpoint takes
  // no period and refetching it on every filter change would be four identical
  // requests for one answer.
  useEffect(() => {
    api.get('/auth/me').then((r) => setClinicData(r.clinic)).catch(() => {});

    api.get('/dashboard/preferences')
      .then((p) => {
        // Merge over the defaults, never replace them. This used to be a
        // straight setVisibleWidgets(p.visible_widgets), which meant any key
        // the saved payload didn't mention came back undefined and the chart
        // silently never rendered. Every one of these keys is new, and the
        // endpoint always returns a payload rather than null, so a wholesale
        // replace would have hidden the entire chart row for every existing
        // user on the day this shipped.
        const saved = p?.visible_widgets;
        if (saved && typeof saved === 'object') {
          setVisibleWidgets({ ...DEFAULT_WIDGETS, ...saved });
        }
      })
      .catch(() => {});

    api.get('/dashboard/today')
      .then((d) => setToday(d))
      .catch(() => setToday(null))
      .finally(() => setTodayLoading(false));

    // Weather and the festival calendar have nothing to do with the period
    // filter, and both are cheap and cached server-side. Fetched once, and
    // failure is silence: the strip just does not render.
    api.get('/dashboard/ambient')
      .then((d) => setAmbient(d))
      .catch(() => setAmbient(null));

    api.get('/dashboard/receivables/aging')
      .then((d) => setReceivablesData(d))
      .catch(() => setReceivablesData(null))
      .finally(() => endLoad('receivables'));
  }, [endLoad]);

  // Metrics + the period-scoped charts refetch on period change.
  useEffect(() => {
    let active = true;

    api.get(`/dashboard/metrics?period=${globalPeriod}`)
      .then((d) => { if (active) setMetrics(buildMetrics(d || {})); })
      .catch(() => {});

    const loaders = [
      ['revenue', `/dashboard/revenue?period=${globalPeriod}`, setRevenueData, []],
      ['treatments', `/dashboard/treatments/revenue?period=${globalPeriod}`, setTreatmentData, null],
      ['chairLoad', `/dashboard/chair-load?period=${globalPeriod}`, setChairLoadData, null],
    ];

    loaders.forEach(([key, url, setter, fallback]) => {
      beginLoad(key);
      api.get(url)
        .then((data) => { if (active) setter(data ?? fallback); })
        .catch(() => { if (active) setter(fallback); })
        .finally(() => { if (active) endLoad(key); });
    });

    return () => { active = false; };
  }, [globalPeriod, beginLoad, endLoad]);

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

  // The drawer fetches its own data now, from one endpoint that returns the
  // same envelope as the Payments drawer. This used to map each card to a
  // different ad-hoc endpoint, two of which pointed at the legacy `payments`
  // table and returned nothing.
  const openMetric = useCallback((metric) => setSelectedMetric(metric), []);
  const closeMetric = useCallback(() => setSelectedMetric(null), []);

  // Opening a KPI drawer by key, for a chart that wants to hand off to one it
  // does not own. The receivables chart uses it to reach the Outstanding
  // drawer rather than growing a second list of unpaid bills.
  const openMetricByKey = useCallback(
    (key) => setSelectedMetric(metrics.find((m) => m.key === key) || null),
    [metrics]
  );

  return {
    globalPeriod, setGlobalPeriod,
    clinicData, metrics,
    revenueData, treatmentData, chairLoadData, receivablesData,
    loading, refreshing, visibleWidgets, toggleWidget, savePreferences,
    selectedMetric, openMetric, openMetricByKey, closeMetric,
    ambient,
    today, todayLoading,
  };
}
