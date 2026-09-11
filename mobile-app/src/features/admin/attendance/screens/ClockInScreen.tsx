import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView,
  Linking, Platform, AppState, TextInput, StatusBar, KeyboardAvoidingView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronRight, MapPin, LogIn, CheckCircle2, AlertTriangle, Info, Coffee, Timer,
} from 'lucide-react-native';
import * as ExpoLocation from 'expo-location';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { notify } from '../../../../shared/utils/notify';
import { getFix, ensurePermission, Fix } from '../../../../shared/utils/location';
import { distanceM, bearingDeg, withinFence } from '../../../../shared/utils/geo';
import {
  attendanceApiService, ClockStatus, OutsideGeofenceError,
} from '../../../../services/api/attendance.api';
import { formatTime, formatMinutes, parseServerTime } from '../../../../shared/utils/datetime';
import { GeofenceMap } from '../components/GeofenceMap';

/**
 * Clocking on, taking breaks, and clocking off.
 *
 * Three screens in one, chosen by where today stands, which comes back from
 * /attendance-mobile/status in a single call:
 *
 *   not started   the map full-bleed, whether you are inside the zone, Clock In
 *   on shift      the map as a card, a break button, the running shift, End Shift
 *   done          the day's summary, no buttons
 *
 * "Within zone" is shown BEFORE anybody taps, from a fix read when the screen
 * opens and every twenty seconds while it stays open. Those are one-shot reads,
 * never a subscription (see shared/utils/location.ts), and the answer is only a
 * preview: the server makes the real decision on the tap, with the same rule.
 *
 * Nothing is optimistic. Attendance is a record an owner will read as evidence,
 * so each button waits for the server rather than showing a tick it might have
 * to take back.
 */

const TEAL = '#29828a';
const REFRESH_MS = 20000;
const FRESH_FIX_MS = 30000;

type Phase = 'loading' | 'ready' | 'working';

