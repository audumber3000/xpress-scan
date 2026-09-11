import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, Flashlight, FlashlightOff, QrCode } from 'lucide-react-native';
import { useAuth } from '../../../app/AuthContext';

/**
 * Sign in by pointing the camera at a QR on the MolarPlus website.
 *
 * The web shows it in two places: the profile menu ("Log in to mobile app"),
 * for yourself, and Control Center, Staff, Phone login, where an owner sets up
 * somebody's phone. The code in it works once and changes every two minutes;
 * the server decides everything, this screen only reads and hands it over.
 *
 * Once it is accepted the auth context flips to signed in and the navigator
 * swaps this whole stack for the app, exactly as after a password sign-in.
 */

const PREFIX = 'molarplus://login';

type State = 'scanning' | 'signing-in' | 'failed';

export const ScanLoginScreen: React.FC<any> = ({ navigation }) => {
  const { signInWithPhoneCode } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<State>('scanning');
  const [message, setMessage] = useState('');
  const [torch, setTorch] = useState(false);
  // The camera reports the same code many times a second; one is plenty.
  const handled = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  const onScanned = async ({ data }: { data: string }) => {
    if (handled.current) return;
    handled.current = true;

    if (!String(data || '').startsWith(PREFIX)) {
      setMessage("That isn't a MolarPlus sign-in code. Open Log in to mobile app on the website and scan the code there.");
      setState('failed');
      return;
    }

    setState('signing-in');
    const { error } = await signInWithPhoneCode(data);
    if (error) {
      setMessage(error);
      setState('failed');
    }
    // On success there is nothing to do: signing in replaces this stack.
  };

  const scanAgain = () => {
    setMessage('');
    setState('scanning');
    handled.current = false;
  };

  // ── camera permission ────────────────────────────────────────────────────
  if (!permission) {
    return <View style={styles.black}><ActivityIndicator color="#fff" /></View>;
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permScreen}>
        <TopBar onClose={() => navigation.goBack()} dark={false} />
        <View style={styles.permBody}>
          <View style={styles.permIcon}><QrCode size={30} color="#29828a" /></View>
          <Text style={styles.permTitle}>Allow the camera</Text>
          <Text style={styles.permText}>
            MolarPlus needs the camera to read the sign-in QR code. It is only used while this screen is open.
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.85}>
              <Text style={styles.permBtnText}>Allow camera</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.permBtn} onPress={() => Linking.openSettings()} activeOpacity={0.85}>
              <Text style={styles.permBtnText}>Open {Platform.OS === 'ios' ? 'Settings' : 'app settings'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── scanning ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.black}>
      <StatusBar barStyle="light-content" />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={state === 'scanning' ? onScanned : undefined}
      />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <TopBar onClose={() => navigation.goBack()} dark />

        <View style={styles.middle}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            {state === 'signing-in' && (
              <View style={styles.frameBusy}>
                <ActivityIndicator color="#fff" size="large" />
                <Text style={styles.frameBusyText}>Signing you in…</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.bottom}>
          {state === 'failed' ? (
            <View style={styles.failCard}>
              <Text style={styles.failText}>{message}</Text>
              <TouchableOpacity style={styles.againBtn} onPress={scanAgain} activeOpacity={0.85}>
                <Text style={styles.againBtnText}>Scan again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.hint}>
              On the MolarPlus website, open your profile menu and choose{' '}
              <Text style={styles.hintStrong}>Log in to mobile app</Text>. Or ask your clinic owner to show your code.
            </Text>
          )}

          <TouchableOpacity
            style={styles.torch}
            onPress={() => setTorch((t) => !t)}
            activeOpacity={0.8}
            accessibilityLabel={torch ? 'Turn the torch off' : 'Turn the torch on'}
          >
            {torch ? <FlashlightOff size={20} color="#111827" /> : <Flashlight size={20} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const TopBar: React.FC<{ onClose: () => void; dark: boolean }> = ({ onClose, dark }) => (
  <View style={styles.topBar}>
    <TouchableOpacity onPress={onClose} style={[styles.closeBtn, !dark && styles.closeBtnLight]} hitSlop={10} accessibilityLabel="Close">
      <X size={22} color={dark ? '#FFFFFF' : '#111827'} />
    </TouchableOpacity>
    <Text style={[styles.topTitle, !dark && { color: '#111827' }]}>Scan QR to log in</Text>
    <View style={{ width: 40 }} />
  </View>
);

const FRAME = 250;
const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  closeBtnLight: { backgroundColor: '#F3F4F6' },
  topTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },

  middle: { alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME, height: FRAME },
  corner: { position: 'absolute', width: 36, height: 36, borderColor: '#FFFFFF' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  frameBusy: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  frameBusyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  bottom: { paddingHorizontal: 24, paddingBottom: 16, alignItems: 'center', gap: 18 },
  hint: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  hintStrong: { fontWeight: '800', color: '#FFFFFF' },
  torch: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  failCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, width: '100%', alignItems: 'center', gap: 12 },
  failText: { color: '#111827', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  againBtn: { backgroundColor: '#29828a', borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11 },
  againBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  permScreen: { flex: 1, backgroundColor: '#FFFFFF' },
  permBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  permIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E6F1F2', alignItems: 'center', justifyContent: 'center' },
  permTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  permText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  permBtn: { marginTop: 8, backgroundColor: '#29828a', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 13 },
  permBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});

export default ScanLoginScreen;
