import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { componentRadius } from '../../constants/theme';
import { AppSkeleton } from '../Skeleton';

type Period = 'Today' | 'Last 7 Days' | 'This Month';
type BadgeTone = 'neutral' | 'positive' | 'negative';

export interface MetricChartCardProps {
  title: string;
  value: string;
  badge: { text: string; tone: BadgeTone };
  chartType: 'line' | 'bar';
  /** Primary accent — line stroke / dots / bar fill base / active pill */
  color: string;
  data: number[];
  labels: string[];
  hasData: boolean;
  selectedPeriod: Period;
  onPeriodChange: (period: Period) => void;
  loading?: boolean;
  refreshing?: boolean;
  lastUpdatedAt?: Date | null;
  emptyMessage?: string;
  unitLabel?: string;
  trendSummary?: string;
  formatInspectValue?: (value: number) => string;
}

const VIEW_W = 300;
const VIEW_H = 120;
const PAD_X = 8; // keep dots/bars off the card edge

const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: '#F1F0EC', fg: '#6B7280' },
  positive: { bg: '#E6F7EF', fg: '#15924F' },
  negative: { bg: '#FCE9E9', fg: '#E5484D' },
};

function buildLinePath(data: number[]): { line: string; points: { x: number; y: number }[] } {
  const n = data.length;
  if (n === 0) return { line: '', points: [] };

  const maxVal = Math.max(...data, 1);
  const usableW = VIEW_W - PAD_X * 2;
  const points = data.map((v, i) => ({
    x: PAD_X + (n === 1 ? usableW / 2 : (i / (n - 1)) * usableW),
    y: 10 + (1 - v / maxVal) * (VIEW_H - 20),
  }));

  let line = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    line += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
  }
  return { line, points };
}

