import React from 'react';
import { View } from 'react-native';
import { RevenueChart } from '../../../../../../shared/components/home/RevenueChart';
import type { Analytics } from '../../../../../../services/api/analytics.api';
import { AppSkeleton } from '../../../../../../shared/components/Skeleton';

interface RevenueSectionProps {
  analytics: Analytics | null;
  selectedPeriod: 'Today' | 'Last 7 Days' | 'This Month';
  onPeriodChange: (period: 'Today' | 'Last 7 Days' | 'This Month') => void;
  loading?: boolean;
}

function getRevenueChartData(analytics: Analytics | null, selectedPeriod: 'Today' | 'Last 7 Days' | 'This Month') {
  if (!analytics) return { data: [], labels: [], hasData: false };

  // We reuse patientVisits data shape but scale it to revenue
  // Backend returns dailyRevenue as a scalar; for charting we use patientVisits counts
  // as a proxy shape and scale by revenue/totalVisits. If data comes as an array later
  // this can be swapped. For now mirror the patient visits shape.
  const visits = analytics.patientVisits || [];

  if (visits.length === 0) return { data: [], labels: [], hasData: false };

  // Scale visits array proportionally so the total equals dailyRevenue
  const totalVisits = visits.reduce((s, v) => s + v, 0);
  const revenue = analytics.dailyRevenue || 0;
  const scaleFactor = totalVisits > 0 ? revenue / totalVisits : 0;
  const revenueData = visits.map((v) => Math.round(v * scaleFactor));

  switch (selectedPeriod) {
    case 'Today': {
      const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short' });
      return {
        data: revenueData,
        labels: [todayLabel],
        hasData: revenueData.some((v) => v > 0),
      };
    }
    case 'Last 7 Days': {
      const labels: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
      }
      return {
        data: revenueData,
        labels,
        hasData: revenueData.some((v) => v > 0),
      };
    }
    case 'This Month': {
      return {
        data: revenueData,
        labels: ['1-5', '6-10', '11-15', '16-20', '21-25', '26+'],
        hasData: revenueData.some((v) => v > 0),
      };
    }
    default:
      return { data: [], labels: [], hasData: false };
  }
}

export const RevenueSection: React.FC<RevenueSectionProps> = ({
  analytics,
  selectedPeriod,
  onPeriodChange,
  loading = false,
}) => {
  const chartData = getRevenueChartData(analytics, selectedPeriod);

  if (loading) {
    return (
      <View style={{ paddingHorizontal: 20 }}>
        <AppSkeleton show={true} width="100%" height={380} radius={32} />
      </View>
    );
  }

  return (
    <RevenueChart
      chartData={chartData}
      selectedPeriod={selectedPeriod}
      onPeriodChange={onPeriodChange}
      totalRevenue={analytics?.dailyRevenue || 0}
      percentageChange={analytics?.percentageChange || '+0%'}
    />
  );
};
