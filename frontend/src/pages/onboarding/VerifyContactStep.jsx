import React, { useCallback, useEffect, useRef, useState } from 'react';
import Spinner from '../../components/common/Spinner';
import { ShieldCheck, Pencil, Loader2, CheckCircle2, AlertTriangle, Mail, Clock, Inbox } from 'lucide-react';
import WhatsAppIcon from '../../components/icons/WhatsAppIcon';
import { api, getFriendlyErrorMessage } from '../../utils/api';
import { SUPPORT_PHONE_RAW } from '../../constants/support';
import { track, EVENTS } from '../../analytics/track';

/**
 * The last step of signup: prove the phone and the email are real.
 *
 * ONE six-digit code goes to both channels and is typed once. Sending to both
 * is not belt-and-braces for its own sake, it is what makes a blocking step
 * safe: WhatsApp template delivery is the flakiest thing in this product, and
 * if it were the only channel a Meta rejection would wall a brand-new clinic
 * out of the app on their first day. With two channels, one failing is a line
 * of explanatory text rather than a dead end.
 *
 * Both contacts are marked verified when either code is accepted. The claim
 * being tested is "the person holding this phone is the person reading this
 * inbox", and making them do the same dance twice proves nothing further.
 *
 * ## Why opening this step does not always send a code
 *
 * A send used to fire on mount behind a `useRef`, which resets whenever the
 * component mounts: a refresh, a step revisited, React 18's double-invoked
 * effect in development. Every one of those was another code, and until the
 * server was fixed each new code invalidated the one before it, so the message
 * sitting in front of the customer was the dead one.
 *
 * The record of "a code is already out there" therefore lives in sessionStorage
 * rather than in a ref, and the countdown is derived from an absolute instant
 * rather than a number ticking down in state, so a remount resumes it instead
 * of restarting it at zero. The server enforces its own cooldown and hourly
 * ceiling regardless; none of this is trusted from the browser.
 */

const RESEND_SECONDS = 45;
const STATE_KEY = 'molarplus:signupOtp:v1';

const readSendState = () => {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.sentAt === 'number' ? parsed : null;
  } catch {
    return null;
  }
};

const writeSendState = (state) => {
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Private mode, or storage full. One extra send is the worst case, and the
    // server's own cooldown catches that.
  }
};

const clearSendState = () => {
  try {
    sessionStorage.removeItem(STATE_KEY);
  } catch {
    // See writeSendState.
  }
};

const secondsUntil = (at, now) => Math.max(0, Math.ceil((at - now) / 1000));

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Show enough of the destination to recognise it, not enough to leak it.
 *
 * Naming the actual number and address is the point. "We sent a code to your
 * WhatsApp and your email" is unfalsifiable — the one clinic this screen was
 * rebuilt for had typed a number that could not exist, and no wording that
 * says "your WhatsApp" would ever have let them notice.
 */
const maskPhone = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length < 4) return v || '';
  return `${'•'.repeat(Math.max(0, d.length - 4))}${d.slice(-4)}`;
};

const maskEmail = (v) => {
  const s = String(v || '');
  const at = s.indexOf('@');
  if (at < 1) return s;
  const head = s.slice(0, at);
  const shown = head.slice(0, Math.min(3, head.length));
  return `${shown}${'•'.repeat(Math.max(1, head.length - shown.length))}${s.slice(at)}`;
};

// How much trouble is enough to stop offering another retry and offer a person
// instead. Two of anything: the screen that shipped before this one waited for
// `blocked`, which required BOTH channels to report failure — and because a
// provider accepting a message counts as success, a dead phone number never
// set it. One real clinic sent four codes and typed twenty-two wrong ones
// without the help panel ever appearing.
const STRUGGLE_WRONG = 2;
const STRUGGLE_RESENDS = 2;

