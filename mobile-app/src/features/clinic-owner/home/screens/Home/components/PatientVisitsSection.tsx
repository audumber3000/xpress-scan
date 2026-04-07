import React from 'react';
import { View } from 'react-native';
import { PatientVisitsChart } from '../../../../../../shared/components/home/PatientVisitsChart';
import type { Analytics } from '../../../../../../services/api/analytics.api';
import { AppSkeleton } from '../../../../../../shared/components/Skeleton';

interface PatientVisitsSectionProps {
  analytics: Analytics | null;
  selectedPeriod: 'Today' | 'Last 7 Days' | 'This Month';
  onPeriodChange: (period: 'Today' | 'Last 7 Days' | 'This Month') => void;
  loading?: boolean;
}

function getChartData(analytics: Analytics | null, selectedPeriod: 'Today' | 'Last 7 Days' | 'This Month') {
  if (!analytics) return { data: [], labels: [], hasData: false };

  const patientVisitsData = analytics.patientVisits || [];

  if (patientVisitsData.length === 0) {
    return { data: [], labels: [], hasData: false };
  }

  switch (selectedPeriod) {
    case 'Today': {
      const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short' });
      return {
        data: patientVisitsData,
        labels: [todayLabel],
        hasData: patientVisitsData.length > 0 && patientVisitsData.some(v => v > 0),
      };
    }
    case 'Last 7 Days': {
      const labels = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
      }
      return {
        data: patientVisitsData,
        labels: labels,
        hasData: patientVisitsData.length > 0 && patientVisitsData.some(v => v > 0),
      };
    }
    case 'This Month': {
      const labels = ['1-5', '6-10', '11-15', '16-20', '21-25', '26+'];
      return {
        data: patientVisitsData,
        labels: labels,
        hasData: patientVisitsData.length > 0 && patientVisitsData.some(v => v > 0),
      };
    }
    default:
      return { data: [], labels: [], hasData: false };
  }
}

export const PatientVisitsSection: React.FC<PatientVisitsSectionProps> = ({
  analytics,
  selectedPeriod,
  onPeriodChange,
  loading = false,
}) => {
  const chartData = getChartData(analytics, selectedPeriod);

  if (loading) {
    return (
      <View style={{ paddingHorizontal: 20 }}>
        <AppSkeleton show={true} width="100%" height={380} radius={32} />
      </View>
    );
  }

  return (
    <PatientVisitsChart
      chartData={chartData}
      selectedPeriod={selectedPeriod}
      onPeriodChange={onPeriodChange}
    />
  );
};
