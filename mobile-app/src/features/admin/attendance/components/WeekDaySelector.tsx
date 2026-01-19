import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { adminColors } from '../../../../shared/constants/adminColors';

interface WeekDay {
  dayName: string;
  dayNumber: number;
  isSelected: boolean;
}

interface WeekDaySelectorProps {
  weekDays: WeekDay[];
  onDaySelect: (index: number) => void;
}

export const WeekDaySelector: React.FC<WeekDaySelectorProps> = ({ weekDays, onDaySelect }) => {
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {weekDays.map((day, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.dayButton,
            day.isSelected && styles.dayButtonSelected,
          ]}
          onPress={() => onDaySelect(index)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.dayName,
            day.isSelected && styles.dayNameSelected,
          ]}>
            {day.dayName}
          </Text>
          <Text style={[
            styles.dayNumber,
            day.isSelected && styles.dayNumberSelected,
          ]}>
            {day.dayNumber}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  dayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: adminColors.primary,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  dayNameSelected: {
    color: '#FFFFFF',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  dayNumberSelected: {
    color: '#FFFFFF',
  },
});
