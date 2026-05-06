import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Rect, Circle, Line } from 'react-native-svg';
import { getCurrencySymbol } from '../../utils/currency';

const CHART_AREA_HEIGHT = 160;
const SVG_HEIGHT = CHART_AREA_HEIGHT - 20; // room for x-axis labels below

interface ChartData {
  data: number[];
  labels: string[];
  hasData: boolean;
}

interface RevenueChartProps {
  chartData: ChartData;
  selectedPeriod: 'Today' | 'Last 7 Days' | 'This Month';
  onPeriodChange: (period: 'Today' | 'Last 7 Days' | 'This Month') => void;
  totalRevenue: number;
  percentageChange?: string;
}

const NoDataView: React.FC = () => (
  <View style={noDataStyles.container}>
    <Svg width={64} height={56} viewBox="0 0 64 56">
      {/* Chart outline */}
      <Rect x="2" y="2" width="60" height="44" rx="6" ry="6" fill="none" stroke="#E5E7EB" strokeWidth="2" strokeDasharray="4 3" />
      {/* Ghost area curve */}
      <Path d="M 4 40 C 16 36 24 20 32 24 C 40 28 48 32 60 26 L 60 46 L 4 46 Z" fill="#F3F4F6" />
      {/* Ghost line */}
      <Path d="M 4 40 C 16 36 24 20 32 24 C 40 28 48 32 60 26" fill="none" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
      {/* X mark */}
      <Circle cx="32" cy="10" r="7" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1.5" />
      <Line x1="29" y1="7" x2="35" y2="13" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="35" y1="7" x2="29" y2="13" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
      {/* Bottom axis */}
      <Line x1="2" y1="50" x2="62" y2="50" stroke="#E5E7EB" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
    <Text style={noDataStyles.title}>No data yet</Text>
    <Text style={noDataStyles.subtitle}>Revenue will appear here</Text>
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

const CHART_SVG_WIDTH = 280;

function buildAreaPath(data: number[]): { area: string; line: string } {
  if (!data || data.length === 0) return { area: '', line: '' };

  const maxVal = Math.max(...data, 1);
  const n = data.length;

  const points = data.map((v, i) => ({
    x: n === 1 ? CHART_SVG_WIDTH / 2 : (i / (n - 1)) * CHART_SVG_WIDTH,
    y: SVG_HEIGHT - (v / maxVal) * SVG_HEIGHT,
  }));

  if (points.length === 1) {
    const p = points[0];
    const line = `M 0 ${SVG_HEIGHT} L ${p.x} ${p.y} L ${CHART_SVG_WIDTH} ${SVG_HEIGHT}`;
    return { area: `${line} Z`, line: `M ${p.x} ${p.y}` };
  }

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    linePath += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
  }

  const last = points[points.length - 1];
  const first = points[0];
  const area = `${linePath} L ${last.x} ${SVG_HEIGHT} L ${first.x} ${SVG_HEIGHT} Z`;

  return { area, line: linePath };
}

export const RevenueChart: React.FC<RevenueChartProps> = ({
  chartData,
  selectedPeriod,
  onPeriodChange,
  totalRevenue,
  percentageChange = '+0%',
}) => {
  const animProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animProgress.setValue(0);
    Animated.timing(animProgress, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [chartData]);

  const { area, line } = buildAreaPath(chartData.data);
  const isPositive = !percentageChange.startsWith('-');

  return (
    <View style={styles.chartSection}>
      <View style={styles.headerInfo}>
        <Text style={styles.chartTitle}>Revenue</Text>
        <View style={styles.valueRow}>
          <Text style={styles.chartValue}>{getCurrencySymbol()}{totalRevenue.toLocaleString('en-IN')}</Text>
          <View style={[styles.changeBadge, { backgroundColor: isPositive ? '#E6F9F1' : '#FEE2E2' }]}>
            <Text style={[styles.changeBadgeText, { color: isPositive ? '#10B981' : '#EF4444' }]}>
              {isPositive ? '↗' : '↘'} {percentageChange.replace(/^[+-]/, '')}
            </Text>
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

      {/* Chart Area — fixed height matches PatientVisitsChart */}
      <View style={styles.chartArea}>
        {chartData.hasData && area ? (
          <>
            <Svg width="100%" height={SVG_HEIGHT} viewBox={`0 0 ${CHART_SVG_WIDTH} ${SVG_HEIGHT}`}>
              <Defs>
                <SvgLinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#2E2A85" stopOpacity="0.25" />
                  <Stop offset="100%" stopColor="#2E2A85" stopOpacity="0.02" />
                </SvgLinearGradient>
              </Defs>
              <Path d={area} fill="url(#areaGrad)" />
              <Path d={line} stroke="#2E2A85" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            {chartData.labels.length > 0 && (
              <View style={styles.xAxis}>
                {chartData.labels.map((label, i) => (
                  <Text key={i} style={styles.xAxisLabel} numberOfLines={1}>
                    {(label || '').toUpperCase()}
                  </Text>
                ))}
              </View>
            )}
          </>
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  changeBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
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
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 2,
    height: 20,
  },
  xAxisLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    flex: 1,
    textAlign: 'center',
  },
});
