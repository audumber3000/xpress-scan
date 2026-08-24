import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, Mail, Pencil, Check } from 'lucide-react-native';
import { colors } from '../../../shared/constants/colors';
import { WhatsAppIcon } from '../../../shared/components/icons/WhatsAppIcon';
import { SUPPORT_PHONE_RAW } from '../../../shared/constants/support';
import { useAuth } from '../../../app/AuthContext';
import { signupOtpApiService } from '../../../services/api/signupOtp.api';

/**
 * The last step of signing up: prove the phone and the email are real.
 *
 * One six-digit code goes to BOTH channels and either one gets you in. Two
 * codes to type is two chances to mistype on the screen standing between
 * somebody and the product they just signed up for, and if WhatsApp is having a
 * bad afternoon the email still arrives.
 *
 * ## Why this is a route and not a step inside SignupScreen
 *
 * The clinic already exists by the time this runs — the endpoints need a signed
 * in owner WITH a clinic. So somebody who force-quits here has a real, unverified
 * clinic, and a step buried inside the signup flow would never be shown again.
 * As a gate in AppNavigator, driven by `security_verification_required` from the
 * server, it comes back on the next launch until it is done. That mirrors
 * `App.jsx` on the web, which sends the same clinic back to /onboarding.
 *
 * ## Nobody gets stranded
 *
 * If both channels fail the screen says so and offers WhatsApp support rather
 * than repeating "try again" at someone who cannot. The codes stay valid
 * server-side in case delivery catches up.
 */

const COOLDOWN_SECONDS = 45;

const looksLikeEmail = (v: string) => /\S+@\S+\.\S+/.test(v.trim());

