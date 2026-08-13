import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { KeyRound, X } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { securityApiService } from '../../services/api/security.api';

/**
 * The master password prompt.
 *
 * Stands in front of the deletes nothing can undo: a patient and everything on
 * their file, a paid bill, a payment already receipted. Six digits set by the
 * owner in Control Center, asked for every single time, never remembered.
 *
 * A bottom sheet rather than a centre modal, unlike the web version: it lands
 * above the thumb, and the number pad is coming up under it anyway.
 *
 * The code is exchanged here for a short-lived token, which the caller then
 * sends with the delete itself. That split is the reason this exists as a
 * component rather than a text field on each screen — a wrong code is answered
 * before anything is destroyed.
 *
 * `onConfirm` receives the token. Throw from it and the message lands on this
 * sheet, which stays open so the user can retry.
 */

const CODE_LENGTH = 6;

interface Props {
  visible: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  /** Owners are pointed at the screen that changes it; everyone else at the owner. */
  isOwner?: boolean;
  onCancel: () => void;
  onConfirm: (masterToken: string) => Promise<void> | void;
}

export const MasterPasswordSheet: React.FC<Props> = ({
  visible,
  title = 'Enter the master password',
  message,
  confirmLabel = 'Confirm and delete',
  isOwner = false,
  onCancel,
  onConfirm,
}) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Fresh every time it opens. A code left over from the last delete would be a
  // prompt that does not actually ask.
  useEffect(() => {
    if (!visible) return;
    setCode('');
    setError('');
    setBusy(false);
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [visible]);

  const submit = async () => {
    if (code.length < CODE_LENGTH || busy) return;
    setBusy(true);
    setError('');
    try {
      const { token } = await securityApiService.verifyMasterPassword(code);
      await onConfirm(token);
    } catch (e: any) {
      setError(e?.message || 'Could not confirm the master password');
      setCode('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !busy && onCancel()}>
      <Pressable style={styles.backdrop} onPress={() => !busy && onCancel()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
      >
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <KeyRound size={18} color={colors.error} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              {!!message && <Text style={styles.message}>{message}</Text>}
            </View>
            <Pressable onPress={() => !busy && onCancel()} hitSlop={10} style={styles.close}>
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <Text style={styles.label}>Master password</Text>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, CODE_LENGTH)); setError(''); }}
            placeholder="••••••"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={CODE_LENGTH}
            style={[styles.input, !!error && styles.inputError]}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.hint}>
            {isOwner
              ? 'The six digits set in Control Center, under Verification. You can change it there.'
              : 'If you do not know the master password, ask your clinic owner for it.'}
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={busy || code.length < CODE_LENGTH}
              style={({ pressed }) => [
                styles.btn,
                styles.btnDanger,
                (busy || code.length < CODE_LENGTH) && styles.btnDisabled,
                pressed && styles.pressed,
              ]}
            >
              {busy && <ActivityIndicator size="small" color={colors.textInverse} style={{ marginRight: spacing[2] }} />}
              <Text style={styles.btnDangerText}>{busy ? 'Working…' : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
    paddingTop: spacing[2],
  },
  grabber: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: radius.pill,
    backgroundColor: colors.borderColor, marginBottom: spacing[4],
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.pill,
    backgroundColor: colors.errorLight, alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1 },
  close: { padding: spacing[1] },
  title: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.textPrimary },
  message: { fontSize: typography.size.md, color: colors.textSecondary, marginTop: spacing[1], lineHeight: 20 },
  label: {
    fontSize: typography.size.sm, color: colors.textSecondary,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase', letterSpacing: typography.tracking.wider,
    marginTop: spacing[5], marginBottom: spacing[2],
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1, borderColor: colors.borderColor, borderRadius: radius.lg,
    paddingVertical: spacing[3], paddingHorizontal: spacing[4],
    fontSize: 24, fontWeight: '700', letterSpacing: 10,
    textAlign: 'center', color: colors.textPrimary,
  },
  inputError: { borderColor: colors.error },
  error: { fontSize: typography.size.md, color: colors.error, marginTop: spacing[2] },
  hint: { fontSize: typography.size.base, color: colors.textMuted, marginTop: spacing[2], lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[5] },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing[3], borderRadius: radius.lg,
  },
  btnGhost: { borderWidth: 1, borderColor: colors.borderColor, backgroundColor: colors.cardBg },
  btnGhostText: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.textSecondary },
  btnDanger: { backgroundColor: colors.error },
  btnDangerText: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.textInverse },
  btnDisabled: { backgroundColor: colors.textMuted },
  pressed: { opacity: 0.85 },
});

export default MasterPasswordSheet;
