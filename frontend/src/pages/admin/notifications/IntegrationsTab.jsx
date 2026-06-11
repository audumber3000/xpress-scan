import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ExternalLink, CheckCircle2, AlertTriangle, Smartphone, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../../utils/api';

const WAREACH_PORTAL = 'http://116.203.142.56:3000/';

/**
 * Integrations tab — now a single, real integration: WA Reach (own-number
 * WhatsApp via WhatsApp Web, Pro only). Connecting links the clinic's own
 * number; once connected, patient WhatsApp (invoices, reminders, etc.) sends
 * from that number for free. The MSG91 platform path is untouched.
 */
const IntegrationsTab = () => {
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [status, setStatus] = useState('disconnected'); // disconnected|connecting|connected|failed
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get('/integrations/wareach/status');
      setIsPro(!!res.is_pro);
      setStatus(res.status || 'disconnected');
      setPhoneNumber(res.phone_number || null);
    } catch (e) {
      // leave defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // While pairing, refresh the QR + poll status until connected/failed.
  useEffect(() => {
    if (status !== 'connecting') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const [qrRes, statusRes] = await Promise.all([
          api.get('/integrations/wareach/qr').catch(() => null),
          api.get('/integrations/wareach/status').catch(() => null),
        ]);
        if (qrRes?.qr) setQr(qrRes.qr);
        const s = statusRes?.status || qrRes?.status;
        if (s && s !== 'connecting') {
          setStatus(s);
          setPhoneNumber(statusRes?.phone_number || null);
          if (s === 'connected') { setQr(null); toast.success('WhatsApp connected!'); }
        }
      } catch (e) { /* keep polling */ }
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const res = await api.post('/integrations/wareach/connect');
      setStatus(res.status || 'connecting');
      if (res.qr) setQr(res.qr);
    } catch (e) {
      const detail = e.response?.data?.detail || 'Could not start the connection. Please try again.';
      toast.error(detail);
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect your WhatsApp number? Patient messages will go back to the standard (paid) channel.')) return;
    setBusy(true);
    try {
      await api.post('/integrations/wareach/disconnect');
      setStatus('disconnected');
      setPhoneNumber(null);
      setQr(null);
      toast.success('WhatsApp disconnected.');
    } catch (e) {
      toast.error('Could not disconnect. Please try again.');
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

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">WhatsApp integration</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Connect your clinic's own WhatsApp number to send patient messages (invoices, reminders, prescriptions) for free.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="p-5 bg-green-50/60 border-b border-gray-100 flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center text-white font-bold shrink-0">
            WA
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900 text-[15px]">WA Reach</h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">Free · Pro</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Send from your own WhatsApp number via WhatsApp Web. No per-message charge — usage is handled by WA Reach.
            </p>
          </div>
        </div>

        <div className="p-5">
          {/* Non-Pro upsell */}
          {!isPro ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">This is a Pro feature.</p>
              <p className="mt-1 text-amber-700">Upgrade to Professional to connect your own WhatsApp number and send patient messages for free.</p>
              <a href="/subscription" className="inline-flex items-center gap-1.5 mt-3 px-3 py-2 bg-[#2a276e] text-white text-xs font-semibold rounded-lg hover:bg-[#1a1548]">
                Upgrade to Pro
              </a>
            </div>
          ) : status === 'connected' ? (
            /* Connected state */
            <div>
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 size={18} />
                <span className="font-semibold text-sm">Connected</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <Smartphone size={16} className="text-gray-400" />
                {phoneNumber ? `+${phoneNumber}` : 'Your WhatsApp number'}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Patient WhatsApp messages now send from your number — <span className="font-semibold text-green-700">free</span>.
              </p>
              <button
                onClick={handleDisconnect}
                disabled={busy}
                className="mt-4 px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          ) : status === 'connecting' ? (
            /* Pairing — show QR */
            <div className="flex flex-col items-center text-center">
              <p className="text-sm font-semibold text-gray-900">Scan to connect</p>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                Open WhatsApp → <span className="font-medium">Settings → Linked devices → Link a device</span>, then scan this code.
              </p>
              <div className="w-52 h-52 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden">
                {qr ? (
                  <img src={qr} alt="WhatsApp QR code" className="w-full h-full object-contain" />
                ) : (
                  <Loader2 className="animate-spin text-gray-300" size={28} />
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
                <RefreshCw size={12} /> Code refreshes automatically
              </div>
              <button
                onClick={handleDisconnect}
                disabled={busy}
                className="mt-3 text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            /* Disconnected / failed */
            <div>
              {status === 'failed' && (
                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 mb-4 text-sm text-red-700">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>Your WhatsApp got disconnected. Reconnect to keep sending from your own number.</span>
                </div>
              )}
              <p className="text-sm text-gray-600 mb-4">
                Link your clinic's WhatsApp number to start sending patient messages from it, for free.
              </p>
              <button
                onClick={handleConnect}
                disabled={busy}
                className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
              >
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Smartphone size={16} />}
                {status === 'failed' ? 'Reconnect WhatsApp' : 'Connect your WhatsApp'}
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400">Powered by WA Reach</span>
          <a
            href={WAREACH_PORTAL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-700 transition-colors"
          >
            <ExternalLink size={11} /> Open WA Reach portal
          </a>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsTab;
