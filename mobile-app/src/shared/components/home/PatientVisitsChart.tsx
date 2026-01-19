import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
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
    let change = '+0%';
    if (chartData.data.length > 1) {
      const previousTotal = chartData.data.slice(0, -1).reduce((sum, value) => sum + value, 0);
      const currentTotal = chartData.data[chartData.data.length - 1];
      const previousAvg = previousTotal / (chartData.data.length - 1);
      
      if (previousAvg > 0) {
        const changePercent = ((currentTotal - previousAvg) / previousAvg) * 100;
        change = changePercent >= 0 ? `+${changePercent.toFixed(1)}%` : `${changePercent.toFixed(1)}%`;
      }
    }
    
    return { total, change };
  };
  
  const { total: totalVisits, change: percentageChange } = calculateRealMetrics();

  return (
    <View style={styles.chartSection}>
      <View style={styles.chartTitleRow}>
        <Text style={styles.chartTitle}>Patient Visits</Text>
      </View>
      
      <View style={styles.chartHeader}>
        <View style={styles.chartHeaderLeft}>
          <Text style={styles.chartValue}>{totalVisits.toLocaleString()}</Text>
          <Text style={styles.chartChange}>{percentageChange}</Text>
        </View>
      </View>

      {/* Period Tabs */}
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

      {/* Bar Chart */}
      <View style={styles.chartContainer}>
        <View style={styles.yAxisLabels}>
          <Text style={styles.yAxisLabel}>100%</Text>
          <Text style={styles.yAxisLabel}>80%</Text>
          <Text style={styles.yAxisLabel}>60%</Text>
          <Text style={styles.yAxisLabel}>40%</Text>
          <Text style={styles.yAxisLabel}>20%</Text>
          <Text style={styles.yAxisLabel}>0%</Text>
        </View>
        <View style={styles.chartArea}>
          <View style={styles.gridLines}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={styles.gridLine} />
            ))}
          </View>
          <View style={styles.barsContainer}>
            {chartData.hasData && chartData.data.length > 0 ? (
              chartData.data.map((value, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.barWrapper}
                  onPress={() => setSelectedBar(selectedBar === index ? null : index)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${(value / maxVisits) * 100}%`,
                        backgroundColor: selectedBar === index ? colors.primary : colors.primaryBgLight,
                      },
                    ]}
                  />
                  {selectedBar === index && (
                    <View style={styles.barTooltip}>
                      <Text style={styles.barTooltipText}>{value} visits</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              // Empty bars - always show based on labels
              chartData.labels.map((_, index) => (
                <View key={index} style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      styles.emptyBar
                    ]}
                  />
                </View>
              ))
            )}
          </View>
        </View>
      </View>

      {/* X-axis labels - always show */}
      <View style={styles.xAxisLabels}>
        {chartData.labels.map((label, index) => (
          <Text key={index} style={styles.xAxisLabel}>
            {label}
          </Text>
        ))}
      </View>

      {/* Dropdown Modal */}
      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDropdown(false)}
        >
          <View style={styles.dropdownContainer}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Select Period</Text>
            </View>
            {(['Week', 'Month', 'Year'] as const).map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.dropdownOption,
                  selectedPeriod === period && styles.dropdownOptionActive
                ]}
                onPress={() => {
                  onPeriodChange(period);
                  setShowDropdown(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dropdownOptionText,
                  selectedPeriod === period && styles.dropdownOptionTextActive
                ]}>
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  chartSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartTitleRow: {
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  chartHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  chartValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#111827',
    marginRight: 8,
  },
  chartChange: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  chartSubtitle: {
    fontSize: 14,
    color: colors.gray500,
    marginBottom: 24,
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodTabActive: {
    backgroundColor: '#7C3AED',
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  periodTabTextActive: {
    color: '#FFFFFF',
  },
  // Dropdown styles
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    marginRight: 4,
  },
  dropdownIcon: {
    // Animation handled by state change
  },
  dropdownIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    backgroundColor: colors.white,
    borderRadius: 12,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    textAlign: 'center',
  },
  dropdownOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray50,
  },
  dropdownOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  dropdownOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray700,
    textAlign: 'center',
  },
  dropdownOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  chartContainer: {
    flexDirection: 'row',
    height: 180,
    marginBottom: 12,
  },
  yAxisLabels: {
    justifyContent: 'space-between',
    paddingRight: 12,
    paddingVertical: 4,
  },
  yAxisLabel: {
    fontSize: 11,
    color: colors.gray400,
  },
  chartArea: {
    flex: 1,
    position: 'relative',
  },
  gridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  gridLine: {
    height: 1,
    backgroundColor: colors.gray200,
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    position: 'relative',
  },
  bar: {
    width: '70%',
    borderRadius: 4,
  },
  emptyBar: {
    width: '70%',
    borderRadius: 4,
    backgroundColor: colors.gray200,
  },
  barTooltip: {
    position: 'absolute',
    top: -30,
    left: '50%',
    transform: [{ translateX: -30 }],
    backgroundColor: colors.gray900,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  barTooltipText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: '600',
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    marginLeft: 40,
  },
  xAxisLabel: {
    fontSize: 11,
    color: colors.gray500,
    flex: 1,
    textAlign: 'center',
  },
  emptyChartContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  emptyChartText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray600,
    marginBottom: 4,
  },
  emptyChartSubtext: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
  },
});