import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { notify } from '../../../utils/notify';
import { api } from '../../../utils/api';
import { formatDateTime } from '../../../utils/datetime';

/**
 * The clinic's master password: six digits asked for before a delete nothing
 * can undo. A patient and everything attached to them, a paid bill, a payment
 * already receipted. Those used to be flatly refused; now they are possible,
 * but only for someone holding this code, and every use lands in the audit log.
 *
 * Every clinic starts on 123456 so nobody is locked out on day one, and this
 * card keeps saying so until the owner picks their own.
 *
 * Changing it needs a WhatsApp code on the recovery phone above, not the
 * current master password. Otherwise anyone who had been told the code once
 * could quietly change it and lock the owner out of their own clinic.
 */

const CODE_LENGTH = 6;

const MasterPasswordCard = ({ securityPhone, onPhoneVerified }) => {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // Change flow, in order: send the code, then type it alongside the new PIN.
  const [step, setStep] = useState('send');   // 'send' | 'enter'
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(await api.get('/security/master-password'));
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const closeModal = () => {
    if (sending || saving) return;
    setOpen(false);
    setStep('send');
    setOtp(''); setPin(''); setConfirmPin(''); setError('');
  };

  const sendCode = async () => {
    setSending(true);
    setError('');
    try {
      await api.post('/security/master-password/otp');
      setStep('enter');
      notify.done('Code sent on WhatsApp');
    } catch (e) {
      const detail = typeof e?.detail === 'string' ? e.detail : null;
      setError(detail || 'Could not send the code');
    } finally {
      setSending(false);
    }
  };

  const save = async () => {
    if (pin.length !== CODE_LENGTH) { setError(`The new password must be exactly ${CODE_LENGTH} digits, numbers only`); return; }
    if (pin !== confirmPin) { setError('The two passwords do not match'); return; }
    if (otp.length < 4) { setError('Enter the code we sent on WhatsApp'); return; }
    setSaving(true);
    setError('');
    try {
      await api.put('/security/master-password', { code: otp, new_password: pin });
      notify.done('Master password updated');
      closeModal();
      load();
      // Saving also proves the recovery phone, so the card above should stop
      // showing "Unverified" without the owner repeating the same dance.
      onPhoneVerified?.();
    } catch (e) {
      const detail = typeof e?.detail === 'string' ? e.detail : null;
      setError(detail || 'Could not update the master password');
    } finally {
      setSaving(false);
    }
  };

  const isDefault = !!state?.is_default;
  const hasPhone = !!securityPhone;

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 rounded-lg bg-[#29828a]/10 text-[#29828a]"><KeyRound size={18} /></div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Master password</p>
              <p className="text-sm text-gray-600 mt-0.5">
                {loading
                  ? <span className="text-gray-400">Loading…</span>
                  : isDefault
                    ? <span>Still set to <span className="font-mono font-semibold">123456</span></span>
                    : <span className="font-mono">••••••</span>}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Asked for before deleting a patient, a paid bill, or a payment already recorded.
                {!isDefault && state?.updated_at && (
                  <> Last changed {formatDateTime(state.updated_at)}.</>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {loading ? null : isDefault ? (
              <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                <AlertTriangle size={12} /> Default
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle2 size={12} /> Set
              </span>
            )}
            <button
              onClick={() => { setOpen(true); setStep('send'); }}
              disabled={loading || !hasPhone}
              title={hasPhone ? undefined : 'Add and verify a recovery phone first'}
              className="text-xs font-semibold bg-[#29828a] hover:bg-[#216b71] text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDefault ? 'Set password' : 'Change'}
            </button>
          </div>
        </div>

        {/* The nudge, worth its own line while the default is still in place —
            a shared password everyone already knows protects nothing. */}
        {!loading && isDefault && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Every clinic starts on 123456, so please pick your own before staff start using the app.
              Share it only with the people you would trust to delete a patient's whole record.
            </p>
          </div>
        )}
        {!loading && !hasPhone && (
          <p className="mt-4 text-xs text-gray-500">
            Add a recovery phone above first. Changing the master password is confirmed by a WhatsApp code sent to it.
          </p>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">
                {isDefault ? 'Set the master password' : 'Change the master password'}
              </h3>
              <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X size={18} /></button>
            </div>

            {step === 'send' ? (
              <div className="p-5 space-y-3">
                <p className="text-sm text-gray-600 leading-relaxed">
                  We will send a code on WhatsApp to <span className="font-semibold text-gray-900">{securityPhone}</span>.
                  You will need it on the next screen along with your new password.
                </p>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    WhatsApp code
                  </label>
                  <input
                    value={otp}
                    onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    placeholder="••••••"
                    inputMode="numeric"
                    autoFocus
                    className="w-full text-center tracking-[0.5em] text-xl font-bold px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#29828a]"
                  />
                  <button
                    onClick={sendCode}
                    disabled={sending}
                    className="mt-1.5 text-xs text-gray-500 hover:text-[#29828a] disabled:opacity-50"
                  >
                    {sending ? 'Sending…' : 'Resend code'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      New {CODE_LENGTH}-digit code
                    </label>
                    <input
                      type="password"
                      value={pin}
                      onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH)); setError(''); }}
                      placeholder="••••••"
                      inputMode="numeric"
                      autoComplete="new-password"
                      className="w-full text-center tracking-[0.3em] font-bold px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#29828a]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Confirm
                    </label>
                    <input
                      type="password"
                      value={confirmPin}
                      onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH)); setError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && save()}
                      placeholder="••••••"
                      inputMode="numeric"
                      autoComplete="new-password"
                      className="w-full text-center tracking-[0.3em] font-bold px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#29828a]"
                    />
                  </div>
                </div>

                {/* Said out loud because the fields silently drop anything that
                    is not a digit. Without this, typing a letter looks like a
                    broken keyboard rather than a rule being enforced. */}
                <p className="text-xs text-gray-400">
                  <span className="font-semibold text-gray-500">Numbers only.</span>{' '}
                  Exactly {CODE_LENGTH} digits, no letters or symbols. Avoid 123456 and your clinic phone number.
                </p>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            )}

            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={sending || saving}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              {step === 'send' ? (
                <button
                  onClick={sendCode}
                  disabled={sending}
                  className="flex items-center gap-2 px-4 py-2 bg-[#29828a] hover:bg-[#216b71] disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg"
                >
                  {sending && <Loader2 size={14} className="animate-spin" />}
                  {sending ? 'Sending…' : 'Send code'}
                </button>
              ) : (
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#29828a] hover:bg-[#216b71] disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? 'Saving…' : 'Save password'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MasterPasswordCard;
