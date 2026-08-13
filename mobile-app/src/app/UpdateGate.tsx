import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState, AppStateStatus, BackHandler, Linking, Modal, Platform,
  Pressable, StyleSheet, Text, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowUpCircle, X } from 'lucide-react-native';
import {
  appVersionApiService, runningVersion, UpdateAction,
} from '../services/api/appVersion.api';

/**
 * The update gate.
 *
 * Wraps the whole app, above the navigator and outside any screen, because a
 * build we have decided is unsafe must not be usable anywhere in it — including
 * the login screen, which is often the part that breaks first when an old
 * client meets a changed backend.
 *
 * Two strengths:
 *   force — a wall. No close button, no backdrop tap, hardware back trapped.
 *   nudge — a card you can dismiss, then quiet for three days.
 *
 * It fails open at every level. The API layer swallows its own errors and
 * returns 'none'; this component only ever puts a wall up on an explicit
 * 'force'. Locking a clinic out of its own patient list because our server
 * hiccupped would be a far worse bug than the stale build we were chasing.
 */

const SNOOZE_KEY = 'update_nudge_snoozed_until';
const SNOOZE_MS = 72 * 60 * 60 * 1000;      // three days
const RECHECK_MS = 30 * 60 * 1000;          // don't re-ask on every glance

export const UpdateGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [action, setAction] = useState<UpdateAction>('none');
  const [message, setMessage] = useState<string | null>(null);
  const [storeUrl, setStoreUrl] = useState<string | null>(null);
  const [latest, setLatest] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    if (Date.now() - lastCheck.current < RECHECK_MS) return;
    lastCheck.current = Date.now();

    const res = await appVersionApiService.check();
    setMessage(res.message ?? null);
    setStoreUrl(res.store_url ?? null);
    setLatest(res.latest);

    if (res.action === 'nudge') {
      // A nudge the user already waved away should stay away for a while.
      const until = Number((await AsyncStorage.getItem(SNOOZE_KEY)) || 0);
      if (Date.now() < until) { setAction('none'); return; }
    }
    setDismissed(false);
    setAction(res.action);
  }, []);

  useEffect(() => { check(); }, [check]);

  // Foreground is the moment worth re-checking: the user may have been away
  // long enough for us to have pulled a bad build.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  const blocking = action === 'force';

  // Android's hardware back would otherwise walk straight out of a wall that is
  // supposed to have no way past.
  useEffect(() => {
    if (!blocking || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [blocking]);

  const openStore = () => {
    if (storeUrl) Linking.openURL(storeUrl).catch(() => { /* nothing else to try */ });
  };

  const snooze = async () => {
    setDismissed(true);
    setAction('none');
    await AsyncStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  };

  const visible = (action === 'force') || (action === 'nudge' && !dismissed);

  return (
    <>
      {children}

      <Modal
        visible={visible}
        transparent={!blocking}
        animationType="fade"
        // On a forced update this is the only handler Android will call, and
        // doing nothing in it is the point.
        onRequestClose={() => { if (!blocking) snooze(); }}
      >
        <View style={[styles.backdrop, blocking && styles.backdropSolid]}>
          <View style={styles.card}>
            {!blocking && (
              <Pressable onPress={snooze} hitSlop={10} style={styles.close}>
                <X size={18} color="#9CA3AF" />
              </Pressable>
            )}

            <View style={styles.iconWrap}>
              <ArrowUpCircle size={30} color="#29828a" />
            </View>

            <Text style={styles.title}>
              {blocking ? 'Please update MolarPlus' : 'A new version is ready'}
            </Text>

            <Text style={styles.body}>
              {message
                || (blocking
                  ? 'This version is out of date and can no longer be used safely. Update to carry on, it only takes a moment.'
                  : `Version ${latest} is available with the latest fixes and improvements.`)}
            </Text>

            <Text style={styles.version}>You are on {runningVersion()}</Text>

            <Pressable onPress={openStore} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
              <Text style={styles.ctaText}>
                {Platform.OS === 'ios' ? 'Update on the App Store' : 'Update on Google Play'}
              </Text>
            </Pressable>

            {!blocking && (
              <Pressable onPress={snooze} style={styles.later}>
                <Text style={styles.laterText}>Not now</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' },
  // A forced update is not something happening "over" the app; it replaces it.
  backdropSolid: { backgroundColor: '#F8FAFC' },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center' },
  close: { position: 'absolute', top: 12, right: 12, padding: 6 },
  iconWrap: { width: 64, height: 64, borderRadius: 999, backgroundColor: '#29828a1A', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 19, fontWeight: '800', color: '#111827', textAlign: 'center' },
  body: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21, marginTop: 8 },
  version: { fontSize: 12, color: '#9CA3AF', marginTop: 12 },
  cta: { alignSelf: 'stretch', backgroundColor: '#29828a', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.85 },
  later: { paddingVertical: 12, marginTop: 4 },
  laterText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
});

export default UpdateGate;
