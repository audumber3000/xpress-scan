import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft, Smartphone, Mail, KeyRound, CheckCircle2, AlertTriangle, X,
} from 'lucide-react-native';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { notify } from '../../../../shared/utils/notify';
import {
  securityApiService, SecurityContact, MasterPasswordStatus,
} from '../../../../services/api/security.api';

/**
 * Control Center → Verification.
 *
 * The clinic's recovery phone and email, each proved by an OTP, and underneath
 * them the master password those contacts exist to protect.
 *
 * Matches the web screen (pages/admin/security/Security.jsx + the master
 * password card beside it). Owner-only, enforced by the backend, so a
 * non-owner who reaches this by some other route gets errors rather than a
 * screen that half-works.
 *
 * Changing the master password needs a WhatsApp code on the recovery phone,
 * NOT the current master password. Otherwise anyone who had been told the code
 * once could quietly change it and lock the owner out of their own clinic.
 */

const CODE_LENGTH = 6;

type Channel = 'whatsapp' | 'email';

const CHANNELS: Record<Channel, {
  field: keyof SecurityContact; verifiedField: keyof SecurityContact;
  label: string; placeholder: string; help: string;
}> = {
  whatsapp: {
    field: 'security_phone', verifiedField: 'security_phone_verified',
    label: 'Phone', placeholder: '9876543210',
    help: 'We send a WhatsApp code to verify this number.',
  },
  email: {
    field: 'security_email', verifiedField: 'security_email_verified',
    label: 'Email', placeholder: 'owner@clinic.com',
    help: 'We email a code to verify this address.',
  },
};