const VerifyContactStep = ({ phone: initialPhone, email: initialEmail, onVerified }) => {
  const [phone, setPhone] = useState(initialPhone || '');
  const [email, setEmail] = useState(initialEmail || '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ phone: initialPhone || '', email: initialEmail || '' });

  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [reached, setReached] = useState([]);      // channels the code actually left on
  const [failed, setFailed] = useState([]);        // channels that rejected it
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');        // a code is already in flight
  const [blocked, setBlocked] = useState(false);   // neither channel worked
  const [devEcho, setDevEcho] = useState(false);   // dev machine: code went to the log

  // Absolute instants, not counters, so a remount resumes the countdown.
  const [resendAt, setResendAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const cooldown = secondsUntil(resendAt, now);
  const expiresIn = expiresAt ? secondsUntil(expiresAt, now) : 0;

  // How the attempt is going. Counted here rather than read from the server
  // because the 400 body says "Incorrect code", not how many tries are left,
  // and this screen has to decide when to stop offering a retry.
  const [wrongTries, setWrongTries] = useState(0);
  const [resends, setResends] = useState(0);
  const [shake, setShake] = useState(false);

  const struggling = wrongTries >= STRUGGLE_WRONG || resends >= STRUGGLE_RESENDS;
  const needsHuman = blocked || struggling;

  // Stops two effects (React 18 double-invoke, a re-render mid-request) from
  // putting two sends on the wire. The promise, not a boolean, so the second
  // caller waits for the first answer instead of dropping its request.
  const inFlight = useRef(null);
  const openedOnce = useRef(false);

  const send = useCallback(async (to = { phone, email }) => {
    if (inFlight.current) {
      setSending(true);
      try { await inFlight.current; } finally { setSending(false); }
      return;
    }

    setSending(true);
    setError('');
    setNotice('');
    const request = api.post('/security/signup-otp/send', { phone: to.phone, email: to.email });
    inFlight.current = request;
    try {
      const res = await request;

      if (res?.already_verified) {
        clearSendState();
        onVerified();
        return;
      }

      const started = Date.now();
      const resendIn = Number(res?.resend_in) > 0 ? Number(res.resend_in) : RESEND_SECONDS;
      const ttl = Number(res?.expires_in) > 0 ? Number(res.expires_in) : 600;
      const nextReached = res.reached || [];
      const nextFailed = Object.entries(res.delivery || {}).filter(([, r]) => !r.sent).map(([ch]) => ch);

      setReached(nextReached);
      setDevEcho(!!res.dev_echo);
      setFailed(nextFailed);
      setBlocked(false);
      setResendAt(started + resendIn * 1000);
      setExpiresAt(started + ttl * 1000);
      setNow(started);
      setCode('');
      // A fresh code deserves a fresh attempt budget, but the resend count is
      // cumulative on purpose: pressing resend three times IS the signal.
      setWrongTries(0);

      track(EVENTS.ONBOARDING_OTP_SENT, {
        reached: nextReached,
        failed: nextFailed,
        // Recorded because "the provider accepted it" is all `reached` ever
        // means — no delivery webhook updates notification_logs, so a channel
        // can report success and still deliver nothing.
        both_channels: nextReached.length === 2,
      });

      writeSendState({
        sentAt: started,
        expiresAt: started + ttl * 1000,
        resendAt: started + resendIn * 1000,
        reached: nextReached,
        failed: nextFailed,
        devEcho: !!res.dev_echo,
        phone: to.phone,
        email: to.email,
      });
    } catch (err) {
      // A code is already in flight, or the hourly ceiling has been reached.
      // Neither is a failure: there is something on their phone to type.
      if (err?.status === 429) {
        const wait = err.retryAfter || RESEND_SECONDS;
        setResendAt(Date.now() + wait * 1000);
        setNow(Date.now());
        setNotice(
          typeof err?.detail === 'string'
            ? err.detail
            : 'A code is already on its way. Use the most recent one you received.'
        );
        // Minutes of waiting rather than seconds means the ceiling, not the
        // pacing cooldown, so give them a way to reach a person.
        if (wait > 120) setBlocked(true);
        track(EVENTS.ONBOARDING_OTP_SEND_FAILED, { reason: 'rate_limited', wait });
        return;
      }
      setBlocked(true);
      track(EVENTS.ONBOARDING_OTP_SEND_FAILED, { reason: 'both_channels_failed' });
      // The endpoint explains exactly what went wrong; the generic status
      // mapping turns its 502 into "the server is busy or restarting", which
      // is both wrong and unactionable.
      setError(
        typeof err?.detail === 'string'
          ? err.detail
          : getFriendlyErrorMessage(err, 'We could not send the code.')
      );
    } finally {
      inFlight.current = null;
      setSending(false);
    }
  }, [phone, email, onVerified]);

  // Open the step: send ONLY if there is nothing live already.
  useEffect(() => {
    if (openedOnce.current) return;
    openedOnce.current = true;

    const saved = readSendState();
    const t = Date.now();
    const contactsMatch = saved && saved.phone === phone && saved.email === email;
    const codeStillLive = contactsMatch && saved.expiresAt > t;
    const stillCoolingDown = contactsMatch && saved.resendAt > t;

    if (codeStillLive || stillCoolingDown) {
      setReached(saved.reached || []);
      setFailed(saved.failed || []);
      setDevEcho(!!saved.devEcho);
      setResendAt(saved.resendAt);
      setExpiresAt(saved.expiresAt || 0);
      setNow(t);
      if (!codeStillLive) setNotice('Your last code has expired. You can send a new one in a moment.');
      return;
    }

    send();
  }, [send, phone, email]);

  // Ticks while either countdown is live: the resend cooldown, and the code's
  // own expiry. Showing the code dying is what makes "send a new one" read as
  // the next step rather than as an admission that the last one failed.
  useEffect(() => {
    if (resendAt <= now && expiresAt <= now) return undefined;
    const t = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(t);
  }, [resendAt, expiresAt, now]);

  const verify = async () => {
    if (code.length < 4) return;
    setVerifying(true);
    setError('');
    setNotice('');
    try {
      await api.post('/security/signup-otp/verify', { code });
      clearSendState();
      track(EVENTS.ONBOARDING_OTP_VERIFIED, { wrong_tries: wrongTries, resends });
      onVerified();
    } catch (err) {
      setError(
        typeof err?.detail === 'string'
          ? err.detail
          : getFriendlyErrorMessage(err, 'That code did not work.')
      );
      const tries = wrongTries + 1;
      setWrongTries(tries);
      track(EVENTS.ONBOARDING_OTP_WRONG, { wrong_tries: tries, resends });
      // Motion on the input, not the card: the six digits are what was wrong.
      setShake(true);
      setTimeout(() => setShake(false), 400);
      if (err?.status === 429) {
        // Out of tries on the live codes. Open the resend when the server says.
        setResendAt(Date.now() + (err.retryAfter || RESEND_SECONDS) * 1000);
        setNow(Date.now());
        setCode('');
      }
    } finally {
      setVerifying(false);
    }
  };

  const saveContacts = async () => {
    const next = { phone: draft.phone.trim(), email: draft.email.trim() };
    track(EVENTS.ONBOARDING_CONTACTS_EDITED, {
      phone_changed: next.phone !== phone,
      email_changed: next.email !== email,
      wrong_tries: wrongTries,
    });
    setPhone(next.phone);
    setEmail(next.email);
    setEditing(false);
    // Fixing the contact is a fresh start, not a continuation of the trouble:
    // the counters that were escalating towards "message support" reset, or
    // the person who just corrected a typo lands straight on the panic panel.
    setWrongTries(0);
    setResends(0);
    setBlocked(false);
    // A corrected typo resends immediately: the cooldown exists to stop somebody
    // hammering the same wrong number, not to punish them for fixing it, and the
    // server waives it for a genuine contact change too.
    setResendAt(0);
    await send(next);
  };

  const resend = () => {
    const n = resends + 1;
    setResends(n);
    track(EVENTS.ONBOARDING_OTP_RESENT, { resends: n, wrong_tries: wrongTries });
    send();
  };

  const supportLink = `https://wa.me/${SUPPORT_PHONE_RAW}?text=${encodeURIComponent(
    `Hi MolarPlus support, I cannot receive my verification code.\nPhone: ${phone}\nEmail: ${email}`
  )}`;

  /**
   * One row per channel, naming the destination and saying honestly what we
   * know about it.
   *
   * "Sent" is the strongest word used anywhere here, and it is the true one:
   * no delivery webhook ever updates a notification log, so success from a
   * provider means the message was accepted for sending and nothing more.
   * The old copy said "We sent a code to your WhatsApp and your email", which
   * a person reads as a promise that it arrived.
   */
  const channels = [
    {
      key: 'whatsapp',
      Icon: WhatsAppIcon,
      iconCls: 'text-[#25D366]',
      name: 'WhatsApp',
      to: maskPhone(phone),
    },
    {
      key: 'email',
      Icon: Mail,
      iconCls: 'text-gray-400',
      name: 'Email',
      to: maskEmail(email),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2a276e]/10">
          <ShieldCheck className="h-5 w-5 text-[#2a276e]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-900">Confirm it is really you</h3>
          <p className="mt-0.5 text-sm text-gray-500 leading-relaxed">
            This is how you get back in if you are ever locked out, so it has to be a phone and an
            address you actually use.
          </p>
        </div>
      </div>

      {/* Contacts, with an obvious way to fix a typo. */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
        {editing ? (
          <div className="space-y-3">
            <div>
              <label htmlFor="vp" className="mb-1 block text-xs font-semibold text-gray-500">WhatsApp number</label>
              <input
                id="vp"
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                inputMode="tel"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#2a276e]"
              />
            </div>
            <div>
              <label htmlFor="ve" className="mb-1 block text-xs font-semibold text-gray-500">Email address</label>
              <input
                id="ve"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                inputMode="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#2a276e]"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveContacts}
                disabled={sending || !draft.phone.trim() || !draft.email.trim()}
                className="flex-1 rounded-lg bg-[#2a276e] px-4 py-2.5 min-h-[2.75rem] text-sm font-semibold text-white hover:bg-[#1a1548] inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sending ? 'Sending' : 'Save and resend'}
                {sending && <Spinner className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg px-4 py-2.5 min-h-[2.75rem] text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5 text-sm">
              <p className="truncate font-medium text-gray-800">{phone || 'No number'}</p>
              <p className="truncate text-gray-500">{email || 'No email'}</p>
            </div>
            <button
              onClick={() => { setDraft({ phone, email }); setEditing(true); }}
              className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#2a276e] hover:underline min-h-[2.25rem]"
            >
              <Pencil size={12} /> Change
            </button>
          </div>
        )}
      </div>

      {!editing && (
        <>
          {devEcho ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Development mode: your code is in the backend log, not on your phone.
            </p>
          ) : (
            <div>
              <p className="mb-2 text-sm text-gray-500">
                {sending
                  ? 'Sending your 6-digit code…'
                  : 'We sent one 6-digit code to both. Either message works.'}
              </p>
              <ul className="space-y-1.5">
                {channels.map((channel) => {
                  const { key, iconCls, name, to } = channel;
                  const Icon = channel.Icon;
                  const didFail = failed.includes(key);
                  const didSend = reached.includes(key);
                  return (
                    <li
                      key={key}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs ${
                        didFail
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-gray-200 bg-white'
                      } ${sending ? 'animate-ob-pulse' : ''}`}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${didFail ? 'text-amber-500' : iconCls}`} />
                      <span className="shrink-0 font-semibold text-gray-700">{name}</span>
                      <span className="min-w-0 flex-1 truncate text-gray-500">{to || 'not set'}</span>
                      {didFail ? (
                        <span className="shrink-0 font-semibold text-amber-700">did not go</span>
                      ) : didSend ? (
                        <CheckCircle2 size={13} className="shrink-0 animate-ob-done text-green-500" />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* One channel down, the other fine. Said plainly so nobody sits
              waiting on a WhatsApp that is never arriving. */}
          {failed.length === 1 && reached.length === 1 && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {failed[0] === 'whatsapp'
                ? 'WhatsApp did not go through, so use the code in your email.'
                : 'The email did not go through, so use the code on WhatsApp.'}
            </p>
          )}

          {/* The first thing to suggest when a code "never arrived", because
              it is the likeliest and it costs them one look. Held back until
              something has actually gone wrong, so a clean first pass stays
              clean. */}
          {(wrongTries > 0 || resends > 0) && reached.includes('email') && (
            <p className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <Inbox size={13} className="mt-0.5 shrink-0 text-gray-400" />
              No email? Check spam and promotions — it comes from a name your inbox has not
              seen before.
            </p>
          )}

          <div>
            <label htmlFor="otp" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Enter the code
            </label>
            <input
              id="otp"
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && verify()}
              placeholder="••••••"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className={`w-full rounded-lg border bg-white px-3 py-3 text-center text-2xl font-bold tracking-[0.4em] outline-none focus:border-[#2a276e] ${
                error ? 'border-red-300' : 'border-gray-300'
              } ${shake ? 'animate-ob-shake' : ''}`}
            />
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
              {expiresIn > 0 ? (
                <>
                  <Clock size={11} className="shrink-0" />
                  {/* A number that moves is the difference between "this is
                      taking a while" and "this has stopped working". */}
                  Expires in {mmss(expiresIn)}. Sent more than one? Any recent code works.
                </>
              ) : (
                'If more than one message arrived, any of the recent codes will work.'
              )}
            </p>
          </div>

          {notice && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {notice}
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            onClick={verify}
            disabled={verifying || code.length < 4}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2a276e] py-3 min-h-[3rem] font-semibold text-white transition-colors hover:bg-[#1a1548] disabled:opacity-50"
          >
            {verifying ? <><Loader2 size={16} className="animate-spin" /> Checking</> : <><CheckCircle2 size={16} /> Verify and finish</>}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <button
              onClick={resend}
              disabled={sending || cooldown > 0}
              className="font-medium text-gray-500 hover:text-[#2a276e] disabled:text-gray-300"
            >
              {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend the code'}
            </button>
            <a
              href={supportLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track(EVENTS.ONBOARDING_SUPPORT_CLICKED, {
                wrong_tries: wrongTries, resends, placement: 'inline',
              })}
              className="inline-flex items-center gap-1.5 font-medium text-gray-400 hover:text-gray-600"
            >
              <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" /> Need help?
            </a>
          </div>

          {/* The dead-end guard.
              It used to wait for `blocked`, which needs BOTH channels to
              report failure — and since a provider merely accepting a message
              counts as success, a phone number that cannot exist still reads
              as reached. The one clinic that proved it sent four codes and
              typed twenty-two wrong ones without ever seeing this panel, then
              left. It now opens on repeated trouble of any kind, which is the
              signal that was there the whole time. */}
          {needsHuman && (
            <div className="animate-ob-rise rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">Still not getting the code?</p>
              <p className="mt-1 text-xs leading-relaxed text-red-600">
                The likeliest cause is a typo in the number or the address above, so check those
                first. Otherwise message us and we will verify your clinic by hand. Nothing you
                have set up is lost either way.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={supportLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track(EVENTS.ONBOARDING_SUPPORT_CLICKED, {
                    wrong_tries: wrongTries, resends, placement: 'panel',
                  })}
                  className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" /> Message support on WhatsApp
                </a>
                <button
                  onClick={() => { setDraft({ phone, email }); setEditing(true); }}
                  className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <Pencil size={12} /> Check my number
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VerifyContactStep;