const formatUpdatedAt = (date?: Date | null) => {
  if (!date) return 'Live';
  return `Updated ${date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
};

const compactPeriodLabel = (period: Period) => {
  if (period === 'Last 7 Days') return '7D';
  if (period === 'This Month') return 'Month';
  return 'Today';
};

const defaultTrendSummary = (badgeText: string, period: Period) => {
  const baseline = period === 'Today'
    ? 'yesterday'
    : period === 'Last 7 Days'
      ? 'previous 7D'
      : 'last month';
  return `${badgeText} vs ${baseline}`;
};

const formatInspectDetail = (
  label: string | null,
  value: number | null,
  unitLabel: string,
  formatter?: (value: number) => string,
) => {
  if (label === null || value === null) return null;
  const formattedValue = formatter ? formatter(value) : value.toLocaleString();
  const unit = formatter ? unitLabel : value === 1 ? unitLabel : `${unitLabel}s`;
  return `${label} • ${formattedValue} ${unit}`;
};

const LineChart: React.FC<{
  data: number[];
  color: string;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}> = ({ data, color, selectedIndex, onSelect }) => {
  const { line, points } = buildLinePath(data);
  return (
    <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
      {/* baseline */}
      <Path d={`M ${PAD_X} ${VIEW_H - 10} L ${VIEW_W - PAD_X} ${VIEW_H - 10}`} stroke="#EEF0F2" strokeWidth={1} />
      <Path d={line} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <Circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={selectedIndex === i ? 7 : 5}
          fill={color}
          stroke="#FFFFFF"
          strokeWidth={2}
          onPress={() => onSelect(i)}
        />
      ))}
    </Svg>
  );
};

const BarChart: React.FC<{
  data: number[];
  color: string;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}> = ({ data, color, selectedIndex, onSelect }) => {
  const n = data.length || 1;
  const maxVal = Math.max(...data, 1);
  const slot = (VIEW_W - PAD_X * 2) / n;
  const barW = Math.min(slot * 0.62, 42);
  return (
    <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
      <Path d={`M ${PAD_X} ${VIEW_H - 10} L ${VIEW_W - PAD_X} ${VIEW_H - 10}`} stroke="#EEF0F2" strokeWidth={1} />
      {data.map((v, i) => {
        const h = Math.max(4, (v / maxVal) * (VIEW_H - 24));
        const x = PAD_X + i * slot + (slot - barW) / 2;
        const y = VIEW_H - 10 - h;
        return (
          <Rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={6}
            ry={6}
            fill={color}
            opacity={selectedIndex === null || selectedIndex === i ? 1 : 0.46}
            onPress={() => onSelect(i)}
          />
        );
      })}
    </Svg>
  );
};

const ChartSkeleton: React.FC = () => (
  <View style={styles.skeletonChart}>
    <View style={styles.skeletonHeader}>
      <AppSkeleton width={88} height={14} radius={4} />
      <AppSkeleton width={64} height={18} radius={9} />
    </View>
    <AppSkeleton width={150} height={42} radius={8} />
    <View style={styles.skeletonPills}>
      {[0, 1, 2].map((i) => (
        <AppSkeleton key={i} width="31%" height={42} radius={10} />
      ))}
    </View>
    <View style={styles.skeletonBars}>
      {[54, 82, 44, 96, 68, 88, 58].map((height, i) => (
        <AppSkeleton key={i} width="10%" height={height} radius={8} />
      ))}
    </View>
  </View>
);

export const MetricChartCard: React.FC<MetricChartCardProps> = ({
  title,
  value,
  badge,
  chartType,
  color,
  data,
  labels,
  hasData,
  selectedPeriod,
  onPeriodChange,
  loading = false,
  refreshing = false,
  lastUpdatedAt,
  emptyMessage = 'No data yet',
  unitLabel = 'item',
  trendSummary,
  formatInspectValue,
}) => {
  const fade = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    fade.setValue(0);
    reveal.setValue(0);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(reveal, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    setSelectedIndex(null);
  }, [data, chartType]);

  const tone = BADGE_TONES[badge.tone];
  // Bars use a soft tint of the accent; lines use the accent directly.
  const barFill = color + '38';
  const selectedLabel = selectedIndex === null ? null : labels[selectedIndex] || selectedPeriod;
  const selectedValue = selectedIndex === null ? null : data[selectedIndex] ?? 0;
  const selectedDetail = formatInspectDetail(
    selectedLabel,
    selectedValue,
    unitLabel,
    formatInspectValue,
  );
  const summary = trendSummary || defaultTrendSummary(badge.text, selectedPeriod);

  return (
    <View style={styles.card}>
      {loading ? (
        <ChartSkeleton />
      ) : (
        <>
          {/* Header: title + value + badge */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title.toUpperCase()}</Text>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, refreshing && styles.liveDotRefreshing]} />
              <Text style={styles.liveText}>
                {refreshing ? 'Updating...' : formatUpdatedAt(lastUpdatedAt)}
              </Text>
            </View>
          </View>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{value}</Text>
            <View style={[styles.badge, { backgroundColor: tone.bg }]}>
              <Text style={[styles.badgeText, { color: tone.fg }]}>{badge.text}</Text>
            </View>
          </View>
          <Text style={styles.trendSummary} numberOfLines={1}>
            {summary}
          </Text>

          {/* Period pills */}
          <View style={styles.pills}>
            {(['Today', 'Last 7 Days', 'This Month'] as const).map((period) => {
              const active = selectedPeriod === period;
              const label = compactPeriodLabel(period);
              return (
                <TouchableOpacity
                  key={period}
                  style={[styles.pill, active && { backgroundColor: color + '14', borderColor: color }]}
                  onPress={() => onPeriodChange(period)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, active && { color, fontWeight: '700' }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Chart */}
          <Animated.View
            style={[
              styles.chartArea,
              {
                opacity: fade,
                transform: [
                  {
                    scaleX: reveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {hasData ? (
              chartType === 'line' ? (
                <LineChart
                  data={data}
                  color={color}
                  selectedIndex={selectedIndex}
                  onSelect={setSelectedIndex}
                />
              ) : (
                <BarChart
                  data={data}
                  color={barFill}
                  selectedIndex={selectedIndex}
                  onSelect={setSelectedIndex}
                />
              )
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{emptyMessage}</Text>
              </View>
            )}
          </Animated.View>

          {hasData && selectedIndex !== null && (
            <TouchableOpacity
              style={[styles.inspectPill, { borderColor: color + '40', backgroundColor: color + '10' }]}
              activeOpacity={0.75}
              onPress={() => setSelectedIndex(null)}
            >
              <Text style={[styles.inspectText, { color }]}>
                {selectedDetail}
              </Text>
            </TouchableOpacity>
          )}

          {/* X-axis labels */}
          {hasData && labels.length > 0 && (
            <View style={styles.xAxis}>
              {labels.map((l, i) => (
                <Text key={i} style={styles.xLabel} numberOfLines={1}>
                  {l}
                </Text>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: componentRadius.carouselCard, // 12
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#4B5563',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveDotRefreshing: {
    backgroundColor: '#F59E0B',
  },
  liveText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  value: {
    fontSize: 38,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: componentRadius.pill, // 20
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  trendSummary: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  pills: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  pill: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: componentRadius.button, // 10 — period selector behaves like a button
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  chartArea: {
    marginTop: 22,
    height: VIEW_H,
  },
  xAxis: {
    flexDirection: 'row',
    marginTop: 10,
  },
  xLabel: {
    flex: 1,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  inspectPill: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: componentRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  inspectText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  skeletonChart: {
    gap: 16,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skeletonPills: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonBars: {
    height: VIEW_H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 2,
    opacity: 0.8,
  },
});