export const VerificationScreen: React.FC<any> = ({ navigation }) => {
  const [contact, setContact] = useState<SecurityContact | null>(null);
  const [mp, setMp] = useState<MasterPasswordStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Recovery-contact editing
  const [editing, setEditing] = useState<Channel | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [otpFor, setOtpFor] = useState<Channel | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [sending, setSending] = useState<Channel | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Master password change
  const [mpOpen, setMpOpen] = useState(false);
  const [mpStep, setMpStep] = useState<'send' | 'enter'>('send');
  const [mpOtp, setMpOtp] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [mpBusy, setMpBusy] = useState(false);
  const [mpError, setMpError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, m] = await Promise.all([
        securityApiService.getSecurity(),
        securityApiService.getMasterPasswordStatus().catch(() => null),
      ]);
      setContact(c);
      setMp(m);
    } catch (e: any) {
      notify.problem(e?.message || 'Could not load your security settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Recovery contact ──────────────────────────────────────────────────────
  const saveContact = async (channel: Channel) => {
    setSaving(true);
    try {
      const updated = await securityApiService.updateSecurity({
        [CHANNELS[channel].field]: draft.trim(),
      } as any);
      setContact(updated);
      setEditing(null);
    } catch (e: any) {
      notify.problem(e?.message || 'Could not save that');
    } finally {
      setSaving(false);
    }
  };

  const sendCode = async (channel: Channel) => {
    setSending(channel);
    try {
      await securityApiService.sendOtp(channel);
      setOtpFor(channel);
      setOtpCode('');
      notify.done(channel === 'whatsapp' ? 'Code sent on WhatsApp' : 'Code sent to your email');
    } catch (e: any) {
      notify.problem(e?.message || 'Could not send the code');
    } finally {
      setSending(null);
    }
  };

  const verifyCode = async () => {
    if (!otpFor) return;
    setVerifying(true);
    try {
      await securityApiService.verifyOtp(otpFor, otpCode.trim());
      setOtpFor(null);
      load();
    } catch (e: any) {
      notify.problem(e?.message || 'Could not verify the code');
    } finally {
      setVerifying(false);
    }
  };

  // ── Master password ───────────────────────────────────────────────────────
  const closeMp = () => {
    if (mpBusy) return;
    setMpOpen(false); setMpStep('send');
    setMpOtp(''); setPin(''); setConfirmPin(''); setMpError('');
  };

  const sendMpCode = async () => {
    setMpBusy(true); setMpError('');
    try {
      await securityApiService.sendMasterPasswordOtp();
      setMpStep('enter');
      notify.done('Code sent on WhatsApp');
    } catch (e: any) {
      setMpError(e?.message || 'Could not send the code');
    } finally {
      setMpBusy(false);
    }
  };

  const saveMp = async () => {
    if (pin.length !== CODE_LENGTH) { setMpError(`The new password must be exactly ${CODE_LENGTH} digits, numbers only`); return; }
    if (pin !== confirmPin) { setMpError('The two passwords do not match'); return; }
    if (mpOtp.length < 4) { setMpError('Enter the code we sent on WhatsApp'); return; }
    setMpBusy(true); setMpError('');
    try {
      await securityApiService.setMasterPassword(mpOtp, pin);
      notify.done('Master password updated');
      closeMp();
      load();
    } catch (e: any) {
      setMpError(e?.message || 'Could not update the master password');
    } finally {
      setMpBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header navigation={navigation} />
        <View style={styles.center}><GearLoader text="Loading security settings…" /></View>
      </SafeAreaView>
    );
  }

  const isDefault = !!mp?.is_default;
  const hasPhone = !!contact?.security_phone;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header navigation={navigation} />

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.lede}>
          Your recovery phone and email. We use these for account recovery and to confirm sensitive
          actions, so keep them verified.
        </Text>

        {(Object.keys(CHANNELS) as Channel[]).map((channel) => {
          const meta = CHANNELS[channel];
          const value = (contact?.[meta.field] as string) || '';
          const verified = !!contact?.[meta.verifiedField];
          const Icon = channel === 'whatsapp' ? Smartphone : Mail;
          const isEditing = editing === channel;

          return (
            <View key={channel} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.iconWrap}><Icon size={18} color="#29828a" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{meta.label}</Text>
                  {isEditing ? (
                    <View style={styles.editRow}>
                      <TextInput
                        value={draft}
                        onChangeText={setDraft}
                        placeholder={meta.placeholder}
                        placeholderTextColor="#9CA3AF"
                        keyboardType={channel === 'whatsapp' ? 'phone-pad' : 'email-address'}
                        autoCapitalize="none"
                        style={styles.editInput}
                      />
                      <TouchableOpacity onPress={() => saveContact(channel)} disabled={saving} style={styles.saveBtn}>
                        <Text style={styles.saveBtnText}>{saving ? '…' : 'Save'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditing(null)} disabled={saving}>
                        <Text style={styles.cancelText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => { setEditing(channel); setDraft(value); }}
                      style={styles.valueRow}
                    >
                      <Text style={value ? styles.value : styles.valueEmpty}>{value || 'Not set'}</Text>
                      <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.help}>{meta.help}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={[styles.badge, verified ? styles.badgeOk : styles.badgeWarn]}>
                  {verified
                    ? <CheckCircle2 size={12} color="#059669" />
                    : <AlertTriangle size={12} color="#D97706" />}
                  <Text style={[styles.badgeText, verified ? styles.badgeTextOk : styles.badgeTextWarn]}>
                    {verified ? 'Verified' : 'Unverified'}
                  </Text>
                </View>
                {!verified && !!value && !isEditing && (
                  <TouchableOpacity
                    onPress={() => sendCode(channel)}
                    disabled={sending === channel}
                    style={styles.primaryBtn}
                  >
                    <Text style={styles.primaryBtnText}>
                      {sending === channel ? 'Sending…' : 'Verify'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {/* Master password. Sits under the phone because that is what proves a change. */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.iconWrap}><KeyRound size={18} color="#29828a" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Master password</Text>
              <Text style={styles.value}>
                {isDefault ? 'Still set to 123456' : '••••••'}
              </Text>
              <Text style={styles.help}>
                Asked for before deleting a patient, a paid bill, or a payment already recorded.
              </Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View style={[styles.badge, isDefault ? styles.badgeWarn : styles.badgeOk]}>
              {isDefault
                ? <AlertTriangle size={12} color="#D97706" />
                : <CheckCircle2 size={12} color="#059669" />}
              <Text style={[styles.badgeText, isDefault ? styles.badgeTextWarn : styles.badgeTextOk]}>
                {isDefault ? 'Default' : 'Set'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => { setMpOpen(true); setMpStep('send'); }}
              disabled={!hasPhone}
              style={[styles.primaryBtn, !hasPhone && styles.btnDisabled]}
            >
              <Text style={styles.primaryBtnText}>{isDefault ? 'Set password' : 'Change'}</Text>
            </TouchableOpacity>
          </View>

          {isDefault && (
            <View style={styles.nudge}>
              <AlertTriangle size={14} color="#D97706" />
              <Text style={styles.nudgeText}>
                Every clinic starts on 123456, so please pick your own before staff start using the
                app. Share it only with the people you would trust to delete a patient's whole record.
              </Text>
            </View>
          )}
          {!hasPhone && (
            <Text style={styles.help}>
              Add a recovery phone above first. Changing the master password is confirmed by a
              WhatsApp code sent to it.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* OTP entry for the recovery contact */}
      <Modal visible={!!otpFor} transparent animationType="fade" onRequestClose={() => setOtpFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => !verifying && setOtpFor(null)} />
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Enter the code</Text>
              <Pressable onPress={() => setOtpFor(null)} hitSlop={10}><X size={18} color="#9CA3AF" /></Pressable>
            </View>
            <Text style={styles.modalBody}>
              We sent a 6-digit code to your {otpFor === 'whatsapp' ? 'WhatsApp number' : 'email'}.
              It expires in 5 minutes.
            </Text>
            <TextInput
              value={otpCode}
              onChangeText={(t) => setOtpCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              style={styles.codeInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setOtpFor(null)} style={styles.ghostBtn}>
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={verifyCode} disabled={verifying || otpCode.length < 4} style={[styles.primaryBtn, styles.flex1]}>
                {verifying
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.primaryBtnText}>Verify</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Master password change: send a code, then type it with the new PIN */}
      <Modal visible={mpOpen} transparent animationType="fade" onRequestClose={closeMp}>
        <Pressable style={styles.backdrop} onPress={closeMp} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>
                {isDefault ? 'Set the master password' : 'Change the master password'}
              </Text>
              <Pressable onPress={closeMp} hitSlop={10}><X size={18} color="#9CA3AF" /></Pressable>
            </View>

            {mpStep === 'send' ? (
              <Text style={styles.modalBody}>
                We will send a code on WhatsApp to {contact?.security_phone}. You will need it on the
                next screen along with your new password.
              </Text>
            ) : (
              <>
                <Text style={styles.fieldLabel}>WhatsApp code</Text>
                <TextInput
                  value={mpOtp}
                  onChangeText={(t) => { setMpOtp(t.replace(/\D/g, '').slice(0, 6)); setMpError(''); }}
                  placeholder="••••••"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  style={styles.codeInput}
                />
                <TouchableOpacity onPress={sendMpCode} disabled={mpBusy}>
                  <Text style={styles.resend}>{mpBusy ? 'Sending…' : 'Resend code'}</Text>
                </TouchableOpacity>

                <View style={styles.pinRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.fieldLabel}>New {CODE_LENGTH}-digit code</Text>
                    <TextInput
                      value={pin}
                      onChangeText={(t) => { setPin(t.replace(/\D/g, '').slice(0, CODE_LENGTH)); setMpError(''); }}
                      placeholder="••••••"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      secureTextEntry
                      style={styles.pinInput}
                    />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.fieldLabel}>Confirm</Text>
                    <TextInput
                      value={confirmPin}
                      onChangeText={(t) => { setConfirmPin(t.replace(/\D/g, '').slice(0, CODE_LENGTH)); setMpError(''); }}
                      placeholder="••••••"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      secureTextEntry
                      style={styles.pinInput}
                    />
                  </View>
                </View>

                {/* Said out loud because the fields silently drop anything that is
                    not a digit — otherwise typing a letter looks like a broken keyboard. */}
                <Text style={styles.help}>
                  <Text style={styles.helpStrong}>Numbers only.</Text> Exactly {CODE_LENGTH} digits,
                  no letters or symbols. Avoid 123456 and your clinic phone number.
                </Text>
              </>
            )}

            {!!mpError && <Text style={styles.error}>{mpError}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={closeMp} disabled={mpBusy} style={styles.ghostBtn}>
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={mpStep === 'send' ? sendMpCode : saveMp}
                disabled={mpBusy}
                style={[styles.primaryBtn, styles.flex1]}
              >
                {mpBusy
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.primaryBtnText}>{mpStep === 'send' ? 'Send code' : 'Save password'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const Header: React.FC<{ navigation: any }> = ({ navigation }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
      <ChevronLeft size={24} color="#111827" />
    </TouchableOpacity>
    <View style={{ flex: 1 }}>
      <Text style={styles.title}>Verification</Text>
      <Text style={styles.subtitle}>Recovery contact & master password</Text>
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

  body: { padding: 16, paddingBottom: 40 },
  lede: { fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 16 },

  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, marginBottom: 12 },
  cardRow: { flexDirection: 'row', gap: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#29828a1A', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  value: { fontSize: 14, color: '#4B5563' },
  valueEmpty: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' },
  editLink: { fontSize: 12, color: '#29828a', fontWeight: '700' },
  help: { fontSize: 12, color: '#9CA3AF', marginTop: 6, lineHeight: 17 },
  helpStrong: { fontWeight: '700', color: '#6B7280' },

  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  editInput: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#111827' },
  saveBtn: { backgroundColor: '#29828a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  saveBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cancelText: { fontSize: 12, color: '#6B7280' },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  badgeOk: { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' },
  badgeWarn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgeTextOk: { color: '#059669' },
  badgeTextWarn: { color: '#D97706' },

  primaryBtn: { backgroundColor: '#29828a', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnDisabled: { backgroundColor: '#D1D5DB' },

  nudge: { flexDirection: 'row', gap: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 10, padding: 12, marginTop: 14 },
  nudgeText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111827', flex: 1 },
  modalBody: { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  codeInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 10, fontSize: 20, fontWeight: '700', letterSpacing: 8, textAlign: 'center', color: '#111827', marginTop: 10 },
  resend: { fontSize: 12, color: '#6B7280', marginTop: 6 },
  pinRow: { flexDirection: 'row', gap: 10 },
  pinInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 9, fontSize: 16, fontWeight: '700', letterSpacing: 4, textAlign: 'center', color: '#111827' },
  error: { fontSize: 13, color: '#DC2626', marginTop: 10 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  ghostBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  ghostBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  flex1: { flex: 1 },
});

export default VerificationScreen;
