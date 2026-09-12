import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../../shared/constants/colors';
import { GearLoader } from '../../../shared/components/GearLoader';
import { notify } from '../../../shared/utils/notify';
import { formatDisplayDate, formatMinutes } from '../../../shared/utils/datetime';
import { useAuth } from '../../../app/AuthContext';
import {
  attendanceApiService, AttendanceMonth, ClockStatus,
} from '../../../services/api/attendance.api';
import { MonthCalendar } from '../components/MonthCalendar';
import { DAY_TONE, cellKind, isRecorded } from '../attendanceDays';
import { DaySheet } from '../components/DaySheet';

/**
 * Your own attendance, month by month.
 *
 * It reads `/attendance/calendar`, the same loader behind the owner's grid, so
 * a day cannot say one thing here and another there. The server scopes it to
 * the person asking unless they have been given the Attendance permission.
 *
 * The old version was three coloured boxes and a flat list of the last thirty
 * shifts: no month, no hours, and no way to see what one day actually held.
 */

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthName = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};
const localISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const EmployeeAttendanceScreen: React.FC<any> = ({ navigation }) => {
  const { backendUser } = useAuth();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [data, setData] = useState<AttendanceMonth | null>(null);
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const today = localISO(new Date());
  const thisMonth = monthKey(new Date());

  const load = useCallback(async (key: string, isRefresh = false) => {
    if (!backendUser?.id) return;
    if (!isRefresh) setLoading(true);
    try {
      setData(await attendanceApiService.getMonth(key, Number(backendUser.id)));
    } catch (e) {
      notify.problem(e, "We couldn't load your attendance");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [backendUser?.id]);

  useEffect(() => { load(month); }, [month, load]);

  // Clocking in or out from here should be reflected on the way back.
  useFocusEffect(useCallback(() => {
    let alive = true;
    attendanceApiService.getStatus()
      .then((s) => { if (alive) setStatus(s); })
      .catch(() => {});
    load(month, true);
    return () => { alive = false; };
  }, [month, load]));

  const step = (by: number) => {
    const [y, m] = month.split('-').map(Number);
    const next = new Date(y, m - 1 + by, 1);
    if (monthKey(next) > thisMonth) return;      // nothing to show in the future
    setMonth(monthKey(next));
    setSelected(null);
  };

  const summary = data?.summary;
  const recorded = (data?.days || []).filter((d) => isRecorded(data?.attendance[d])).reverse();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} hitSlop={8}>
          <ChevronLeft size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>My attendance</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(month, true); }}
            tintColor={colors.primary}
          />
        }
      >
        {!status?.is_done_for_today && (
          <TouchableOpacity style={styles.clockBtn} onPress={() => navigation.navigate('ClockIn')} activeOpacity={0.85}>
            <Clock size={17} color="#FFFFFF" />
            <Text style={styles.clockBtnText}>
              {status?.is_clocked_in ? 'You are on shift · open the clock' : 'Clock in / Clock out'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.monthRow}>
          <TouchableOpacity onPress={() => step(-1)} style={styles.monthBtn} hitSlop={8} accessibilityLabel="Previous month">
            <ChevronLeft size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{monthName(month)}</Text>
          <TouchableOpacity
            onPress={() => step(1)}
            style={[styles.monthBtn, month >= thisMonth && styles.monthBtnOff]}
            hitSlop={8}
            disabled={month >= thisMonth}
            accessibilityLabel="Next month"
          >
            <ChevronRight size={18} color={month >= thisMonth ? colors.gray300 : colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {loading && !data ? (
          <View style={styles.loading}><GearLoader text="Loading your month…" /></View>
        ) : (
          <>
            <View style={styles.stats}>
              <Stat label="Present" value={String(summary?.present ?? 0)} tone={DAY_TONE.on_time.text} />
              <Stat label="Late" value={String(summary?.late ?? 0)} tone={DAY_TONE.late.text} />
              <Stat label="Absent" value={String(summary?.absent ?? 0)} tone={DAY_TONE.absent.text} />
              <Stat label="Worked" value={formatMinutes(summary?.worked_minutes ?? 0)} tone={colors.primary} />
            </View>

            <MonthCalendar
              days={data?.days || []}
              attendance={data?.attendance || {}}
              todayISO={today}
              selected={selected}
              onSelect={setSelected}
            />

            <Text style={styles.sectionTitle}>Shifts this month</Text>
            {recorded.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.empty}>
                  Nothing recorded this month. Your shifts appear here once you clock in.
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {recorded.map((day, i) => {
                  const record: any = data?.attendance[day];
                  const tone = DAY_TONE[cellKind(record)] || DAY_TONE.holiday;
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.row, i > 0 && styles.rowBorder]}
                      onPress={() => setSelected(day)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowDay}>{formatDisplayDate(day)}</Text>
                        <Text style={styles.rowTimes}>
                          {record.is_open_shift
                            ? `${record.check_in || '--'} · still on shift`
                            : `${record.check_in || '--'} to ${record.check_out || '--'}`}
                          {record.worked_minutes ? ` · ${formatMinutes(record.worked_minutes)}` : ''}
                          {record.break_minutes ? ` · ${formatMinutes(record.break_minutes)} break` : ''}
                        </Text>
                      </View>
                      <View style={[styles.chip, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.chipText, { color: tone.text }]}>{tone.label}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <DaySheet day={selected} value={selected ? data?.attendance[selected] : undefined} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
};

const Stat: React.FC<{ label: string; value: string; tone: string }> = ({ label, value, tone }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  back: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryBgLight,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  clockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 6, height: 48, borderRadius: 12, backgroundColor: colors.primary,
  },
  clockBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  monthBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderColor,
  },
  monthBtnOff: { opacity: 0.5 },
  monthText: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  loading: { paddingVertical: 60, alignItems: 'center' },
  stats: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 14,
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderColor,
    borderRadius: 14, paddingVertical: 14,
  },
  stat: { flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 2 },
  // Small enough that "73h 52m" still sits inside its quarter of the row.
  statValue: { fontSize: 17.5, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: colors.textPrimary,
    paddingHorizontal: 16, marginTop: 22, marginBottom: 10,
  },
  list: {
    marginHorizontal: 16, backgroundColor: colors.cardBg,
    borderWidth: 1, borderColor: colors.borderColor, borderRadius: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.separatorColor },
  rowDay: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowTimes: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  chipText: { fontSize: 10, fontWeight: '800' },
  emptyCard: {
    marginHorizontal: 16, backgroundColor: colors.cardBg, borderWidth: 1,
    borderColor: colors.borderColor, borderRadius: 14, padding: 20,
  },
  empty: { fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});

export default EmployeeAttendanceScreen;
