import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import WelcomeChecklistModal from '../components/WelcomeChecklistModal';

import { useDashboardData } from './dashboard/useDashboardData';
import DashboardHeader from './dashboard/DashboardHeader';
import QuickActions from './dashboard/QuickActions';
import MetricCard from './dashboard/MetricCard';
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
  const deltaFor = (title) => {
    const m = metrics.find((x) => x.title === title);
    return m ? { change: m.change, changeType: m.changeType } : null;
  };

  return (
    <div className="w-full h-full min-h-screen bg-gray-50 p-4 md:p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      <DashboardHeader
        ownerName={ownerName}
        period={globalPeriod}
        onPeriodChange={setGlobalPeriod}
      />

      <QuickActions />

      {/* KPI cards — 2-up on mobile, 4-up on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6">
        {metrics.map((m) => (
          <MetricCard key={m.title} {...m} onClick={() => openMetric(m)} />
        ))}
      </div>

      {/* Today's schedule + needs-attention queue */}
      <TodayPanel data={today} loading={todayLoading} />

      {/* Charts — stack on mobile, 2/3 + 1/3 on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
        {visibleWidgets.patientStats && (
          <div className="lg:col-span-2">
            <PatientStatsChart data={patientStatsData} loading={loading.patientStats} delta={deltaFor('Total Patients')} />
          </div>
        )}
        {visibleWidgets.demographics && (
          <div className="lg:col-span-1">
            <DemographicsChart data={demographicsData} loading={loading.demographics} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
        {visibleWidgets.revenue && (
          <div className="lg:col-span-2">
            <RevenueChart data={revenueData} loading={loading.revenue} delta={deltaFor('Revenue')} />
          </div>
        )}
        {visibleWidgets.appointments && (
          <div className="lg:col-span-1">
            <AppointmentTrendsChart data={appointmentData} loading={loading.appointments} delta={deltaFor('Appointments')} />
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
