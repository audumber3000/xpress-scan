import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Smartphone, Loader2, RefreshCw, Info } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../../utils/api';
import { useAuth } from '../../../contexts/AuthContext';
import InlineFeedback from '../../../components/common/InlineFeedback';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { track, EVENTS } from '../../../analytics/track';

const POLL_MS = 4000;
// WhatsApp rotates the code every ~20 seconds and keeps doing so. A code nobody
// has scanned in three minutes has nobody looking at it, so stop polling and
// let them ask for a fresh one. (WA Reach itself gives up after ten.)
const PAIRING_WINDOW_MS = 3 * 60 * 1000;

const displayPhone = (p) => {
  const digits = String(p || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
};

/**
 * WhatsApp tab of the Integrations section.
 *
 * Two settings live here, and the second one wins over the first:
 *  - Manual WhatsApp: patient WhatsApp buttons open WhatsApp with the message
 *    pre-filled, so staff send it themselves.
 *  - Own number (WA Reach): links the clinic's WhatsApp so every patient
 *    message, automatic or from a button, goes out from it for free. While it is
 *    connected, manual mode is paused, because the buttons can already send from
 *    the same number without anyone copying anything.
 *
 * If the linked number drops, messages keep going out from the MolarPlus
 * number (charged as usual) until it is reconnected, so no patient misses one.
 */
const WhatsAppPanel = () => {
  const { user, refreshUser } = useAuth();
  const [savingManual, setSavingManual] = useState(false);
  const [manualError, setManualError] = useState('');
  const manualOn = !!user?.clinic?.manual_whatsapp;

  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [qr, setQr] = useState(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pairingStartedAt = useRef(null);
  // Held in a ref so the polling effect doesn't restart every time the auth
  // context hands out a new function.
  const refreshUserRef = useRef(refreshUser);
  refreshUserRef.current = refreshUser;

  const connected = status === 'connected';

  const toggleManual = async (val) => {
    setManualError('');
    try {
      setSavingManual(true);
      await api.put('/clinics/me', { manual_whatsapp: val });
      await refreshUser?.();
    } catch (e) {
      setManualError(getFriendlyErrorMessage(e, 'Could not update the setting. Please try again.'));
    } finally {
      setSavingManual(false);
    }
  };

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get('/integrations/wareach/status');
      setAvailable(res.available !== false);
      setStatus(res.status || 'disconnected');
      setPhoneNumber(res.phone_number || null);
      if (res.status === 'connecting') pairingStartedAt.current = Date.now();
    } catch {
      // leave defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // While pairing, keep the QR fresh and watch for the scan.
  useEffect(() => {
    if (status !== 'connecting' || expired) return undefined;
    const timer = setInterval(async () => {
      if (pairingStartedAt.current && Date.now() - pairingStartedAt.current > PAIRING_WINDOW_MS) {
        setExpired(true);
        setQr(null);
        return;
      }
      const res = await api.get('/integrations/wareach/qr').catch(() => null);
      if (!res) return;
      if (res.qr) setQr(res.qr);
      if (res.status && res.status !== 'connecting') {
        setStatus(res.status);
        setQr(null);
        if (res.status === 'connected') {
          const s = await api.get('/integrations/wareach/status').catch(() => null);
          setPhoneNumber(s?.phone_number || null);
          track(EVENTS.WAREACH_CONNECTED);
          // The patient WhatsApp buttons read this flag from the signed-in user.
          refreshUserRef.current?.();
        }
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [status, expired]);

  const handleConnect = async () => {
    setBusy(true);
    setActionError('');
    try {
      const res = await api.post('/integrations/wareach/connect');
      pairingStartedAt.current = Date.now();
      setExpired(false);
      setStatus(res.status || 'connecting');
      setQr(res.qr || null);
      if (res.status === 'connected') refreshUser?.();
    } catch (e) {
      setActionError(getFriendlyErrorMessage(e, 'Could not start the connection. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setConfirmOpen(false);
    setBusy(true);
    setActionError('');
    try {
      await api.post('/integrations/wareach/disconnect');
      setStatus('disconnected');
      setPhoneNumber(null);
      setQr(null);
      setExpired(false);
      refreshUser?.();
    } catch (e) {
      setActionError(getFriendlyErrorMessage(e, 'Could not disconnect. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  const phone = displayPhone(phoneNumber);

  return (
    <div className="max-w-2xl">
      {/* Manual WhatsApp: staff send it themselves from WhatsApp. */}
      <div className="mb-6 bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">Send WhatsApp manually from my own number</h3>
            {connected ? (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Paused while your number is connected below. Patient WhatsApp buttons send
                from {phone || 'your number'} automatically, so there is nothing to copy across.
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                When on, patient WhatsApp buttons (invoices, prescriptions) open WhatsApp with the message
                pre-filled, so you send it from your own account. When off, messages send automatically.
              </p>
            )}
          </div>
          <label className={`relative inline-flex items-center shrink-0 mt-0.5 ${connected ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              className="sr-only peer"
              checked={manualOn && !connected}
              disabled={savingManual || connected}
              onChange={(e) => toggleManual(e.target.checked)}
              aria-label="Send WhatsApp manually"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#29828a]/20 rounded-full peer peer-checked:bg-[#29828a] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 transition-all" />
          </label>
        </div>
        <InlineFeedback className="mt-2">{manualError}</InlineFeedback>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Your clinic's WhatsApp number</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Connect it once and every patient message, from reminders to invoices and prescriptions, goes out from it for free.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#29828a]/10 text-[#29828a] flex items-center justify-center shrink-0">
            <Smartphone size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900 text-[15px]">Own number</h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Free</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Patients see your clinic's number and can reply to it directly. No per-message charge.
            </p>
          </div>
        </div>

        <div className="p-5">
          {connected ? (
            <div>
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={18} />
                <span className="font-semibold text-sm">Connected</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-800 font-medium">
                <Smartphone size={16} className="text-gray-400" />
                {phone || 'Your WhatsApp number'}
              </div>
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                Patient WhatsApp now goes out from this number, <span className="font-semibold text-emerald-700">free</span>.
                If the phone ever drops off, messages go out from the MolarPlus number until you reconnect, so no patient misses one.
              </p>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={busy}
                className="mt-4 px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {busy && <Loader2 className="animate-spin" size={14} />}
                Disconnect
              </button>
              <InlineFeedback className="mt-2">{actionError}</InlineFeedback>
            </div>
          ) : status === 'connecting' ? (
            <div className="flex flex-col items-center text-center">
              <p className="text-sm font-semibold text-gray-900">Scan to connect</p>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                On the clinic's phone, open WhatsApp, go to <span className="font-medium">Settings, Linked devices, Link a device</span>, and scan this code.
              </p>
              <div className="w-52 h-52 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden">
                {expired ? (
                  <div className="px-4 text-xs text-gray-500">This code expired.</div>
                ) : qr ? (
                  <img src={qr} alt="WhatsApp QR code" className="w-full h-full object-contain" />
                ) : (
                  <Loader2 className="animate-spin text-gray-300" size={28} />
                )}
              </div>
              {expired ? (
                <button
                  onClick={handleConnect}
                  disabled={busy}
                  className="mt-3 px-4 py-2 bg-[#29828a] hover:bg-[#216b71] text-white text-sm font-semibold rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {busy ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                  Show a new code
                </button>
              ) : (
                <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
                  <RefreshCw size={12} /> The code refreshes on its own
                </div>
              )}
              <button
                onClick={handleDisconnect}
                disabled={busy}
                className="mt-3 text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Cancel
              </button>
              <InlineFeedback className="mt-2">{actionError}</InlineFeedback>
            </div>
          ) : (
            <div>
              {phone && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4 text-sm text-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    {phone} got disconnected. Patient messages are going out from the MolarPlus number until you reconnect it.
                  </span>
                </div>
              )}
              {!available ? (
                <p className="text-sm text-gray-500">
                  Connecting your own number isn't available right now. Patient messages keep going out from the MolarPlus number.
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Link your clinic's WhatsApp number to start sending patient messages from it, for free.
                  </p>
                  <button
                    onClick={handleConnect}
                    disabled={busy}
                    className="px-4 py-2.5 bg-[#29828a] hover:bg-[#216b71] text-white text-sm font-semibold rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {busy ? <Loader2 className="animate-spin" size={16} /> : <Smartphone size={16} />}
                    {phone ? 'Reconnect WhatsApp' : 'Connect your WhatsApp'}
                  </button>
                  <InlineFeedback className="mt-2">{actionError}</InlineFeedback>
                </>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-start gap-2 text-xs text-gray-500 leading-relaxed">
          <Info size={13} className="mt-0.5 shrink-0 text-gray-400" />
          <span>
            Use the clinic's WhatsApp Business number rather than someone's personal one. WhatsApp can restrict
            numbers that send a lot of automated messages, and a business number keeps patient chats in one place.
          </span>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        tone="danger"
        title="Disconnect your WhatsApp number?"
        message="Patient messages will go out from the MolarPlus number again, charged to your wallet as usual. You can reconnect any time."
        actions={[{ label: 'Disconnect', variant: 'danger', onClick: handleDisconnect }]}
      />
    </div>
  );
};

export default WhatsAppPanel;
