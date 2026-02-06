import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
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
  const { width } = useWindowDimensions();
  const paddingHorizontal = 20;
  const availableWidth = width - paddingHorizontal * 2;
  const cellSize = Math.floor(availableWidth / 7);

  const handleDayPress = (dayInfo: CalendarDay) => {
    if (dayInfo.type === 'day' && dayInfo.date) {
      onDateSelect(dayInfo.date);
    }
  };

  const isDay = (d: CalendarDay) => d.type === 'day';
  const isEmpty = (d: CalendarDay) => d.type === 'empty';

  return (
    <View style={styles.calendar}>
      {/* Day Headers */}
      <View style={styles.dayHeaders}>
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
          <Text key={day} style={[styles.dayHeader, { width: cellSize, textAlign: 'center' as const }]}>{day}</Text>
        ))}
      </View>

      {/* Calendar Days */}
      <View style={[styles.calendarGrid, { width: availableWidth }]}>
        {calendarDays.map((dayInfo, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.calendarDay,
              { width: cellSize, height: cellSize },
              dayInfo.isSelected && styles.calendarDaySelected,
              dayInfo.isToday && !dayInfo.isSelected && styles.calendarDayToday,
            ]}
            onPress={() => handleDayPress(dayInfo)}
            activeOpacity={isDay(dayInfo) ? 0.6 : 1}
            disabled={isEmpty(dayInfo)}
          >
            <Text style={[
              styles.calendarDayText,
              isEmpty(dayInfo) && styles.calendarDayTextEmpty,
              dayInfo.isSelected && styles.calendarDayTextSelected,
              dayInfo.isToday && !dayInfo.isSelected && styles.calendarDayTextToday,
            ]}>
              {isEmpty(dayInfo) ? '' : dayInfo.day}
            </Text>
            {dayInfo.hasAppointments && isDay(dayInfo) && (
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDaySelected: {
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 12,
  },
  calendarDayText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  calendarDayTextEmpty: {
    color: 'transparent',
  },
  calendarDayTextToday: {
    color: colors.primary,
    fontWeight: '700',
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
