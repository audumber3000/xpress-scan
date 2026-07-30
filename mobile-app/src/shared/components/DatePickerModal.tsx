import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { X } from 'lucide-react-native';
import { colors } from '../constants/colors';

interface Props {
  visible: boolean;
  value?: string;            // YYYY-MM-DD
  title?: string;
  maxDate?: string;          // YYYY-MM-DD
  minDate?: string;
  onSelect: (dateISO: string) => void;
  onClose: () => void;
}

/**
 * Lightweight calendar picker built on react-native-calendars (pure JS, no native
 * module). onDayPress returns day.dateString already in YYYY-MM-DD, matching how
 * the app stores dates.
 */
export const DatePickerModal: React.FC<Props> = ({ visible, value, title = 'Select date', maxDate, minDate, onSelect, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.title}>{title}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={8}><X size={20} color={colors.gray500} /></TouchableOpacity>
              </View>
              <Calendar
                current={value || undefined}
                maxDate={maxDate}
                minDate={minDate}
                onDayPress={(day: { dateString: string }) => { onSelect(day.dateString); onClose(); }}
                markedDates={value ? { [value]: { selected: true, selectedColor: colors.primary } } : {}}
                theme={{
                  todayTextColor: colors.primary,
                  selectedDayBackgroundColor: colors.primary,
                  selectedDayTextColor: colors.white,
                  arrowColor: colors.primary,
                  textMonthFontWeight: '700',
                  monthTextColor: colors.textPrimary,
                }}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: colors.white, borderRadius: 16, width: '100%', maxWidth: 380, overflow: 'hidden', paddingBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
});
