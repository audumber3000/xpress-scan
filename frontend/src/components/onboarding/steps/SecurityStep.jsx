import React, { useEffect, useState } from 'react';
import { KeyRound, AlertTriangle, Send } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../../utils/api';

/**
 * Choose the six digits that gate an irreversible delete.
 *
 * Written inline rather than by embedding MasterPasswordCard, which opens its
 * own modal at a lower z-index and would render *behind* this one. Same two
 * endpoints, same rules, no nesting:
 *
 *   POST /security/master-password/otp   texts a code to the recovery phone
 *   PUT  /security/master-password       {code, new_password}
 *
 * The code goes to the phone rather than being authorised by the current
 * password on purpose: knowing the current six digits must not be enough to
 * change them, or anyone who was ever told the code could lock the owner out.
 *
 * Signup verification runs immediately before this, so the recovery phone is
 * already on file and already verified by the time anybody gets here.
 */

const PIN_LENGTH = 6;
const field = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition-colors focus:border-[#2a276e]';

const SecurityStep = ({ onDone, renderFooter }) => {
  const [phone, setPhone] = useState(null);
  const [stage, setStage] = useState('send');   // 'send' | 'enter'
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/security/master-password')
      .then((s) => setPhone(s.phone))
      .catch(() => setPhone(null));
  }, []);

  const sendCode = async () => {
    setSending(true);
    setError('');
    try {
      await api.post('/security/master-password/otp');
      setStage('enter');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not send the code.'));
    } finally {
      setSending(false);
    }
  };

  const save = async () => {
    if (pin !== confirm) { setError('The two PINs do not match.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.put('/security/master-password', { code, new_password: pin });
      onDone();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not set the master password.'));
    } finally {
      setSaving(false);
    }
  };

  const masked = phone ? `${'•'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}` : null;
  const ready = code.length >= 4 && pin.length === PIN_LENGTH && confirm.length === PIN_LENGTH;

  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#29828a]/10">
          <KeyRound className="h-5 w-5 text-[#29828a]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-900">Set your master password</h3>
          <p className="mt-0.5 text-sm text-gray-500 leading-relaxed">
            Six digits, asked for before deleting a patient, a paid bill, or a payment already
            recorded. Until you pick your own it stays on{' '}
            <span className="font-mono font-semibold">123456</span>, which every clinic knows.
          </p>
        </div>
      </div>

      {!phone ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          We need a verified recovery phone before this can be changed. Skip for now and set it in
          Control Center once your phone is verified.
        </p>
      ) : stage === 'send' ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            We will send a code on WhatsApp to <span className="font-semibold">{masked}</span> to
            confirm it is you.
          </p>
          <button
            onClick={sendCode}
            disabled={sending}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#29828a] px-4 py-2.5 min-h-[2.75rem] text-sm font-semibold text-white transition-colors hover:bg-[#216b71] disabled:opacity-50"
          >
            <Send size={14} /> {sending ? 'Sending…' : 'Send me the code'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="mp-code" className="mb-1 block text-xs font-semibold text-gray-600">
              Code sent to {masked}
            </label>
            <input
              id="mp-code" className={field} value={code} inputMode="numeric"
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              placeholder="6-digit code"
            />
          </div>
          <div>
            <label htmlFor="mp-pin" className="mb-1 block text-xs font-semibold text-gray-600">
              New master password
            </label>
            <input
              id="mp-pin" className={`${field} tracking-[0.3em]`} value={pin} inputMode="numeric" type="password"
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)); setError(''); }}
              placeholder="••••••"
            />
          </div>
          <div>
            <label htmlFor="mp-confirm" className="mb-1 block text-xs font-semibold text-gray-600">
              Type it again
            </label>
            <input
              id="mp-confirm" className={`${field} tracking-[0.3em]`} value={confirm} inputMode="numeric" type="password"
              onChange={(e) => { setConfirm(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)); setError(''); }}
              placeholder="••••••"
            />
          </div>
          <button
            onClick={sendCode}
            disabled={sending}
            className="text-xs font-medium text-gray-500 hover:text-[#29828a] disabled:text-gray-300"
          >
            {sending ? 'Sending…' : 'Send the code again'}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      {renderFooter({
        onSave: save,
        saving,
        disabled: !phone || stage !== 'enter' || !ready,
        saveLabel: 'Set password',
      })}
    </div>
  );
};

export default SecurityStep;
