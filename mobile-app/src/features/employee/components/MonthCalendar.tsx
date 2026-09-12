import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../../shared/constants/colors';
import type { AttendanceDayCell } from '../../../services/api/attendance.api';
import { DAY_TONE, cellKind } from '../attendanceDays';

/**
 * A month of your own shifts, one cell a day. What each cell means and the
 * colour it wears live in ../attendanceDays, shared with the day sheet.
 */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface Props {
  /** Every day of the month, YYYY-MM-DD, in order (the server's `days`). */
  days: string[];
  attendance: Record<string, AttendanceDayCell>;
  todayISO: string;
  selected?: string | null;
  onSelect: (day: string) => void;
}

export const MonthCalendar: React.FC<Props> = ({ days, attendance, todayISO, selected, onSelect }) => {
  if (!days.length) return null;
  // Monday-first, so the grid lines up with the working week.
  const lead = (new Date(`${days[0]}T00:00:00`).getDay() + 6) % 7;

  return (
    <View style={styles.card}>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => <Text key={i} style={styles.weekday}>{d}</Text>)}
      </View>
      <View style={styles.grid}>
        {Array.from({ length: lead }).map((_, i) => <View key={`lead-${i}`} style={styles.cell} />)}
        {days.map((day) => {
          const kind = cellKind(attendance[day]);
          const tone = DAY_TONE[kind];
          const isToday = day === todayISO;
          const isSelected = day === selected;
          const number = Number(day.slice(8));
          return (
            <TouchableOpacity
              key={day}
              style={styles.cell}
              onPress={() => onSelect(day)}
              activeOpacity={kind === 'future' ? 1 : 0.7}
              disabled={kind === 'future'}
            >
              <View style={[
                styles.pill,
                tone ? { backgroundColor: tone.bg } : styles.pillBlank,
                isToday && styles.pillToday,
                isSelected && styles.pillSelected,
              ]}>
                <Text style={[
                  styles.dayText,
                  tone ? { color: tone.text } : null,
                  kind === 'future' && styles.dayFuture,
                ]}>
                  {number}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legend}>
        {(['on_time', 'late', 'absent', 'holiday'] as const).map((k) => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: DAY_TONE[k].bg, borderColor: DAY_TONE[k].text }]} />
            <Text style={styles.legendText}>{DAY_TONE[k].label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16, backgroundColor: colors.cardBg, borderWidth: 1,
    borderColor: colors.borderColor, borderRadius: 14, padding: 10, paddingBottom: 6,
  },
  weekRow: { flexDirection: 'row', paddingBottom: 6 },
  weekday: {
    width: `${100 / 7}%`, textAlign: 'center', fontSize: 11,
    fontWeight: '700', color: colors.textMuted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 3 },
  pill: {
    width: '100%', aspectRatio: 1, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', maxHeight: 40, maxWidth: 40,
  },
  pillBlank: { borderWidth: 1, borderColor: colors.separatorColor },
  pillToday: { borderWidth: 2, borderColor: colors.primary },
  pillSelected: { borderWidth: 2, borderColor: colors.textPrimary },
  dayText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  dayFuture: { color: colors.gray300 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3, borderWidth: 1 },
  legendText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
});

export default MonthCalendar;
