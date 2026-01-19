import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../../../shared/constants/colors';

interface CalendarDay {
  type: 'day' | 'empty';
  day: number;
  date: Date;
  isToday?: boolean;
  isSelected?: boolean;
  hasAppointments?: boolean;
}

interface MonthCalendarViewProps {
  calendarDays: CalendarDay[];
  onDateSelect: (date: Date) => void;
}

export const MonthCalendarView: React.FC<MonthCalendarViewProps> = ({ calendarDays, onDateSelect }) => {
  return (
    <View style={styles.calendar}>
      {/* Day Headers */}
      <View style={styles.dayHeaders}>
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
          <Text key={day} style={styles.dayHeader}>{day}</Text>
        ))}
      </View>

      {/* Calendar Days */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((dayInfo, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.calendarDay,
              dayInfo.isSelected && styles.calendarDaySelected,
            ]}
            onPress={() => dayInfo.type === 'day' && onDateSelect(dayInfo.date)}
            disabled={dayInfo.type === 'empty'}
          >
            <Text style={[
              styles.calendarDayText,
              dayInfo.type === 'empty' && styles.calendarDayTextEmpty,
              dayInfo.isSelected && styles.calendarDayTextSelected,
            ]}>
              {dayInfo.day}
            </Text>
            {dayInfo.hasAppointments && dayInfo.type === 'day' && (
              <View style={styles.appointmentDots}>
                <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  calendar: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dayHeader: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  calendarDaySelected: {
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  calendarDayText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  calendarDayTextEmpty: {
    color: '#D1D5DB',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  appointmentDots: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
