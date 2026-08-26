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
 * ## Why opening this screen does not always send a code
 *
 * It used to, guarded by a `useRef` that reset on every mount. That guard was
 * the wrong lifetime for the job: the navigator is torn down and rebuilt on an
 * auth-state re-fire or an Android memory reclaim, and each rebuild is a fresh
 * mount asking for another code. One clinic collected more than twenty messages
 * that way, and because a resend used to invalidate the code before it, every
 * message they opened was already dead. They uninstalled the app.
 *
 * So the record of "a code is already out there" lives in AsyncStorage, keyed by
 * clinic, and survives the mount. On open this screen asks that record first and
 * sends only when there is genuinely nothing live. The countdown is derived from
 * an absolute timestamp rather than a number ticking down in state, so a remount
 * resumes it instead of restarting it. The server enforces all of this again on
 * its own side; none of it is trusted from here.
 *
 * ## Nobody gets stranded
 *
 * If both channels fail, or the clinic has asked for so many codes that the
 * hourly ceiling has stopped it, the screen says so and offers WhatsApp support
 * rather than repeating "try again" at someone who cannot. Codes stay valid
 * server-side in case delivery catches up.
 */

const looksLikeEmail = (v: string) => /\S+@\S+\.\S+/.test(v.trim());

const secondsUntil = (at: number, now: number) => Math.max(0, Math.ceil((at - now) / 1000));

/**
 * Guards against two mounts sending at once.
 *
 * Module scope on purpose: a ref would not help, because the case being guarded
 * is precisely the one where a second component instance exists. React Native
 * keeps the JS context alive across the navigator being rebuilt, so this does
 * too. Holding the promise rather than a boolean means the second caller waits
 * for the first result instead of dropping the request on the floor.
 */
let inFlightSend: Promise<any> | null = null;

