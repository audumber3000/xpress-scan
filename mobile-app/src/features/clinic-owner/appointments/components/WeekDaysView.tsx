import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
    <View style={styles.weekRow}>
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
          {/* Busy indicator: shown on ANY day that has appointments (white on the
              selected navy pill, primary elsewhere). Always rendered — hidden via
              opacity when empty — so the day number never shifts. */}
          <View
            style={[
              styles.dot,
              dayInfo.isSelected ? styles.dotOnSelected : styles.dotDefault,
              !dayInfo.hasAppointments && styles.dotHidden,
            ]}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 24,
    gap: 6,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
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
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  dotDefault: {
    backgroundColor: colors.primary,
  },
  dotOnSelected: {
    backgroundColor: '#FFFFFF',
  },
  dotHidden: {
    opacity: 0,
  },
});
