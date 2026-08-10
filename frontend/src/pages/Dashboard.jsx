import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import WelcomeChecklistModal from '../components/WelcomeChecklistModal';
import { useBreakpoint } from '../utils/useBreakpoint';

import { useDashboardData } from './dashboard/useDashboardData';
import DashboardHeader from './dashboard/DashboardHeader';
import QuickActions from './dashboard/QuickActions';
import MetricCard from '../components/common/MetricCard';
import TodayPanel from './dashboard/TodayPanel';
import PatientStatsChart from './dashboard/charts/PatientStatsChart';
import DemographicsChart from './dashboard/charts/DemographicsChart';
import RevenueChart from './dashboard/charts/RevenueChart';
import AppointmentTrendsChart from './dashboard/charts/AppointmentTrendsChart';
import MetricDetailDrawer from './dashboard/MetricDetailDrawer';
import AssistantPanel from './dashboard/AssistantPanel';
import SupportMenu from './dashboard/SupportMenu';

const Dashboard = () => {
  const { user } = useAuth();
  const ownerName = (user?.first_name || user?.name || '').split(' ')[0] || '';
  const breakpoint = useBreakpoint();

  const {
    globalPeriod, setGlobalPeriod,
    metrics,
    patientStatsData, demographicsData, revenueData, appointmentData,
    loading, visibleWidgets,
    selectedMetric, drawerData, drawerLoading, openMetric, closeMetric,
    today, todayLoading,
  } = useDashboardData();

  const [showAssistant, setShowAssistant] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // One-time welcome right after onboarding (flag set by ClinicOnboarding).
  useEffect(() => {
    if (localStorage.getItem('mp_welcome_pending') === '1') {
      localStorage.removeItem('mp_welcome_pending');
      setShowWelcome(true);
    }
  }, []);

  // Reuse the KPI deltas as period-over-period captions on the matching charts.
  const deltaFor = (key) => {
    const m = metrics.find((x) => x.key === key);
    return m ? { change: m.change, changeType: m.changeType } : null;
  };

  return (
    <div className="w-full h-full min-h-screen bg-gray-50 p-3 sm:p-4 md:p-8 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      <DashboardHeader
        ownerName={ownerName}
        period={globalPeriod}
        onPeriodChange={setGlobalPeriod}
      />

      <QuickActions />

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

      {/*
        Charts.
          phone   one per row
          tablet  one per row, full width — 768px splits into two 360px columns,
                  which is under the width a bar chart or a donut-plus-legend
                  needs, and pairing them left half-empty rows besides
          >=lg    2/3 + 1/3, a wide chart beside a narrow one
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
        {visibleWidgets.patientStats && (
          <div className="md:col-span-2">
            <PatientStatsChart
              data={patientStatsData}
              loading={loading.patientStats}
              delta={deltaFor('patients')}
              breakpoint={breakpoint}
            />
          </div>
        )}
        {visibleWidgets.demographics && (
          <div className="md:col-span-2 lg:col-span-1">
            <DemographicsChart
              data={demographicsData}
              loading={loading.demographics}
              breakpoint={breakpoint}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-4">
        {visibleWidgets.revenue && (
          <div className="md:col-span-2">
            <RevenueChart
              data={revenueData}
              loading={loading.revenue}
              delta={deltaFor('revenue')}
              breakpoint={breakpoint}
            />
          </div>
        )}
        {visibleWidgets.appointments && (
          <div className="md:col-span-2 lg:col-span-1">
            <AppointmentTrendsChart
              data={appointmentData}
              loading={loading.appointments}
              delta={deltaFor('appointments')}
              breakpoint={breakpoint}
            />
          </div>
        )}
      </div>

      <MetricDetailDrawer
        metric={selectedMetric}
        data={drawerData}
        loading={drawerLoading}
        period={globalPeriod}
        onClose={closeMetric}
      />

      <WelcomeChecklistModal open={showWelcome} onClose={() => setShowWelcome(false)} />

      <SupportMenu onOpenAssistant={() => setShowAssistant(true)} />
      <AssistantPanel open={showAssistant} onClose={() => setShowAssistant(false)} />
    </div>
  );
};

export default Dashboard;
