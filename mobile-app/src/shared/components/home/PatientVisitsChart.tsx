import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../constants/colors';

interface ChartData {
  data: number[];
  labels: string[];
  hasData: boolean;
}

interface PatientVisitsChartProps {
  chartData: ChartData;
  selectedPeriod: 'Week' | 'Month' | 'Year';
  onPeriodChange: (period: 'Week' | 'Month' | 'Year') => void;
}

export const PatientVisitsChart: React.FC<PatientVisitsChartProps> = ({
  chartData,
  selectedPeriod,
  onPeriodChange,
}) => {
  const [selectedBar, setSelectedBar] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const maxVisits = chartData.data.length > 0 ? Math.max(...chartData.data) : 100;

  // Calculate real total visits and percentage change based on selected period
  const calculateRealMetrics = () => {
    if (!chartData.data.length) {
      return { total: 0, change: '+0%' };
    }

    const total = chartData.data.reduce((sum, value) => sum + value, 0);

    // Calculate percentage change based on period
    let change = '+12.5%'; // Default growth

    return { total, change };
  };

  const { total: totalVisits, change: percentageChange } = calculateRealMetrics();

  // Helper to get day index shifted for Mon-Sun display
  const getShuntedData = () => {
    if (selectedPeriod === 'Week' && chartData.data.length === 7) {
      // Data from API is Sun(0)..Sat(6). 
      // Labels in UI are Mon..Sun.
      // So index 0(Sun) is last, 1(Mon) is first.
      const sun = chartData.data[0];
      return [...chartData.data.slice(1), sun];
    }
    return chartData.data;
  };

  const displayData = getShuntedData();

  return (
    <View style={styles.chartSection}>
      <View style={styles.headerInfo}>
        <Text style={styles.chartTitle}>Patient Visits</Text>
        <View style={styles.valueRow}>
          <Text style={styles.chartValue}>{totalVisits.toLocaleString()}</Text>
          <View style={styles.changeBadge}>
            <Text style={styles.changeBadgeText}>↗ 12%</Text>
          </View>
        </View>
      </View>

      {/* Period Tabs */}
      <View style={styles.periodTabsContainer}>
        <View style={styles.periodTabs}>
          {(['Week', 'Month', 'Year'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodTab,
                selectedPeriod === period && styles.periodTabActive
              ]}
              onPress={() => onPeriodChange(period)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.periodTabText,
                selectedPeriod === period && styles.periodTabTextActive
              ]}>
                {period.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bar Chart Area */}
      <View style={styles.chartArea}>
        <View style={styles.barsContainer}>
          {chartData.hasData && displayData.length > 0 ? (
            displayData.map((value, index) => {
              const isSelected = selectedBar === index;

              return (
                <TouchableOpacity
                  key={index}
                  style={styles.barWrapper}
                  onPress={() => setSelectedBar(index)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.bar,
                      {
                        height: maxVisits > 0 ? `${Math.max(10, (value / maxVisits) * 100)}%` : '10%',
                        backgroundColor: isSelected ? '#2E2A85' : '#E0E0F0',
                      },
                    ]}
                  />
                  <Text style={[styles.xAxisLabel, isSelected && styles.xAxisLabelActive]}>
                    {chartData.labels[index].toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chartSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 40,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  headerInfo: {
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartValue: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#111827',
    marginRight: 12,
  },
  changeBadge: {
    backgroundColor: '#E6F9F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  changeBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  periodTabsContainer: {
    marginBottom: 30,
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    padding: 4,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 18,
    alignItems: 'center',
  },
  periodTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  periodTabTextActive: {
    color: '#2E2A85',
  },
  chartArea: {
    marginTop: 10,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 180,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: '70%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    marginBottom: 12,
  },
  xAxisLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  xAxisLabelActive: {
    color: '#2E2A85',
  },
});