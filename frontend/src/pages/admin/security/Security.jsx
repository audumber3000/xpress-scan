import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck, Smartphone, Mail, CheckCircle2, AlertCircle, Loader2, X, Pencil,
} from 'lucide-react';
import { notify } from '../../../utils/notify';
import { api } from '../../../utils/api';
import MasterPasswordCard from './MasterPasswordCard';

/**
 * Security — the clinic's recovery contact: a phone and an email, each verified
 * by OTP (WhatsApp code for the phone, email code for the email). These are the
 * contacts we'll use for account recovery and sensitive actions.
 *
 * Below them sits the master password, which is what those verified contacts
 * are for in practice: changing it needs a code on the recovery phone, and it
 * is what the app asks for before a delete nothing can undo.
 */

const CHANNELS = {
  whatsapp: { field: 'security_phone', verifiedField: 'security_phone_verified', label: 'Phone', Icon: Smartphone, placeholder: '9876543210', help: 'We send a WhatsApp code to verify this number.' },
  email: { field: 'security_email', verifiedField: 'security_email_verified', label: 'Email', Icon: Mail, placeholder: 'owner@clinic.com', help: 'We email a code to verify this address.' },
};

const Security = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // 'whatsapp' | 'email' | null
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [otp, setOtp] = useState(null);           // { channel } while verifying
  const [code, setCode] = useState('');
  // Which channel is mid-send, not merely whether one is. Both cards render
  // from the same map, so a shared boolean made the phone card announce
  // "Sending…" when you'd clicked Verify on the email.
  const [sending, setSending] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get('/security'));
    } catch (e) {
      notify.problem('Could not load security settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (channel) => {
    setEditing(channel);
    setDraft(data?.[CHANNELS[channel].field] || '');
  };

  const saveContact = async (channel) => {
    setSaving(true);
    try {
      const updated = await api.put('/security', { [CHANNELS[channel].field]: draft.trim() });
      setData(updated);
      setEditing(null);
    } catch (e) {
      notify.problem(e, 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const sendCode = async (channel) => {
    setSending(channel);
    try {
      await api.post('/security/otp/send', { channel });
      setOtp({ channel });
      setCode('');
      notify.done(channel === 'whatsapp' ? 'Code sent on WhatsApp' : 'Code sent to your email');
    } catch (e) {
      notify.problem(e, 'Could not send the code');
    } finally {
      setSending(null);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) { notify.problem('Enter the code'); return; }
    setVerifying(true);
    try {
      await api.post('/security/otp/verify', { channel: otp.channel, code: code.trim() });
      notify.done('Verified');
      setOtp(null);
      load();
    } catch (e) {
      notify.problem(e, 'Could not verify the code');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-300" size={24} /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck size={20} className="text-[#29828a]" /> Security
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Your recovery phone and email. We use these for account recovery and to confirm sensitive actions, so keep them verified.
        </p>
      </div>

      <div className="max-w-2xl space-y-4">
        {Object.entries(CHANNELS).map(([channel, meta]) => {
          const value = data?.[meta.field] || '';
          const verified = !!data?.[meta.verifiedField];
          const isEditing = editing === channel;
          return (
            <div key={channel} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2.5 rounded-lg bg-[#29828a]/10 text-[#29828a]"><meta.Icon size={18} /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder={meta.placeholder}
                          className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#29828a] w-56"
                        />
                        <button onClick={() => saveContact(channel)} disabled={saving} className="px-3 py-1.5 bg-[#29828a] text-white text-xs font-semibold rounded-lg hover:bg-[#216b71] disabled:opacity-50">
                          {saving ? '…' : 'Save'}
                        </button>
                        <button onClick={() => setEditing(null)} disabled={saving} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-gray-600 truncate">{value || <span className="text-gray-400 italic">Not set</span>}</p>
                        <button onClick={() => startEdit(channel)} className="text-gray-400 hover:text-[#29828a]"><Pencil size={13} /></button>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{meta.help}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {verified ? (
                    <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <CheckCircle2 size={12} /> Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                      <AlertCircle size={12} /> Unverified
                    </span>
                  )}
                  {/* Solid, not outlined: verifying is the one thing this page
                      exists for, so it should read as the primary action. */}
                  {!verified && value && !isEditing && (
                    <button onClick={() => sendCode(channel)} disabled={sending === channel} className="text-xs font-semibold bg-[#29828a] hover:bg-[#216b71] text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
                      {sending === channel ? 'Sending…' : 'Verify'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* The six digits that gate destructive deletes. Changing them is
            verified against the phone above, so it lives directly under it. */}
        <MasterPasswordCard
          securityPhone={data?.security_phone}
          onPhoneVerified={load}
        />
      </div>

      {/* OTP entry modal */}
      {otp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[1px] p-4" onClick={() => !verifying && setOtp(null)}>
          {/* A modal keeps its lift — it sits over a dimmed page and needs to
              read as detached. The no-shadow rule is about cards in the flow. */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Enter the code</h3>
              <button onClick={() => setOtp(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-500">
                We sent a 6-digit code to your {otp.channel === 'whatsapp' ? 'WhatsApp number' : 'email'}. It expires in 5 minutes.
              </p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                inputMode="numeric"
                className="w-full text-center tracking-[0.5em] text-2xl font-bold px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#29828a]"
              />
              <div className="flex items-center justify-between">
                <button onClick={() => sendCode(otp.channel)} disabled={sending === otp.channel} className="text-xs text-gray-500 hover:text-[#29828a]">
                  {sending === otp.channel ? 'Sending…' : 'Resend code'}
                </button>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setOtp(null)} disabled={verifying} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={verifyCode} disabled={verifying || code.length < 4} className="flex items-center gap-2 px-4 py-2 bg-[#29828a] hover:bg-[#216b71] disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg">
                {verifying ? <Loader2 size={14} className="animate-spin" /> : null} Verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Security;
