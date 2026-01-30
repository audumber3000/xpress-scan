import React from 'react';
import { View } from 'react-native';
import { PatientVisitsChart } from '../../../../../../shared/components/home/PatientVisitsChart';
import type { Analytics } from '../../../../../../services/api/analytics.api';
import { AppSkeleton } from '../../../../../../shared/components/Skeleton';

interface PatientVisitsSectionProps {
  analytics: Analytics | null;
  selectedPeriod: 'Week' | 'Month' | 'Year';
  onPeriodChange: (period: 'Week' | 'Month' | 'Year') => void;
  loading?: boolean;
}

// Data prep for the chart. PatientVisitsChart is not modified; it receives chartData, selectedPeriod, onPeriodChange.
function getChartData(analytics: Analytics | null, selectedPeriod: 'Week' | 'Month' | 'Year') {
  const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yearLabels = ['2021', '2022', '2023', '2024'];

  if (!analytics) return { data: [], labels: weekLabels, hasData: false };

  const patientVisitsData = analytics.patientVisits || [];

  if (patientVisitsData.length === 0) {
    let labels = weekLabels;
    switch (selectedPeriod) {
      case 'Week':
        labels = weekLabels;
        break;
      case 'Month':
        labels = monthLabels;
        break;
      case 'Year':
        labels = yearLabels;
        break;
    }
    return { data: [], labels, hasData: false };
  }

  switch (selectedPeriod) {
    case 'Week': {
      const weeklyData = patientVisitsData.slice(-7).length >= 7
        ? patientVisitsData.slice(-7)
        : patientVisitsData.slice(-Math.max(0, patientVisitsData.length));
      return {
        data: weeklyData,
        labels: weekLabels,
        hasData: weeklyData.length > 0 && weeklyData.some(v => v > 0),
      };
    }
    case 'Month': {
      const monthlyData = patientVisitsData.length >= 12
        ? patientVisitsData.slice(0, 12)
        : patientVisitsData.slice(0, Math.min(12, patientVisitsData.length));
      return {
        data: monthlyData,
        labels: monthLabels,
        hasData: monthlyData.length > 0 && monthlyData.some(v => v > 0),
      };
    }
    case 'Year': {
      const yearlyData = patientVisitsData.length >= 12
        ? [
          patientVisitsData.slice(0, 3).reduce((a, b) => a + b, 0),
          patientVisitsData.slice(3, 6).reduce((a, b) => a + b, 0),
          patientVisitsData.slice(6, 9).reduce((a, b) => a + b, 0),
          patientVisitsData.slice(9, 12).reduce((a, b) => a + b, 0),
        ]
        : [
          patientVisitsData.slice(0, Math.min(3, patientVisitsData.length)).reduce((a, b) => a + b, 0),
          patientVisitsData.slice(3, Math.min(6, patientVisitsData.length)).reduce((a, b) => a + b, 0),
          patientVisitsData.slice(6, 9).reduce((a, b) => a + b, 0),
          patientVisitsData.slice(9, Math.min(12, patientVisitsData.length)).reduce((a, b) => a + b, 0),
        ];
      return {
        data: yearlyData,
        labels: yearLabels,
        hasData: yearlyData.length > 0 && yearlyData.some(v => v > 0),
      };
    }
    default:
      return { data: [], labels: weekLabels, hasData: false };
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
