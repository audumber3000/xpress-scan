import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable,
} from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { colors } from '../../constants/theme';

/**
 * One time range for the whole dashboard.
 *
 * Every chart card used to carry its own Today / 7D / Month pills. They were
 * all bound to the same piece of state, so it was the same filter drawn four
 * times: change it on one card and the other three silently changed too, which
 * looks like a bug even though it was working as intended. Worse, the control
 * sat below the KPI numbers it governed, so nothing on screen said what window
 * those four figures were counting.
 *
 * This is the shape the web dashboard already uses: one control in the header,
 * driving the KPIs and every chart together (`DashboardHeader` →
 * `globalPeriod`). Same idea, phone-sized: a chip rather than a select, because
 * a three-across segmented control eats the width the KPI row needs.
 *
 * The five ranges are the server's, straight through: `today | yesterday |
 * 7days | month | all`, defined once in `_period_bounds`
 * (backend/domains/analytics/routes/dashboard.py) and used unchanged by the web
 * dashboard. The phone used to offer three, because its API client translated
 * them through a private vocabulary whose lookup table had three entries.
 */

export type { Period } from '../../../services/api/analytics.api';
import type { Period } from '../../../services/api/analytics.api';

export const PERIODS: Period[] = ['today', 'yesterday', '7days', 'month', 'all'];

/** The full name, for the menu. */
export const PERIOD_LABEL: Record<Period, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7days': 'Last 7 days',
  month: 'This month',
  all: 'All time',
};

/** Short form for the chip, which has a corner to fit into. */
const SHORT: Record<Period, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7days': '7 days',
  month: 'This month',
  all: 'All time',
};

interface Props {
  value: Period;
  onChange: (period: Period) => void;
  /** Renders light-on-dark, for the purple KPI block. */
  onDark?: boolean;
}

export const PeriodFilter: React.FC<Props> = ({ value, onChange, onDark = false }) => {
  const [open, setOpen] = useState(false);

  const chipStyle = onDark ? s.chipDark : s.chipLight;
  const textStyle = onDark ? s.chipTextDark : s.chipTextLight;
  const caret = onDark ? 'rgba(255,255,255,0.7)' : colors.gray400;

  return (
    <>
      <TouchableOpacity
        style={[s.chip, chipStyle]}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Time period: ${PERIOD_LABEL[value]}. Tap to change.`}
      >
        <Text style={[s.chipText, textStyle]}>{SHORT[value]}</Text>
        <ChevronDown size={13} color={caret} strokeWidth={2.5} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Anchored to the top right, under where the chip sits, so the menu
            reads as belonging to the chip rather than arriving from nowhere. */}
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={s.menu}>
            {PERIODS.map((period, i) => {
              const active = period === value;
              return (
                <TouchableOpacity
                  key={period}
                  style={[s.item, i > 0 && s.itemBorder]}
                  onPress={() => { onChange(period); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.itemText, active && s.itemTextActive]}>{PERIOD_LABEL[period]}</Text>
                  {active && <Check size={15} color={colors.primary} strokeWidth={3} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingLeft: 12, paddingRight: 9, paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipDark: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.24)',
  },
  chipLight: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.gray200,
  },
  chipText: { fontSize: 12.5, fontWeight: '700' },
  chipTextDark: { color: '#FFFFFF' },
  chipTextLight: { color: colors.gray700 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.28)',
    alignItems: 'flex-end',
    paddingTop: 150,
    paddingRight: 18,
  },
  menu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 4,
    minWidth: 190,
    borderWidth: 1,
    borderColor: colors.gray200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 14,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 15, paddingVertical: 13, gap: 12,
  },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.gray100 },
  itemText: { fontSize: 14, fontWeight: '600', color: colors.gray700 },
  itemTextActive: { color: colors.primary, fontWeight: '800' },
});