export const VerifyContactScreen: React.FC<{ navigation: any }> = () => {
  const { backendUser, refreshBackendUser } = useAuth();
  const clinic = backendUser?.clinic;

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftPhone, setDraftPhone] = useState('');
  const [draftEmail, setDraftEmail] = useState('');

  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [reached, setReached] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [devEcho, setDevEcho] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(true);

  // Guards the send-on-open. Without it a re-render mid-request fires a second
  // send, which burns the first code and leaves the user typing a dead one.
  const sentOnce = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = useCallback(async (to: { phone: string; email: string }) => {
    setSending(true);
    setError('');
    setBlocked(false);

    const res = await signupOtpApiService.send(to.phone, to.email);

    if (!res.ok) {
      setError(res.error || '');
      // Both channels dead. Stop asking them to try again and offer a human.
      setBlocked(true);
      setSending(false);
      return;
    }

    setReached(res.reached);
    setFailed(Object.entries(res.delivery)
      .filter(([, r]) => !r.sent)
      .map(([ch]) => ch));
    setDevEcho(res.devEcho);
    setCooldown(COOLDOWN_SECONDS);
    setSending(false);
  }, []);

  // Prefill from what the clinic already has on file, then send once.
  useEffect(() => {
    (async () => {
      const contacts = await signupOtpApiService.getContacts();
      const p = contacts?.security_phone || clinic?.phone || backendUser?.phone || '';
      const e = contacts?.security_email || backendUser?.email || '';
      setPhone(p);
      setEmail(e);
      setDraftPhone(p);
      setDraftEmail(e);
      setLoading(false);

      if (!sentOnce.current && p && looksLikeEmail(e)) {
        sentOnce.current = true;
        send({ phone: p, email: e });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveContacts = () => {
    const p = draftPhone.trim();
    const e = draftEmail.trim();
    if (!p) { setError('Please enter a mobile number.'); return; }
    if (!looksLikeEmail(e)) { setError('That email address does not look right.'); return; }
    setPhone(p);
    setEmail(e);
    setEditing(false);
    setCode('');
    // A corrected typo resends immediately. The cooldown exists to stop somebody
    // hammering the same wrong number, not to punish them for fixing it.
    setCooldown(0);
    sentOnce.current = true;
    send({ phone: p, email: e });
  };

  const verify = async () => {
    if (code.trim().length < 4) return;
    setVerifying(true);
    setError('');
    const res = await signupOtpApiService.verify(code.trim());
    if (!res.ok) {
      setError(res.error || '');
      setVerifying(false);
      return;
    }
    // The gate in AppNavigator reads `security_verification_required` off the
    // refreshed user, so this is what lets them through. No navigate() call:
    // the navigator swaps the whole stack once the flag clears.
    await refreshBackendUser();
    setVerifying(false);
  };

  const openSupport = () => {
    const text = encodeURIComponent(
      [
        'Hi MolarPlus support, I cannot receive my verification code.',
        clinic?.name ? `Clinic: ${clinic.name}` : null,
        phone ? `Phone: ${phone}` : null,
        email ? `Email: ${email}` : null,
      ].filter(Boolean).join('\n')
    );
    Linking.openURL(`https://wa.me/${SUPPORT_PHONE_RAW}?text=${text}`).catch(() => {});
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.container, s.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const sentToWhatsApp = reached.includes('whatsapp');
  const sentToEmail = reached.includes('email');

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.iconWrap}>
            <ShieldCheck size={26} color={colors.primary} />
          </View>

          <Text style={s.title}>One last step</Text>
          <Text style={s.lede}>
            We have sent a 6 digit code to your WhatsApp and your email. Enter it once and
            both are confirmed. This is how we reach you if you ever lose access.
          </Text>

          {/* ── Where it went ── */}
          <View style={s.contacts}>
            {editing ? (
              <>
                <Text style={s.fieldLabel}>Mobile number (WhatsApp)</Text>
                <TextInput
                  style={s.input}
                  value={draftPhone}
                  onChangeText={setDraftPhone}
                  keyboardType="phone-pad"
                  placeholder="+91 98765 43210"
                  placeholderTextColor={colors.gray400}
                />
                <Text style={[s.fieldLabel, { marginTop: 12 }]}>Email address</Text>
                <TextInput
                  style={s.input}
                  value={draftEmail}
                  onChangeText={setDraftEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="you@clinic.com"
                  placeholderTextColor={colors.gray400}
                />
                <View style={s.editActions}>
                  <TouchableOpacity
                    onPress={() => { setEditing(false); setDraftPhone(phone); setDraftEmail(email); setError(''); }}
                    style={s.ghostBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={s.ghostText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveContacts} style={s.smallPrimary} activeOpacity={0.85}>
                    <Text style={s.smallPrimaryText}>Save and resend</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={s.contactRow}>
                  <WhatsAppIcon size={18} />
                  <Text style={s.contactText} numberOfLines={1}>{phone || 'No number set'}</Text>
                  {sentToWhatsApp && <Check size={15} color="#059669" />}
                </View>
                <View style={[s.contactRow, s.contactRowBorder]}>
                  <Mail size={18} color={colors.gray500} />
                  <Text style={s.contactText} numberOfLines={1}>{email || 'No email set'}</Text>
                  {sentToEmail && <Check size={15} color="#059669" />}
                </View>
                <TouchableOpacity
                  style={s.editRow}
                  onPress={() => setEditing(true)}
                  activeOpacity={0.7}
                >
                  <Pencil size={13} color={colors.primary} />
                  <Text style={s.editText}>Not right? Change these</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* One channel silently failing is worth saying out loud, so nobody
              sits waiting for a WhatsApp that was never accepted. */}
          {!editing && failed.length > 0 && reached.length > 0 && (
            <Text style={s.partial}>
              {failed.includes('whatsapp')
                ? 'The WhatsApp did not go through, so check your email for the code.'
                : 'The email did not go through, so check your WhatsApp for the code.'}
            </Text>
          )}

          {devEcho && (
            <Text style={s.partial}>
              Development machine: no messaging service here, so the code was written to the
              server log instead of being sent.
            </Text>
          )}

          {/* ── The code ── */}
          {!editing && (
            <>
              <Text style={[s.fieldLabel, { marginTop: 22 }]}>Enter the 6 digit code</Text>
              <TextInput
                style={s.codeInput}
                value={code}
                onChangeText={(t) => { setCode(t.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
                keyboardType="number-pad"
                placeholder="------"
                placeholderTextColor={colors.gray300}
                maxLength={6}
                autoFocus
              />

              {!!error && <Text style={s.error}>{error}</Text>}

              <TouchableOpacity
                style={[s.primary, (code.length < 6 || verifying) && s.primaryDisabled]}
                onPress={verify}
                disabled={code.length < 6 || verifying}
                activeOpacity={0.85}
              >
                {verifying
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={s.primaryText}>Verify and finish</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.resend}
                onPress={() => send({ phone, email })}
                disabled={cooldown > 0 || sending}
                activeOpacity={0.7}
              >
                <Text style={[s.resendText, (cooldown > 0 || sending) && { color: colors.gray400 }]}>
                  {sending
                    ? 'Sending...'
                    : cooldown > 0
                    ? `Send it again in ${cooldown}s`
                    : 'Send the code again'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Neither channel worked. Repeating "try again" at somebody who
              cannot receive anything is how a signup gets abandoned. */}
          {blocked && (
            <View style={s.stuck}>
              <Text style={s.stuckTitle}>Not getting the code?</Text>
              <Text style={s.stuckText}>
                We could not reach you on either channel. Check the number and the address
                above, or message us and we will verify you ourselves.
              </Text>
              <TouchableOpacity style={s.supportBtn} onPress={openSupport} activeOpacity={0.85}>
                <WhatsAppIcon size={17} />
                <Text style={s.supportText}>Message support on WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 },

  iconWrap: {
    width: 52, height: 52, borderRadius: 15, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.gray900, letterSpacing: -0.5 },
  lede: { fontSize: 14, lineHeight: 21, color: colors.gray600, marginTop: 8 },

  contacts: {
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1,
    borderColor: colors.gray200, marginTop: 22, paddingHorizontal: 14, paddingVertical: 4,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13 },
  contactRowBorder: { borderTopWidth: 1, borderTopColor: colors.gray100 },
  contactText: { flex: 1, fontSize: 14, color: colors.gray900, fontWeight: '600' },
  editRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  editText: { fontSize: 12.5, color: colors.primary, fontWeight: '700' },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.gray500, marginBottom: 6 },
  input: {
    backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray200,
    borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12,
    fontSize: 15, color: colors.gray900,
  },
  editActions: { flexDirection: 'row', gap: 9, marginTop: 14, marginBottom: 10 },
  ghostBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderWidth: 1, borderColor: colors.gray200, borderRadius: 11,
  },
  ghostText: { fontSize: 13.5, fontWeight: '700', color: colors.gray600 },
  smallPrimary: {
    flex: 1.4, alignItems: 'center', paddingVertical: 12,
    backgroundColor: colors.primary, borderRadius: 11,
  },
  smallPrimaryText: { fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' },

  partial: { fontSize: 12.5, lineHeight: 19, color: '#B45309', marginTop: 12 },

  codeInput: {
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: colors.gray200,
    borderRadius: 14, paddingVertical: 15, textAlign: 'center',
    fontSize: 26, fontWeight: '800', letterSpacing: 10, color: colors.gray900,
  },
  error: { fontSize: 13, color: '#DC2626', marginTop: 10, fontWeight: '600' },

  primary: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 18,
  },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

  resend: { alignItems: 'center', paddingVertical: 15 },
  resendText: { fontSize: 13.5, fontWeight: '700', color: colors.primary },

  stuck: {
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1,
    borderColor: colors.gray200, padding: 16, marginTop: 8,
  },
  stuckTitle: { fontSize: 14, fontWeight: '800', color: colors.gray900 },
  stuckText: { fontSize: 12.5, lineHeight: 19, color: colors.gray600, marginTop: 6 },
  supportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.gray200, borderRadius: 12,
    paddingVertical: 13, marginTop: 14,
  },
  supportText: { fontSize: 13.5, fontWeight: '700', color: colors.gray900 },
});
