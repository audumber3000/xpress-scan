import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface MonthNavigationHeaderProps {
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export const MonthNavigationHeader: React.FC<MonthNavigationHeaderProps> = ({ 
  currentMonth, 
  onPrevMonth, 
  onNextMonth 
}) => {
  return (
    <View style={styles.monthHeader}>
      <TouchableOpacity onPress={onPrevMonth}>
        <Text style={styles.navArrow}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.monthTitle}>
        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </Text>
      <TouchableOpacity onPress={onNextMonth}>
        <Text style={styles.navArrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  navArrow: {
    fontSize: 28,
    color: '#6B7280',
    paddingHorizontal: 12,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});