export const ClockInScreen: React.FC<any> = ({ navigation }) => {
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState('');
  // A distance refusal is an answer, not a fault, so it gets its own panel
  // rather than flashing past as a toast.
  const [refusal, setRefusal] = useState('');
  const [now, setNow] = useState(() => new Date());
  const fixAt = useRef(0);
  // When the status was last read: a running break's total keeps counting
  // from here without asking the server every tick.
  const statusAt = useRef(Date.now());

  const load = useCallback(async () => {
    try {
      setStatus(await attendanceApiService.getStatus());
      statusAt.current = Date.now();
    } catch (e) {
      notify.problem(e, 'Could not check your shift status');
    } finally {
      setPhase('ready');
    }
  }, []);

  const locate = useCallback(async () => {
    setLocating(true);
    try {
      const allowed = await ensurePermission();
      if (!allowed) { setPermissionBlocked(true); return; }
      setPermissionBlocked(false);
      const f = await getFix();
      if (f) { setFix(f); fixAt.current = Date.now(); }
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => { load(); locate(); }, [load, locate]);

  // The clock, and the running shift and break totals, move on their own.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  // A fresh position every so often while the screen is open and in front.
  // Never in the background: the interval only fires while the app is active.
  useEffect(() => {
    const t = setInterval(() => {
      if (AppState.currentState === 'active' && !permissionBlocked) locate();
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [locate, permissionBlocked]);

  // Back from the OS settings screen is when a refused permission may have
  // become granted, so look again rather than leave a stale "blocked" panel.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (s) => {
      if (s !== 'active' || !permissionBlocked) return;
      const perms = await ExpoLocation.getForegroundPermissionsAsync().catch(() => null);
      if (perms?.granted) { setPermissionBlocked(false); setRefusal(''); locate(); }
    });
    return () => sub.remove();
  }, [permissionBlocked, locate]);

  // ── where you are against the fence ──────────────────────────────────────
  const hasFence = !!status?.geofence_set && status?.clinic_latitude != null && status?.clinic_longitude != null;
  const radius = status?.geofence_radius_m || 150;
  let dist: number | null = null;
  let bearing: number | null = null;
  let inside: boolean | null = null;
  if (hasFence && fix) {
    dist = distanceM(status!.clinic_latitude!, status!.clinic_longitude!, fix.latitude, fix.longitude);
    bearing = bearingDeg(status!.clinic_latitude!, status!.clinic_longitude!, fix.latitude, fix.longitude);
    inside = withinFence(dist, radius, fix.accuracy);
  }
  const clinicName = status?.clinic_name || 'the clinic';

  // ── actions ──────────────────────────────────────────────────────────────
  const currentFix = async (): Promise<Fix | null> => {
    if (fix && Date.now() - fixAt.current < FRESH_FIX_MS) return fix;
    const f = await getFix();
    if (f) { setFix(f); fixAt.current = Date.now(); }
    return f;
  };

  const punch = async (direction: 'in' | 'out') => {
    setRefusal('');
    setPhase('working');
    try {
      const allowed = await ensurePermission();
      if (!allowed) { setPermissionBlocked(true); return; }
      const f = await currentFix();
      if (!f) {
        setRefusal(
          "We couldn't get a location fix. Step near a window or outside and try again, " +
          'or ask your clinic owner to record this shift for you.'
        );
        return;
      }
      if (direction === 'in') await attendanceApiService.clockIn(f, reason);
      else await attendanceApiService.clockOut(f, summary);
      setReason('');
      setSummary('');
      setStatus(await attendanceApiService.getStatus());
      statusAt.current = Date.now();
    } catch (e: any) {
      // "You look about 412 m from the clinic" is the server answering the
      // question, not something going wrong. It belongs on the screen.
      if (e instanceof OutsideGeofenceError || e?.outsideGeofence) setRefusal(e.message);
      else notify.problem(e, direction === 'in' ? 'Could not clock you in' : 'Could not clock you out');
    } finally {
      setPhase('ready');
    }
  };

  const confirmEndShift = () => {
    Alert.alert(
      'End your shift?',
      status?.on_break ? 'Your break will end with it.' : 'You will be clocked out now.',
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'End shift', onPress: () => punch('out') },
      ],
    );
  };

  const toggleBreak = async () => {
    setPhase('working');
    try {
      if (status?.on_break) await attendanceApiService.endBreak();
      else await attendanceApiService.startBreak();
      setStatus(await attendanceApiService.getStatus());
      statusAt.current = Date.now();
    } catch (e) {
      notify.problem(e, 'Could not update your break');
    } finally {
      setPhase('ready');
    }
  };

  // ── render ───────────────────────────────────────────────────────────────
  if (phase === 'loading' && !status) {
    return (
      <SafeAreaView style={styles.plain} edges={['top']}>
        <PlainHeader title="Clock In" navigation={navigation} />
        <View style={styles.center}><GearLoader text="Checking your shift…" /></View>
      </SafeAreaView>
    );
  }

  const onShift = !!status?.is_clocked_in;
  const done = !!status?.is_done_for_today;
  const busy = phase === 'working';

  const started = parseServerTime(status?.clock_in_time);
  const ended = parseServerTime(status?.clock_out_time);
  const shiftMinutes = started ? ((ended || now).getTime() - started.getTime()) / 60000 : 0;
  const breakStart = parseServerTime(status?.break_started_at);
  const breakMinutes = (status?.break_minutes || 0) +
    (status?.on_break ? Math.max(0, now.getTime() - statusAt.current) / 60000 : 0);
  const thisBreakMinutes = breakStart ? (now.getTime() - breakStart.getTime()) / 60000 : 0;

  const panels = (
    <>
      {!!refusal && (
        <View style={styles.panelWarn}>
          <AlertTriangle size={16} color="#D97706" />
          <Text style={styles.panelWarnText}>{refusal}</Text>
        </View>
      )}
      {permissionBlocked && (
        <View style={styles.panelWarn}>
          <MapPin size={16} color="#D97706" />
          <View style={{ flex: 1 }}>
            <Text style={styles.panelWarnText}>
              MolarPlus needs your location to show where you are against the clinic and to record
              where you clocked in. It is read only while this screen is open, never in the background.
            </Text>
            <TouchableOpacity onPress={() => Linking.openSettings()} style={styles.linkBtn}>
              <Text style={styles.linkBtnText}>Open {Platform.OS === 'ios' ? 'Settings' : 'app settings'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );

  // ── not started: the map, full-bleed ─────────────────────────────────────
  if (!onShift && !done) {
    return (
      <View style={styles.heroScreen}>
        <StatusBar barStyle="light-content" backgroundColor={TEAL} />
        <SafeAreaView edges={['top']} style={styles.tealHeader}>
          <View style={styles.tealHeaderRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
              <ChevronLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.tealTitle}>Clock In</Text>
          </View>
        </SafeAreaView>

        <GeofenceMap
          variant="hero"
          hasFence={hasFence}
          radiusM={radius}
          distanceM={dist}
          bearingDeg={bearing}
          inside={inside}
          locating={locating}
          onLocate={locate}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled" bounces={false}>
              <ZoneCard
                hasFence={hasFence}
                inside={inside}
                distance={dist}
                locating={locating && !fix}
                clinicName={clinicName}
              />

              {panels}

              {/* Asked before the clock-in, not after, so the answer lands on
                  the record it explains. Only when the server says arriving now
                  is past opening; no hours set means no prompt. */}
              {status?.late_now && (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>
                    You are {status.late_by_minutes} minutes past opening. What happened?
                  </Text>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    maxLength={280}
                    placeholder="Traffic, a delayed train, anything"
                    placeholderTextColor="#9CA3AF"
                    style={styles.reasonInput}
                  />
                  <Text style={styles.reasonHint}>Saved with today's record. You can clock in without it.</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={() => punch('in')}
                disabled={busy}
                activeOpacity={0.85}
                style={[styles.primaryBtn, busy && styles.btnBusy]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <LogIn size={20} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Clock In Now</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.nowText}>
                Current Time: <Text style={styles.nowStrong}>{formatTime(now.toISOString())}</Text>
              </Text>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── on shift, or done for the day ────────────────────────────────────────
  const chip = hasFence ? (
    inside === null ? (
      <View style={[styles.chip, styles.chipMuted]}><Text style={styles.chipMutedText}>Finding you…</Text></View>
    ) : inside ? (
      <View style={styles.chip}>
        <CheckCircle2 size={13} color={TEAL} />
        <Text style={styles.chipText}>Within Geofence Zone</Text>
      </View>
    ) : (
      <View style={[styles.chip, styles.chipWarn]}>
        <AlertTriangle size={13} color="#B45309" />
        <Text style={styles.chipWarnText}>{`${Math.round(dist || 0)} m from the clinic`}</Text>
      </View>
    )
  ) : null;

  return (
    <SafeAreaView style={styles.plain} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6F8" />
      <PlainHeader title={done ? "Today's Shift" : 'End Shift'} navigation={navigation} centered />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {!done && (
            <>
              <GeofenceMap
                variant="card"
                hasFence={hasFence}
                radiusM={radius}
                distanceM={dist}
                bearingDeg={bearing}
                inside={inside}
                locating={locating}
                onLocate={locate}
                overlay={chip}
              />
              <View style={styles.verifiedRow}>
                <MapPin size={13} color="#6B7280" />
                <Text style={styles.verifiedText}>
                  {!hasFence
                    ? 'Clinic location not set, so clocking out is allowed from anywhere'
                    : inside
                      ? `Location Verified: ${clinicName}`
                      : status?.clock_in_distance_m != null
                        ? `Clocked in ${Math.round(status.clock_in_distance_m)} m from ${clinicName}`
                        : clinicName}
                </Text>
              </View>

              {panels}

              {/* A break, not a clock-out: ending the shift is the bar at the
                  bottom, and two buttons that both end it would be one too many. */}
              <TouchableOpacity
                onPress={toggleBreak}
                disabled={busy}
                activeOpacity={0.85}
                style={[styles.primaryBtn, status?.on_break && styles.breakOnBtn, busy && styles.btnBusy]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : status?.on_break ? (
                  <>
                    <Timer size={20} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>End Break · {formatMinutes(thisBreakMinutes)}</Text>
                  </>
                ) : (
                  <>
                    <Coffee size={20} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Take a Break</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.shiftHead}>
            <Text style={styles.shiftTitle}>{done ? 'Your Day' : 'Current Shift'}</Text>
            {!!started && (
              <Text style={styles.shiftStarted}>
                {done && ended
                  ? `${formatTime(status?.clock_in_time)} to ${formatTime(status?.clock_out_time)}`
                  : `Started at ${formatTime(status?.clock_in_time)}`}
              </Text>
            )}
          </View>

          <View style={styles.shiftCard}>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>TOTAL DURATION</Text>
                <Text style={[styles.statValue, { color: TEAL }]}>{formatMinutes(shiftMinutes)}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statLabel}>TOTAL BREAKS</Text>
                <Text style={styles.statValue}>{formatMinutes(breakMinutes)}</Text>
              </View>
            </View>
            {status?.on_break && !!breakStart && (
              <Text style={styles.onBreakText}>On break since {formatTime(status?.break_started_at)}</Text>
            )}

            {!done ? (
              <>
                <Text style={styles.summaryLabel}>Shift Summary</Text>
                <TextInput
                  value={summary}
                  onChangeText={setSummary}
                  multiline
                  maxLength={2000}
                  placeholder="Add a brief summary of your shift (optional)…"
                  placeholderTextColor="#9CA3AF"
                  style={styles.summaryInput}
                  textAlignVertical="top"
                />
              </>
            ) : (
              <View style={styles.doneRow}>
                <CheckCircle2 size={18} color="#059669" />
                <Text style={styles.doneText}>That's your day. See you next shift.</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {!done && (
          <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
            <TouchableOpacity
              onPress={confirmEndShift}
              disabled={busy}
              activeOpacity={0.85}
              style={[styles.endBtn, busy && styles.btnBusy]}
            >
              <Text style={styles.endBtnText}>End Shift</Text>
              <ChevronRight size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </SafeAreaView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ── pieces ──────────────────────────────────────────────────────────────────

const ZoneCard: React.FC<{
  hasFence: boolean; inside: boolean | null; distance: number | null; locating: boolean; clinicName: string;
}> = ({ hasFence, inside, distance, locating, clinicName }) => {
  // Never imply a fence that is not there.
  if (!hasFence) {
    return (
      <View style={[styles.zone, styles.zoneInfo]}>
        <View style={[styles.zoneIcon, { backgroundColor: '#2563EB' }]}><Info size={18} color="#FFFFFF" /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.zoneTitle, { color: '#1E3A8A' }]}>Clinic location not set</Text>
          <Text style={[styles.zoneSub, { color: '#1D4ED8' }]}>
            You can clock in from anywhere. The owner sets it in Clinic Settings.
          </Text>
        </View>
      </View>
    );
  }
  if (inside === null) {
    return (
      <View style={[styles.zone, styles.zoneMuted]}>
        <View style={[styles.zoneIcon, { backgroundColor: '#9CA3AF' }]}>
          {locating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MapPin size={18} color="#FFFFFF" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.zoneTitle, { color: '#374151' }]}>{locating ? 'Finding you…' : 'Location unknown'}</Text>
          <Text style={[styles.zoneSub, { color: '#6B7280' }]}>Checking where you are against {clinicName}.</Text>
        </View>
      </View>
    );
  }
  if (inside) {
    return (
      <View style={[styles.zone, styles.zoneOk]}>
        <View style={[styles.zoneIcon, { backgroundColor: '#10B981' }]}><CheckCircle2 size={18} color="#FFFFFF" /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.zoneTitle, { color: '#065F46' }]}>Within Zone</Text>
          <Text style={[styles.zoneSub, { color: '#047857' }]}>Ready to clock in at {clinicName}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.zone, styles.zoneWarn]}>
      <View style={[styles.zoneIcon, { backgroundColor: '#D97706' }]}><AlertTriangle size={18} color="#FFFFFF" /></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.zoneTitle, { color: '#92400E' }]}>Outside the Zone</Text>
        <Text style={[styles.zoneSub, { color: '#B45309' }]}>
          You are about {Math.round(distance || 0)} m from {clinicName}. Move closer to clock in.
        </Text>
      </View>
    </View>
  );
};

const PlainHeader: React.FC<{ title: string; navigation: any; centered?: boolean }> = ({ title, navigation, centered }) => (
  <View style={styles.plainHeader}>
    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBack} hitSlop={8}>
      <ChevronLeft size={22} color={TEAL} />
    </TouchableOpacity>
    <Text style={[styles.plainTitle, centered && styles.plainTitleCentered]}>{title}</Text>
    {centered && <View style={{ width: 38 }} />}
  </View>
);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // not started
  heroScreen: { flex: 1, backgroundColor: '#FFFFFF' },
  tealHeader: { backgroundColor: TEAL },
  tealHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14 },
  backBtn: { padding: 6, marginRight: 6 },
  tealTitle: { fontSize: 19, fontWeight: '800', color: '#FFFFFF' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
  },
  sheetBody: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },

  zone: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  zoneOk: { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' },
  zoneWarn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  zoneInfo: { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' },
  zoneMuted: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  zoneIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  zoneTitle: { fontSize: 15, fontWeight: '800' },
  zoneSub: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },

  primaryBtn: {
    height: 58,
    borderRadius: 16,
    backgroundColor: TEAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  breakOnBtn: { backgroundColor: '#B45309' },
  btnBusy: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  nowText: { textAlign: 'center', marginTop: 14, fontSize: 13, color: '#6B7280' },
  nowStrong: { fontWeight: '800', color: '#374151' },

  // on shift
  plain: { flex: 1, backgroundColor: '#F4F6F8' },
  plainHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  roundBack: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#E6F1F2',
    alignItems: 'center', justifyContent: 'center',
  },
  plainTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginLeft: 12 },
  plainTitleCentered: { flex: 1, textAlign: 'center', marginLeft: 0 },
  body: { padding: 16, paddingBottom: 32 },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#CDEBEC', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  chipText: { fontSize: 11.5, fontWeight: '700', color: TEAL },
  chipWarn: { backgroundColor: '#FEF3C7' },
  chipWarnText: { fontSize: 11.5, fontWeight: '700', color: '#B45309' },
  chipMuted: { backgroundColor: 'rgba(255,255,255,0.9)' },
  chipMutedText: { fontSize: 11.5, fontWeight: '700', color: '#6B7280' },

  verifiedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, marginBottom: 18 },
  verifiedText: { fontSize: 12, color: '#6B7280' },

  shiftHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 26, marginBottom: 10 },
  shiftTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  shiftStarted: { fontSize: 13, fontWeight: '600', color: TEAL },
  shiftCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#EEF0F2' },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1 },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: '#E5E7EB', marginHorizontal: 16 },
  statLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.6 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#111827', marginTop: 4 },
  onBreakText: { marginTop: 10, fontSize: 12.5, color: '#B45309', fontWeight: '600' },
  summaryLabel: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 20, marginBottom: 8 },
  summaryInput: {
    minHeight: 84, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#111827', backgroundColor: '#FAFAFA',
  },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  doneText: { fontSize: 14, color: '#065F46', fontWeight: '600' },

  bottomBar: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: '#F4F6F8', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  endBtn: {
    height: 54, borderRadius: 14, backgroundColor: TEAL, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  endBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // shared panels
  panelWarn: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    padding: 12, borderRadius: 12, marginBottom: 14,
  },
  panelWarnText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
  linkBtn: { marginTop: 8 },
  linkBtnText: { fontSize: 13, fontWeight: '700', color: '#B45309' },
  reasonBox: { marginBottom: 14 },
  reasonLabel: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 6 },
  reasonInput: {
    borderWidth: 1, borderColor: '#FCD34D', backgroundColor: '#FFFBEB',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827',
  },
  reasonHint: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
});

export default ClockInScreen;
