import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Rect, Circle, Line } from 'react-native-svg';

const CHART_AREA_HEIGHT = 160;

interface ChartData {
  data: number[];
  labels: string[];
  hasData: boolean;
}

interface PatientVisitsChartProps {
  chartData: ChartData;
  selectedPeriod: 'Today' | 'Last 7 Days' | 'This Month';
  onPeriodChange: (period: 'Today' | 'Last 7 Days' | 'This Month') => void;
}

const NoDataView: React.FC = () => (
  <View style={noDataStyles.container}>
    <Svg width={64} height={56} viewBox="0 0 64 56">
      {/* Chart outline */}
      <Rect x="2" y="2" width="60" height="44" rx="6" ry="6" fill="none" stroke="#E5E7EB" strokeWidth="2" strokeDasharray="4 3" />
      {/* Three ghost bars */}
      <Rect x="12" y="28" width="8" height="12" rx="2" fill="#F3F4F6" />
      <Rect x="28" y="18" width="8" height="22" rx="2" fill="#F3F4F6" />
      <Rect x="44" y="22" width="8" height="18" rx="2" fill="#F3F4F6" />
      {/* X mark on top bar */}
      <Line x1="26" y1="10" x2="38" y2="10" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="32" cy="10" r="7" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1.5" />
      <Line x1="29" y1="7" x2="35" y2="13" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="35" y1="7" x2="29" y2="13" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
      {/* Bottom axis */}
      <Line x1="2" y1="50" x2="62" y2="50" stroke="#E5E7EB" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
    <Text style={noDataStyles.title}>No data yet</Text>
    <Text style={noDataStyles.subtitle}>Patient visits will appear here</Text>
  </View>
);

const noDataStyles = StyleSheet.create({
  container: {
    height: CHART_AREA_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  title: { fontSize: 14, fontWeight: '700', color: '#6B7280', marginTop: 4 },
  subtitle: { fontSize: 12, color: '#9CA3AF' },
});

const AnimatedBar: React.FC<{
  value: number;
  maxVisits: number;
  index: number;
  isSelected: boolean;
  onPress: () => void;
  label: string;
}> = ({ value, maxVisits, index, isSelected, onPress, label }) => {
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const targetHeight = maxVisits > 0 ? Math.max(10, (value / maxVisits) * 100) : 10;

  useEffect(() => {
    animatedHeight.setValue(0);
    Animated.timing(animatedHeight, {
      toValue: targetHeight,
      duration: 600,
      delay: index * 50,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    }).start();
  }, [targetHeight, index]);

  return (
    <TouchableOpacity style={styles.barWrapper} onPress={onPress} activeOpacity={0.8}>
      <Animated.View
        style={[
          styles.bar,
          {
            height: animatedHeight.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
            backgroundColor: isSelected ? '#2E2A85' : '#E0E0F0',
          },
        ]}
      />
      <Text style={[styles.xAxisLabel, isSelected && styles.xAxisLabelActive]}>
        {(label || '').toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
};

export const PatientVisitsChart: React.FC<PatientVisitsChartProps> = ({
  chartData,
  selectedPeriod,
  onPeriodChange,
}) => {
  const [selectedBar, setSelectedBar] = useState<number | null>(null);

  const maxVisits = chartData.data.length > 0 ? Math.max(...chartData.data) : 100;
  const totalVisits = chartData.data.reduce((sum, v) => sum + v, 0);
  const displayData = chartData.data;

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
          {(['Today', 'Last 7 Days', 'This Month'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[styles.periodTab, selectedPeriod === period && styles.periodTabActive]}
              onPress={() => onPeriodChange(period)}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodTabText, selectedPeriod === period && styles.periodTabTextActive]}>
                {period === 'Today' ? 'TODAY' : period === 'Last 7 Days' ? '7 DAYS' : 'MONTH'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Chart Area — fixed height */}
      <View style={styles.chartArea}>
        {chartData.hasData && displayData.length > 0 ? (
          <View style={styles.barsContainer}>
            {displayData.map((value, index) => (
              <AnimatedBar
                key={`${selectedPeriod}-${index}`}
                value={value}
                maxVisits={maxVisits}
                index={index}
                isSelected={selectedBar === index}
                onPress={() => setSelectedBar(index)}
                label={chartData.labels[index]}
              />
            ))}
          </View>
        ) : (
          <NoDataView />
        )}
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
    marginBottom: 20,
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
    height: CHART_AREA_HEIGHT,
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
