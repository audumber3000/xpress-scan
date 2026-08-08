import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Pressable,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Check, X, ChevronRight } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/theme';

/**
 * How far through setting up the clinic is, as a ring in the Control Center
 * header. Tapping it opens the checklist behind the number.
 *
 * Mirrors the web build (components/admin/SetupProgress.jsx) and reads the same
 * /clinics/me/setup-status endpoint, so the two never disagree about what
 * "88% set up" means.
 *
 * Hidden at 100%: a permanent tick is furniture, and this sits in a header the
 * owner sees every time they open Control Center.
 */

export interface SetupItem {
  key: string;
  label: string;
  hint: string;
  path: string;
  done: boolean;
}

export interface SetupStatus {
  completed: number;
  total: number;
  percent: number;
  items: SetupItem[];
}

// The web routes each item points at, mapped to the mobile screens that do the
// same job. Anything without a mobile equivalent stays listed but isn't a link —
// better to say what's missing than to hide it because we can't navigate there.
const SCREEN_FOR_PATH: Record<string, string> = {
  '/admin/clinic': 'ClinicSettings',
  '/admin/treatments': 'TreatmentsPricing',
  '/admin/staff': 'StaffManagement',
  '/admin/templates-editor': 'Templates',
};

const SIZE = 44;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const ringColor = (percent: number) => {
  if (percent >= 100) return colors.success;
  if (percent >= 60) return '#FFFFFF';
  return colors.warning;
};

interface Props {
  status: SetupStatus | null;
  onNavigate: (screen: string) => void;
  onRefresh?: () => void;
}

export const SetupProgressRing: React.FC<Props> = ({ status, onNavigate, onRefresh }) => {
  const [open, setOpen] = useState(false);

  if (!status || !status.total || status.percent >= 100) return null;

  const { completed, total, percent, items = [] } = status;
  const stroke = ringColor(percent);
  const remaining = items.filter((i) => !i.done).length;

  const go = (item: SetupItem) => {
    const screen = SCREEN_FOR_PATH[item.path];
    if (!screen) return;
    setOpen(false);
    onNavigate(screen);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        accessibilityLabel={`Clinic setup ${percent} percent complete. Open checklist.`}
        style={styles.ringWrap}
      >
        <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            stroke="rgba(255,255,255,0.25)" strokeWidth={STROKE} fill="none"
          />
          <Circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            stroke={stroke} strokeWidth={STROKE} fill="none" strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
          />
        </Svg>
        <View style={styles.ringLabel}>
          <Text style={styles.ringText}>{percent}%</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Clinic setup</Text>
              <Text style={styles.sheetSub}>
                {completed} of {total} done{remaining > 0 ? ` · ${remaining} left` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${percent}%`, backgroundColor: percent >= 60 ? colors.admin : colors.warning }]} />
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Unfinished first — that's what the sheet was opened to find. */}
            {[...items].sort((a, b) => Number(a.done) - Number(b.done)).map((item) => {
              const reachable = !!SCREEN_FOR_PATH[item.path];
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => go(item)}
                  activeOpacity={reachable && !item.done ? 0.7 : 1}
                  disabled={!reachable}
                  style={styles.row}
                >
                  <View style={[styles.tick, item.done ? styles.tickDone : styles.tickTodo]}>
                    {item.done && <Check size={12} color={colors.success} strokeWidth={3} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, item.done && styles.rowLabelDone]}>{item.label}</Text>
                    {!item.done && <Text style={styles.rowHint}>{item.hint}</Text>}
                  </View>
                  {!item.done && reachable && <ChevronRight size={16} color={colors.borderColor} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {onRefresh && (
            <TouchableOpacity onPress={onRefresh} style={styles.recheck}>
              <Text style={styles.recheckText}>Re-check</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  ringWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 8, maxHeight: '78%',
  },
  grabber: {
    alignSelf: 'center', width: 38, height: 4, borderRadius: 2,
    backgroundColor: colors.borderColor, marginBottom: 8,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  sheetSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  closeBtn: { padding: 6 },

  barTrack: { height: 6, marginHorizontal: 20, borderRadius: 3, backgroundColor: colors.separatorColor, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  list: { paddingHorizontal: 12, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, paddingHorizontal: 8 },
  tick: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tickDone: { backgroundColor: colors.successLight },
  tickTodo: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.warning },
  rowLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowLabelDone: { fontWeight: '400', color: colors.textMuted, textDecorationLine: 'line-through' },
  rowHint: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },

  recheck: { alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.separatorColor },
  recheckText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
});
