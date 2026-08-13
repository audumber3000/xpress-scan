import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, BackHandler, Platform } from 'react-native';
import { LogOut } from 'lucide-react-native';

/**
 * Your session ended, and not because you asked.
 *
 * The clinic owner deactivated this person or blocked this device, and the
 * backend now refuses every request. Dropping them on the sign-in screen with
 * no explanation reads as the app having crashed — they would try their
 * password again and wonder why it "worked" but nothing loaded.
 *
 * Deliberately inescapable, and on a phone that takes more care than on the
 * web: no backdrop to tap, `onRequestClose` does nothing, and Android's
 * hardware back is trapped for as long as this is up. There is nothing behind
 * it to go back to.
 *
 * Opaque, not translucent. A see-through sheet suggests the app is still there
 * underneath and this will pass. It will not.
 */

interface Props {
  visible: boolean;
  reason?: string | null;
  onSignIn: () => void;
}

export const SessionEndedModal: React.FC<Props> = ({ visible, reason, onSignIn }) => {
  React.useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={() => {}}>
      <View style={styles.screen}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <LogOut size={28} color="#2a276e" />
          </View>

          <Text style={styles.title}>You have been signed out</Text>

          <Text style={styles.body}>
            {reason || 'Your access to this clinic has changed.'}
          </Text>

          <Text style={styles.body}>
            Nothing you had already saved is affected. To carry on, please sign in again, or speak
            to your clinic owner if you think this is a mistake.
          </Text>

          <Pressable
            onPress={onSignIn}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <Text style={styles.ctaText}>Sign in again</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 420, backgroundColor: '#fff',
    borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB',
    padding: 28, alignItems: 'center',
  },
  icon: {
    width: 64, height: 64, borderRadius: 999, backgroundColor: '#2a276e1A',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center' },
  body: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21, marginTop: 10 },
  cta: {
    alignSelf: 'stretch', backgroundColor: '#2a276e',
    paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 26,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});

export default SessionEndedModal;
