import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, RefreshControl, Linking, Platform, AppState, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft, MapPin, LogIn, LogOut, CheckCircle2, AlertTriangle, Info,
} from 'lucide-react-native';
import * as ExpoLocation from 'expo-location';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { notify } from '../../../../shared/utils/notify';
import { getFix, ensurePermission } from '../../../../shared/utils/location';
import {
  attendanceApiService, ClockStatus, OutsideGeofenceError,
} from '../../../../services/api/attendance.api';
import { formatTime } from '../../../../shared/utils/datetime';

/**
 * Clocking on and off.
 *
 * The screen has exactly four states and never guesses between them, because
 * the whole of today comes back from /attendance-mobile/status in one call:
 *
 *   ready      not started today      → Clock in
 *   on shift   started, not ended     → Clock out, with the time started
 *   done       both stamped           → a summary, no buttons
 *   blocked    location refused       → what to do about it
 *
 * The last one is the state most apps skip. Someone who tapped Deny once is
 * otherwise stuck on a screen with a button that silently does nothing, so it
 * gets its own panel and a link straight into the OS settings.
 *
 * Nothing here is optimistic. Attendance is a record of fact that an owner will
 * later read as evidence, so the button waits for the server rather than
 * showing a green tick it might have to take back.
 */

type Phase = 'loading' | 'ready' | 'working';

