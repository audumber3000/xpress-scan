import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import { colors } from '../../../shared/constants/colors';
import { formatDisplayDate, formatMinutes } from '../../../shared/utils/datetime';
import type { AttendanceDayCell } from '../../../services/api/attendance.api';
import { DAY_TONE, cellKind } from '../attendanceDays';

/**
 * One day, in full.
 *
 * Everything the record holds and nothing it does not: a day with no record
 * says so rather than showing a row of dashes that reads like a system fault.
 * Where the phone was standing is shown as a distance, because that is the part
 * a person can argue with; the coordinates would tell them nothing.
 */
const Row: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

interface Props {
  day: string | null;
  value: AttendanceDayCell | undefined;
  onClose: () => void;
}

export const DaySheet: React.FC<Props> = ({ day, value, onClose }) => {
  if (!day) return null;
  const kind = cellKind(value);
  const tone = DAY_TONE[kind];
  const record: any = value && (value as any).status ? value : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.date}>{formatDisplayDate(day)}</Text>
            {!!tone && (
              <View style={[styles.chip, { backgroundColor: tone.bg }]}>
                <Text style={[styles.chipText, { color: tone.text }]}>{tone.label}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel="Close">
            <X size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {!record ? (
          <Text style={styles.empty}>Nothing was recorded for this day.</Text>
        ) : (
          <View style={styles.body}>
            <Row label="Clocked in" value={record.check_in} />
            <Row
              label="Clocked out"
              value={record.check_out || (record.is_open_shift ? 'Still on shift' : null)}
            />
            <Row label="Worked" value={record.worked_minutes ? formatMinutes(record.worked_minutes) : null} />
            <Row label="Breaks" value={record.break_minutes ? formatMinutes(record.break_minutes) : null} />
            <Row
              label="Late by"
              value={record.late_by_minutes ? `${formatMinutes(record.late_by_minutes)} (opens ${record.expected_open})` : null}
            />
            <Row label="Reason" value={record.reason} />
            <Row label="Shift notes" value={record.notes} />
            <Row
              label="Where"
              value={record.clock_in?.distance_m != null
                ? `${Math.round(record.clock_in.distance_m)} m from the clinic`
                : null}
            />
            <Row
              label="Recorded"
              value={record.source === 'manual'
                ? `Marked by ${record.marked_by_name || 'the front desk'}`
                : 'Clocked in on the app'}
            />
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,24,39,0.35)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.cardBg, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  date: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  chip: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 },
  chipText: { fontSize: 11, fontWeight: '800' },
  close: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { marginTop: 14 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.separatorColor,
  },
  label: { width: 104, fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  value: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  empty: { fontSize: 14, color: colors.textSecondary, paddingVertical: 26, textAlign: 'center' },
});

export default DaySheet;
