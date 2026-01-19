import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '../../../../shared/constants/colors';

interface WeekDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  isSelected: boolean;
  hasAppointments: boolean;
}

interface WeekDaysViewProps {
  weekDays: WeekDay[];
  onDateSelect: (date: Date) => void;
}

export const WeekDaysView: React.FC<WeekDaysViewProps> = ({ weekDays, onDateSelect }) => {
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      style={styles.weekScroll}
      contentContainerStyle={styles.weekScrollContent}
    >
      {weekDays.map((dayInfo, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.weekDay,
            dayInfo.isSelected && styles.weekDaySelected,
          ]}
          onPress={() => onDateSelect(dayInfo.date)}
        >
          <Text style={[
            styles.weekDayName,
            dayInfo.isSelected && styles.weekDayNameSelected,
          ]}>
            {dayInfo.dayName}
          </Text>
          <Text style={[
            styles.weekDayNumber,
            dayInfo.isSelected && styles.weekDayNumberSelected,
          ]}>
            {dayInfo.dayNumber}
          </Text>
          {dayInfo.hasAppointments && dayInfo.isSelected && (
            <View style={styles.selectedDot} />
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  weekScroll: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  weekScrollContent: {
    paddingRight: 20,
  },
  weekDay: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    minWidth: 70,
  },
  weekDaySelected: {
    backgroundColor: colors.primary,
  },
  weekDayName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  weekDayNameSelected: {
    color: '#FFFFFF',
  },
  weekDayNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  weekDayNumberSelected: {
    color: '#FFFFFF',
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginTop: 6,
  },
});
