import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import SetupGateModal from '../components/onboarding/SetupGateModal';
import { useBreakpoint } from '../utils/useBreakpoint';

import { useDashboardData } from './dashboard/useDashboardData';
import DashboardHeader from './dashboard/DashboardHeader';
import QuickActions from './dashboard/QuickActions';
import AmbientStrip from './dashboard/AmbientStrip';
import MetricCard from '../components/common/MetricCard';
import TodayPanel from './dashboard/TodayPanel';
import RevenueChart from './dashboard/charts/RevenueChart';
import TreatmentRevenueChart from './dashboard/charts/TreatmentRevenueChart';
import ChairLoadChart from './dashboard/charts/ChairLoadChart';
import ReceivablesAgeChart from './dashboard/charts/ReceivablesAgeChart';
// The same drawer Payments, Lab and Vendors use. The dashboard had its own,
// which queried the legacy `payments` table (0 rows) for Revenue and
// Outstanding, so those two opened empty while the card above read three lakh.
import KpiDetailDrawer from '../components/common/KpiDetailDrawer';
import AssistantPanel from './dashboard/AssistantPanel';
import SupportMenu from './dashboard/SupportMenu';

/**
 * A quiet band label, so the page reads as three sections rather than six
 * stacked cards: what the numbers are, what today looks like, and the shape
 * behind both.
 */
const SectionLabel = ({ children, note }) => (
  <div className="flex items-baseline gap-2.5 mb-2.5 mt-1">
    <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{children}</h2>
    {note && <span className="text-[11px] text-gray-400 font-medium truncate">{note}</span>}
    <span className="flex-1 h-px bg-gray-200 min-w-4" />
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const ownerName = (user?.first_name || user?.name || '').split(' ')[0] || '';
  const breakpoint = useBreakpoint();

  const {
    globalPeriod, setGlobalPeriod,
    metrics,
    revenueData, treatmentData, chairLoadData, receivablesData,
    loading, refreshing, visibleWidgets,
    selectedMetric, openMetric, openMetricByKey, closeMetric,
    ambient,
    today, todayLoading,
  } = useDashboardData();

  const [showAssistant, setShowAssistant] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // The guided setup, once, right after onboarding (flag set by
  // ClinicOnboarding once verification passes). The modal decides for itself
  // whether there is anything left worth asking about, and closes immediately
  // if the clinic is already configured.
  useEffect(() => {
    if (localStorage.getItem('mp_welcome_pending') === '1') {
      localStorage.removeItem('mp_welcome_pending');
      setShowWelcome(true);
    }
  }, []);

  // Reuse the revenue KPI's period-over-period figures as the caption on the
  // chart that plots the same money. `previous` rides along so the caption can
  // drop the percentage when the base is too small to carry one.
  const revenueDelta = (() => {
    const m = metrics.find((x) => x.key === 'revenue');
    return m ? { change: m.change, changeType: m.changeType, previous: m.previous, value: m.value, isMoney: true } : null;
  })();

  return (
    <div className="w-full h-full min-h-screen bg-gray-50 p-3 sm:p-4 md:p-8 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      <DashboardHeader
        ownerName={ownerName}
        period={globalPeriod}
        onPeriodChange={setGlobalPeriod}
      />

      {/* The quick actions and the ambient strip share a row: the actions are
          what you came to do, the strip is what kind of day it is. They sit at
          opposite ends of it, which is also what stops the right half of the
          header reading as an empty shelf.

          The strip drops below the actions on a phone rather than competing
          with them for a 390px line. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-5">
        <QuickActions />
        <AmbientStrip data={ambient} />
      </div>

      {/*
        KPI row.
          phone   hero full width, patients + outstanding 2-up, appointments full width
          tablet  2 x 2
          >=lg    4-up

        Hero and the breakdown card both span two columns on a phone: the hero
        because its narrative line needs the width, and appointments because it
        is the 4th of 4 in a 2-column grid — left on its own it would sit in a
        half-width cell with a hole beside it.
      */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4 mb-4 md:mb-5">
        {metrics.map((metric) => {
          // `key` and `raw` are pulled out rather than spread: React reserves
          // `key`, and `raw` is the untouched payload the drawer wants, not a
          // card prop.
          const { key, raw, ...cardProps } = metric;
          return (
            <MetricCard
              key={key}
              {...cardProps}
              onClick={() => openMetric(metric)}
              className={
                metric.variant === 'hero' || metric.variant === 'breakdown'
                  ? 'col-span-2 sm:col-span-1'
                  : ''
              }
            />
          );
        })}
      </div>

      {/* Calendar + today's schedule + the attention strip */}
      <TodayPanel data={today} loading={todayLoading} />

      <SectionLabel note="Two of these ignore the date filter and say so">Trends</SectionLabel>

      {/*
        Charts.
          phone   one per row
          tablet  one per row, full width — 768px splits into two 360px columns,
                  which is under the width a column chart or a weekday grid
                  needs, and pairing them left half-empty rows besides
          >=lg    2/3 + 1/3

        Which chart gets which column is decided by its form, not by whichever
        slot was free. Money-in and the chair grid are time across the x-axis
        and want width; the two ranked lists read fine narrow and would only
        stretch their bars if given more.
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
        {visibleWidgets.cashflow && (
          <div className="md:col-span-2">
            <RevenueChart
              data={revenueData}
              loading={loading.revenue}
              refreshing={refreshing.revenue}
              delta={revenueDelta}
              breakpoint={breakpoint}
            />
          </div>
        )}
        {visibleWidgets.treatmentRevenue && (
          <div className="md:col-span-2 lg:col-span-1">
            <TreatmentRevenueChart
              data={treatmentData}
              loading={loading.treatments}
              refreshing={refreshing.treatments}
              breakpoint={breakpoint}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-4">
        {visibleWidgets.chairLoad && (
          <div className="md:col-span-2">
            <ChairLoadChart
              data={chairLoadData}
              loading={loading.chairLoad}
              refreshing={refreshing.chairLoad}
              breakpoint={breakpoint}
            />
          </div>
        )}
        {visibleWidgets.receivables && (
          <div className="md:col-span-2 lg:col-span-1">
            <ReceivablesAgeChart
              data={receivablesData}
              loading={loading.receivables}
              refreshing={refreshing.receivables}
              breakpoint={breakpoint}
              onOpenDetail={() => openMetricByKey('outstanding')}
            />
          </div>
        )}
      </div>

      {selectedMetric && (
        <KpiDetailDrawer
          card={selectedMetric}
          endpoint="/dashboard/kpi-detail"
          onClose={closeMetric}
        />
      )}

      <SetupGateModal open={showWelcome} onClose={() => setShowWelcome(false)} />

      <SupportMenu onOpenAssistant={() => setShowAssistant(true)} />
      <AssistantPanel open={showAssistant} onClose={() => setShowAssistant(false)} />
    </div>
  );
};

export default Dashboard;