export const VerifyContactScreen: React.FC<{ navigation: any }> = () => {
  const { backendUser, refreshBackendUser } = useAuth();
  const clinic = backendUser?.clinic;
  const clinicId = clinic?.id ?? 'pending';

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
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  // Absolute instants, not counters. A countdown held as a number that ticks
  // down in state restarts at its full value every time the component mounts,
  // which is how the resend limit came to mean nothing.
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  // One ticker for every countdown on the screen.
  useEffect(() => {
    if (resendAt <= now) return;
    const t = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(t);
  }, [resendAt, now]);

  const cooldown = secondsUntil(resendAt, now);

  const applySendResult = useCallback((res: any) => {
    if (!alive.current) return;

    if (res.alreadyVerified) {
      // Server says the step is done. Let the navigator move on.
      refreshBackendUser();
      return;
    }

    if (!res.ok) {
      setError(res.error || '');
      // Both channels dead. Stop asking them to try again and offer a human.
      setBlocked(true);
      return;
    }

    if (res.rateLimited) {
      // Not a failure: a code is already out there. Say so, start the
      // countdown, and leave the input alone.
      setResendAt(Date.now() + res.resendIn * 1000);
      setNotice(res.error || 'A code is already on its way. Use the most recent one you received.');
      // An hourly ceiling is a different situation from a 45 second pause: it
      // means minutes of waiting, so it gets the route to a human.
      if (res.resendIn > 120) setBlocked(true);
      return;
    }

    setBlocked(false);
    setNotice('');
    setReached(res.reached);
    setFailed(Object.entries(res.delivery || {})
      .filter(([, r]: any) => !r.sent)
      .map(([ch]) => ch));
    setDevEcho(res.devEcho);
    setResendAt(Date.now() + res.resendIn * 1000);
  }, [refreshBackendUser]);

  const send = useCallback(async (to: { phone: string; email: string }) => {
    if (inFlightSend) {
      // Another mount is already asking. Wait on its answer rather than
      // starting a second request that the server would only reject.
      setSending(true);
      try { applySendResult(await inFlightSend); } finally {
        if (alive.current) setSending(false);
      }
      return;
    }

    setSending(true);
    setError('');
    setNotice('');
    const p = signupOtpApiService.send(clinicId, to.phone, to.email);
    inFlightSend = p;
    try {
      applySendResult(await p);
    } finally {
      inFlightSend = null;
      if (alive.current) setSending(false);
    }
  }, [applySendResult, clinicId]);

  // Open the screen: prefill, then send ONLY if nothing is live.
  useEffect(() => {
    (async () => {
      const [contacts, sendState] = await Promise.all([
        signupOtpApiService.getContacts(),
        signupOtpApiService.readSendState(clinicId),
      ]);
      if (!alive.current) return;

      const p = contacts?.security_phone || clinic?.phone || backendUser?.phone || '';
      const e = contacts?.security_email || backendUser?.email || '';
      setPhone(p);
      setEmail(e);
      setDraftPhone(p);
      setDraftEmail(e);
      setLoading(false);

      if (contacts?.security_phone_verified || contacts?.security_email_verified) {
        // Verified on another device, or a verify whose response was lost.
        await signupOtpApiService.clearSendState(clinicId);
        refreshBackendUser();
        return;
      }

      const t = Date.now();
      const contactsMatch = !sendState
        || (sendState.phone === p && sendState.email === e);
      const codeStillLive = !!sendState && sendState.expiresAt > t && contactsMatch;
      const stillCoolingDown = !!sendState && sendState.resendAt > t;

      if (codeStillLive || stillCoolingDown) {
        // There is already a code on its phone, or one was sent seconds ago.
        // Restore what we told them last time instead of sending again.
        setReached(sendState!.reached);
        setFailed(sendState!.failed);
        setDevEcho(sendState!.devEcho);
        setResendAt(sendState!.resendAt);
        setNow(t);
        if (!codeStillLive) {
          setNotice('Your last code has expired. You can send a new one in a moment.');
        }
        return;
      }

      if (p && looksLikeEmail(e)) send({ phone: p, email: e });
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
    // hammering the same wrong number, not to punish them for fixing it, and the
    // server waives it for a genuine contact change too.
    setResendAt(0);
    send({ phone: p, email: e });
  };

  const verify = async () => {
    if (code.trim().length < 4) return;
    setVerifying(true);
    setError('');
    setNotice('');
    const res = await signupOtpApiService.verify(clinicId, code.trim());
    if (!alive.current) return;
    if (!res.ok) {
      setError(res.error || '');
      if (res.rateLimited) {
        // Out of tries on the live codes. Point them at the resend and make it
        // available when the server says it will be.
        setResendAt(Date.now() + (res.retryAfter || 45) * 1000);
        setNow(Date.now());
        setCode('');
      }
      setVerifying(false);
      return;
    }
    // The gate in AppNavigator reads `security_verification_required` off the
    // refreshed user, so this is what lets them through. No navigate() call:
    // the navigator swaps the whole stack once the flag clears.
    await refreshBackendUser();
    if (alive.current) setVerifying(false);
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

          {!editing && !!notice && <Text style={s.partial}>{notice}</Text>}

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

              {/* Said plainly, because it is the thing that was not true before:
                  if several messages arrived, every one of them works. */}
              <Text style={s.hint}>
                Got more than one message? Any of the recent codes will work.
              </Text>

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

          {/* Neither channel worked, or they have asked so often that the hourly
              ceiling stopped them. Repeating "try again" at somebody who cannot
              get anywhere is how a signup gets abandoned. */}
          {blocked && (
            <View style={s.stuck}>
              <Text style={s.stuckTitle}>Not getting the code?</Text>
              <Text style={s.stuckText}>
                Check the number and the address above, or message us and we will verify you
                ourselves. Nothing you have set up so far is lost.
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
  hint: { fontSize: 12, lineHeight: 18, color: colors.gray500, marginTop: 9 },
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