export const ClockInScreen: React.FC<any> = ({ navigation }) => {
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [reason, setReason] = useState('');
  // A distance refusal is an answer, not a fault, so it lives in its own panel
  // rather than flashing past as a toast.
  const [refusal, setRefusal] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setPhase('loading');
    try {
      setStatus(await attendanceApiService.getStatus());
    } catch (e) {
      notify.problem(e, 'Could not check your shift status');
    } finally {
      setPhase('ready');
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Coming back from the OS settings screen is the moment a previously refused
  // permission may have become granted, so re-check rather than leave them
  // looking at a stale "blocked" panel.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (s) => {
      if (s !== 'active' || !permissionBlocked) return;
      const perms = await ExpoLocation.getForegroundPermissionsAsync().catch(() => null);
      if (perms?.granted) { setPermissionBlocked(false); setRefusal(''); }
    });
    return () => sub.remove();
  }, [permissionBlocked]);

  const punch = async (direction: 'in' | 'out') => {
    setRefusal('');
    setPhase('working');
    try {
      const allowed = await ensurePermission();
      if (!allowed) { setPermissionBlocked(true); return; }

      const fix = await getFix();
      if (!fix) {
        setRefusal(
          "We couldn't get a location fix. Step near a window or outside and try again, " +
          'or ask your clinic owner to record this shift for you.'
        );
        return;
      }

      if (direction === 'in') await attendanceApiService.clockIn(fix, reason);
      else await attendanceApiService.clockOut(fix);

      setReason('');
      setStatus(await attendanceApiService.getStatus());
    } catch (e: any) {
      // "You look about 412 m from the clinic" is the server answering the
      // question, not something going wrong. It belongs on the screen.
      if (e instanceof OutsideGeofenceError || e?.outsideGeofence) setRefusal(e.message);
      else notify.problem(e, direction === 'in' ? 'Could not clock you in' : 'Could not clock you out');
    } finally {
      setPhase('ready');
    }
  };

  if (phase === 'loading' && !status) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header navigation={navigation} />
        <View style={styles.center}><GearLoader text="Checking your shift…" /></View>
      </SafeAreaView>
    );
  }

  const onShift = !!status?.is_clocked_in;
  const done = !!status?.is_done_for_today;
  const busy = phase === 'working';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header navigation={navigation} />

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
      >
        {/* Where the day stands */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, onShift && styles.heroIconOn, done && styles.heroIconDone]}>
            {done ? <CheckCircle2 size={34} color="#059669" />
              : onShift ? <LogOut size={34} color="#D97706" />
                : <LogIn size={34} color="#29828a" />}
          </View>

          <Text style={styles.heroTitle}>
            {done ? "That's your day" : onShift ? 'You are on shift' : 'Ready when you are'}
          </Text>

          <Text style={styles.heroSub}>
            {done
              ? `In at ${formatTime(status?.clock_in_time)} · out at ${formatTime(status?.clock_out_time)}`
              : onShift
                ? `Started at ${formatTime(status?.clock_in_time)}`
                : 'Clock in when you arrive at the clinic'}
          </Text>

          {onShift && status?.clock_in_distance_m != null && (
            <Text style={styles.heroMeta}>
              {status.clock_in_distance_m <= 50
                ? 'Checked in at the clinic'
                : `Checked in ${Math.round(status.clock_in_distance_m)} m from the clinic`}
            </Text>
          )}
        </View>

        {/* Why a refusal happened, in the space where it happened */}
        {!!refusal && (
          <View style={styles.panelWarn}>
            <AlertTriangle size={16} color="#D97706" />
            <Text style={styles.panelWarnText}>{refusal}</Text>
          </View>
        )}

        {/* The state most apps forget */}
        {permissionBlocked && (
          <View style={styles.panelWarn}>
            <MapPin size={16} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.panelWarnText}>
                MolarPlus needs your location to record where you clocked in. It is read only when
                you tap, never in the background.
              </Text>
              <TouchableOpacity onPress={() => Linking.openSettings()} style={styles.linkBtn}>
                <Text style={styles.linkBtnText}>
                  Open {Platform.OS === 'ios' ? 'Settings' : 'app settings'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Never imply a fence that is not there */}
        {status && !status.geofence_set && (
          <View style={styles.panelInfo}>
            <Info size={16} color="#2563EB" />
            <Text style={styles.panelInfoText}>
              Your clinic has not set its location yet, so clocking in is allowed from anywhere. The
              owner can set it in Clinic Settings.
            </Text>
          </View>
        )}

        {/* Asked before the clock-in, not after, so the answer lands on the
            record it explains. Only when the server says today's arrival is
            already past opening: no configured hours means no prompt, and the
            benefit of the doubt goes to whoever turned up. */}
        {!done && !onShift && status?.late_now && (
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
            <Text style={styles.reasonHint}>
              Saved with today's record. You can clock in without it.
            </Text>
          </View>
        )}

        {/* The action */}
        {!done && (
          <TouchableOpacity
            onPress={() => punch(onShift ? 'out' : 'in')}
            disabled={busy}
            activeOpacity={0.85}
            style={[styles.cta, onShift ? styles.ctaOut : styles.ctaIn, busy && styles.ctaBusy]}
          >
            {busy
              ? <ActivityIndicator color="#fff" />
              : <>
                  {onShift ? <LogOut size={20} color="#fff" /> : <LogIn size={20} color="#fff" />}
                  <Text style={styles.ctaText}>{onShift ? 'Clock out' : 'Clock in'}</Text>
                </>}
          </TouchableOpacity>
        )}

        {busy && (
          <Text style={styles.busyHint}>Finding where you are…</Text>
        )}

        {status?.geofence_set && !done && (
          <Text style={styles.footnote}>
            Your location is recorded at the moment you tap, so your clinic can confirm attendance.
            It is never tracked in the background.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const Header: React.FC<{ navigation: any }> = ({ navigation }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
      <ChevronLeft size={24} color="#111827" />
    </TouchableOpacity>
    <View style={{ flex: 1 }}>
      <Text style={styles.title}>My shift</Text>
      <Text style={styles.subtitle}>Clock in and out</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, backgroundColor: '#fff' },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 1 },

  body: { padding: 20, paddingBottom: 48 },

  hero: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 28, alignItems: 'center' },
  heroIcon: { width: 76, height: 76, borderRadius: 999, backgroundColor: '#29828a1A', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroIconOn: { backgroundColor: '#FEF3C7' },
  heroIconDone: { backgroundColor: '#D1FAE5' },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center' },
  heroSub: { fontSize: 14, color: '#6B7280', marginTop: 6, textAlign: 'center' },
  heroMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 10, textAlign: 'center' },

  panelWarn: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 14, marginTop: 16 },
  panelWarnText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19 },
  panelInfo: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12, padding: 14, marginTop: 16 },
  panelInfoText: { flex: 1, fontSize: 13, color: '#1E40AF', lineHeight: 19 },
  linkBtn: { marginTop: 10, alignSelf: 'flex-start' },
  linkBtnText: { fontSize: 13, fontWeight: '700', color: '#B45309' },

  reasonBox: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  reasonLabel: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 8 },
  reasonInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  reasonHint: { fontSize: 11, color: '#B45309', marginTop: 6 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 14, marginTop: 24 },
  ctaIn: { backgroundColor: '#29828a' },
  ctaOut: { backgroundColor: '#D97706' },
  ctaBusy: { opacity: 0.7 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  busyHint: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 12 },
  footnote: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 20, lineHeight: 16, paddingHorizontal: 12 },
});

export default ClockInScreen;
