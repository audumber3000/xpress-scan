import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { MapPin, Crosshair, CheckCircle2, AlertTriangle } from 'lucide-react-native';
import { notify } from '../../../../shared/utils/notify';
import { getFix, ensurePermission } from '../../../../shared/utils/location';
import { attendanceApiService, Geofence } from '../../../../services/api/attendance.api';

/**
 * Where the clinic is, for the attendance geofence.
 *
 * Deliberately "stand at the clinic and tap" rather than a map picker. A map
 * needs an API key, a tile bill, and a dentist who can find their own roof from
 * above; standing at reception and tapping a button needs none of that and is
 * more accurate than a dropped pin usually is. The owner is at the clinic when
 * they set this up — that is the whole premise.
 *
 * Until it is set, the backend lets every clock-in through. That is said out
 * loud on the card, because a geofence people believe in but which is not
 * actually running is worse than no geofence at all.
 */

// 10m is the tightest that behaves: phones rarely resolve better, but the
// server adds the device's own error estimate on top, so a 10m fence with a
// good fix acts like ~18m. Past a few hundred metres it stops being a geofence
// and starts being a postcode.
const RADII = [10, 50, 100, 150, 300, 500];

export const ClinicLocationCard: React.FC = () => {
  const [fence, setFence] = useState<Geofence | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [radius, setRadius] = useState(150);
  const [blocked, setBlocked] = useState(false);

  const load = useCallback(async () => {
    try {
      const g = await attendanceApiService.getGeofence();
      setFence(g);
      setRadius(g.radius_m || 150);
    } catch {
      // A card that cannot read its own setting should stay quiet rather than
      // interrupt a settings screen the owner opened for something else.
      setFence(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const useMyLocation = async () => {
    setSaving(true);
    setBlocked(false);
    try {
      if (!(await ensurePermission())) { setBlocked(true); return; }

      const fix = await getFix();
      if (!fix) {
        notify.problem('Could not get a location fix. Step near a window or outside and try again.');
        return;
      }
      // A fix this vague would put the geofence's centre further out than the
      // fence itself, which is worse than having no fence at all.
      if (fix.accuracy != null && fix.accuracy > 100) {
        notify.problem(
          `That reading is only accurate to about ${Math.round(fix.accuracy)} m. ` +
          'Try again near a window or outside so the pin lands on the clinic.'
        );
        return;
      }
      setFence(await attendanceApiService.setGeofence(fix, radius));
    } catch (e) {
      notify.problem(e, "Could not save the clinic's location");
    } finally {
      setSaving(false);
    }
  };

  const isSet = !!fence?.is_set;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, isSet && styles.iconSet]}>
          <MapPin size={18} color={isSet ? '#059669' : '#29828a'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Clinic location</Text>
          <Text style={styles.sub}>
            {loading ? 'Loading…'
              : isSet ? `Set · staff must be within ${fence?.radius_m} m to clock in`
                : 'Not set yet'}
          </Text>
        </View>
        {!loading && (
          <View style={[styles.badge, isSet ? styles.badgeOk : styles.badgeWarn]}>
            {isSet ? <CheckCircle2 size={12} color="#059669" /> : <AlertTriangle size={12} color="#D97706" />}
            <Text style={[styles.badgeText, isSet ? styles.badgeTextOk : styles.badgeTextWarn]}>
              {isSet ? 'Set' : 'Off'}
            </Text>
          </View>
        )}
      </View>

      {!loading && !isSet && (
        <View style={styles.notice}>
          <AlertTriangle size={14} color="#D97706" />
          <Text style={styles.noticeText}>
            Until this is set, staff can clock in from anywhere. Stand inside your clinic and tap
            below to fix the spot.
          </Text>
        </View>
      )}

      <Text style={styles.label}>How far from the clinic still counts</Text>
      <View style={styles.radii}>
        {RADII.map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => setRadius(r)}
            style={[styles.chip, radius === r && styles.chipOn]}
          >
            <Text style={[styles.chipText, radius === r && styles.chipTextOn]}>{r} m</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={useMyLocation}
        disabled={saving || loading}
        activeOpacity={0.85}
        style={[styles.cta, (saving || loading) && styles.ctaBusy]}
      >
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <><Crosshair size={17} color="#fff" /><Text style={styles.ctaText}>
              {isSet ? 'Update to where I am now' : "Use my current location"}
            </Text></>}
      </TouchableOpacity>

      {saving && <Text style={styles.hint}>Finding where you are…</Text>}

      {blocked && (
        <View style={styles.notice}>
          <MapPin size={14} color="#D97706" />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeText}>
              Location permission is off, so we cannot read where the clinic is.
            </Text>
            <TouchableOpacity onPress={() => Linking.openSettings()} style={{ marginTop: 8 }}>
              <Text style={styles.link}>
                Open {Platform.OS === 'ios' ? 'Settings' : 'app settings'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.footnote}>
        Stand inside the clinic when you tap. Clocking out is always allowed, wherever your staff
        are by then.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#29828a1A', alignItems: 'center', justifyContent: 'center' },
  iconSet: { backgroundColor: '#D1FAE5' },
  title: { fontSize: 14, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  badgeOk: { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' },
  badgeWarn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgeTextOk: { color: '#059669' },
  badgeTextWarn: { color: '#D97706' },

  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 10, padding: 12, marginTop: 14 },
  noticeText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },
  link: { fontSize: 12, fontWeight: '700', color: '#B45309' },

  label: { fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  radii: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#29828a', borderColor: '#29828a' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  chipTextOn: { color: '#fff' },

  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#29828a', paddingVertical: 13, borderRadius: 10, marginTop: 16 },
  ctaBusy: { opacity: 0.7 },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  hint: { textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 8 },
  footnote: { fontSize: 11, color: '#9CA3AF', marginTop: 14, lineHeight: 16 },
});

export default ClinicLocationCard;
