import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Search, Copy, Check, ExternalLink, RefreshCw, ArrowLeft, Clock } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../utils/api';
import WhatsAppIcon from '../../components/common/WhatsAppIcon';
import Spinner from '../../components/common/Spinner';
import InlineFeedback from '../../components/common/InlineFeedback';
import { generatePatientPersona, generateInitialsAvatar } from '../../utils/avatar';
import { languageLabel } from '../../components/consents/consentContent';

/**
 * Send one consent form to one patient: pick them, get a signing link, send it.
 *
 * Two states and nothing else. The link is made by the backend
 * (POST /consents/links) from the stored form and patient, so what the patient
 * signs is exactly the saved wording, and a failure says why instead of
 * "Failed to generate link".
 *
 * Links live five minutes (nexus), so the ready state counts down and offers a
 * fresh one when it runs out rather than handing out a dead link.
 */
const SendConsentDrawer = ({ template, onClose, onLinkCreated }) => {
  const open = !!template;
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState(null);
  const [error, setError] = useState('');
  const [creatingFor, setCreatingFor] = useState(null);
  const [link, setLink] = useState(null);       // { token, url, expiresAt, patient }
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const searchRef = useRef(null);

  const reset = useCallback(() => {
    setQuery(''); setPatients(null); setError(''); setCreatingFor(null);
    setLink(null); setCopied(false); setSending(false); setSentTo('');
  }, []);

  useEffect(() => { if (!open) reset(); }, [open, reset]);

  // Server search, debounced: the list endpoint caps at 100 rows, so filtering
  // in the browser would hide everyone past the first page.
  useEffect(() => {
    if (!open || link) return undefined;
    const q = query.trim();
    const t = setTimeout(async () => {
      try {
        const data = await api.get('/patients/', {
          params: { skip: 0, limit: 8, ...(q.length >= 2 ? { search: q } : {}) },
        });
        setPatients(Array.isArray(data) ? data : []);
      } catch {
        setPatients([]);
      }
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [open, query, link]);

  useEffect(() => {
    if (open && !link) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, link]);

  useEffect(() => {
    if (!link) return undefined;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((link.expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [link]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const createLink = async (patient) => {
    if (creatingFor) return;
    setCreatingFor(patient.id);
    setError('');
    try {
      const res = await api.post('/consents/links', { template_id: template.id, patient_id: patient.id });
      setLink({
        token: res.token,
        url: `${window.location.origin}${res.sign_url}`,
        expiresAt: Date.now() + (res.expires_in || 300) * 1000,
        patient: res.patient || patient,
      });
      setCopied(false);
      setSentTo('');
      onLinkCreated?.();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not create the link. Please try again.'));
    } finally {
      setCreatingFor(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copying was blocked by the browser. Select the link and copy it by hand.');
    }
  };

  const sendWhatsApp = async () => {
    setSending(true);
    setError('');
    try {
      await api.post(`/consents/links/${link.token}/send-whatsapp`, { consentLink: link.url });
      setSentTo(link.patient.phone || link.patient.name);
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not send that WhatsApp message.'));
    } finally {
      setSending(false);
    }
  };

  const expired = link && secondsLeft === 0;
  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const avatar = (p) => (
    <img
      src={generatePatientPersona({ name: p.name }, 64)}
      onError={(e) => { e.target.onerror = null; e.target.src = generateInitialsAvatar(p.name || 'Patient'); }}
      alt=""
      className="w-9 h-9 rounded-full shrink-0 bg-gray-100 border border-gray-100"
    />
  );

  return (
    <div className={`fixed inset-0 z-50 flex justify-end ${open ? 'visible' : 'invisible'}`}>
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-consent-title"
        className={`relative z-10 w-full max-w-md bg-white h-full border-l border-gray-200 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="send-consent-title" className="text-lg font-bold text-gray-900">Send for signing</h2>
            <div className="mt-1 flex items-center gap-2 min-w-0">
              <p className="text-sm text-gray-500 truncate">{template?.name}</p>
              {template?.language && template.language !== 'en' && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-[#2a276e]/5 text-[#2a276e]">
                  {languageLabel(template.language)}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
            <X size={18} />
          </button>
        </div>

        {error && <div className="px-6 pt-4"><InlineFeedback tone="error">{error}</InlineFeedback></div>}

        {!link ? (
          /* ── Pick the patient ── */
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-6 pt-4 pb-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  id="send-consent-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search patient by name or phone"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/15"
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">
                {query.trim().length >= 2 ? 'Matching patients' : 'Recent patients. Pick one to make their link.'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4">
              {patients === null ? (
                <div className="py-10 flex justify-center"><Spinner className="w-5 h-5" /></div>
              ) : patients.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">
                  {query.trim() ? `No patient matches "${query.trim()}"` : 'No patients yet'}
                </p>
              ) : (
                <ul>
                  {patients.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => createLink(p)}
                        disabled={!!creatingFor}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 disabled:opacity-60"
                      >
                        {avatar(p)}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                          <p className="text-xs text-gray-500 tabular-nums">{p.phone || 'No phone on file'}</p>
                        </div>
                        {creatingFor === p.id
                          ? <Spinner className="w-4 h-4" />
                          : <span className="text-xs font-semibold text-[#2a276e]">Get link</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          /* ── Link ready ── */
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
              {avatar(link.patient)}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{link.patient.name}</p>
                <p className="text-xs text-gray-500 tabular-nums">{link.patient.phone || 'No phone on file'}</p>
              </div>
              <button
                type="button"
                onClick={() => { setLink(null); setError(''); }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-[#2a276e]"
              >
                <ArrowLeft size={13} /> Change
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="send-consent-link" className="text-xs font-medium text-gray-500">Signing link</label>
                <span className={`inline-flex items-center gap-1 text-xs tabular-nums ${expired ? 'text-red-600' : secondsLeft < 60 ? 'text-amber-700' : 'text-gray-500'}`}>
                  <Clock size={12} /> {expired ? 'Expired' : `Expires in ${mmss}`}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  id="send-consent-link"
                  readOnly
                  value={link.url}
                  onFocus={(e) => e.target.select()}
                  className={`flex-1 min-w-0 px-3 py-2 rounded-lg border text-xs font-mono ${expired ? 'border-gray-200 text-gray-400 bg-gray-50 line-through' : 'border-gray-200 text-gray-700 bg-white'}`}
                />
                <button
                  type="button"
                  onClick={copy}
                  disabled={expired}
                  aria-label="Copy link"
                  className="shrink-0 px-3 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {expired ? (
              <button
                type="button"
                onClick={() => createLink(link.patient)}
                disabled={!!creatingFor}
                className="w-full py-2.5 rounded-lg bg-[#2a276e] text-white text-sm font-semibold hover:bg-[#1a1548] inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {creatingFor ? <Spinner className="w-4 h-4" /> : <RefreshCw size={15} />} Make a fresh link
              </button>
            ) : sentTo ? (
              <InlineFeedback tone="success">
                Sent on WhatsApp to {sentTo}. It shows under Sent links once they open it.
              </InlineFeedback>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={sendWhatsApp}
                  disabled={sending || !link.patient.phone}
                  className="w-full py-2.5 rounded-lg bg-[#25D366] text-white text-sm font-semibold hover:bg-[#20bd5a] inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sending ? <Spinner className="w-4 h-4" /> : <WhatsAppIcon size={18} />}
                  {sending ? 'Sending' : 'Send on WhatsApp'}
                </button>
                {!link.patient.phone && (
                  <p className="text-xs text-gray-500">No phone on file, so copy the link and share it another way.</p>
                )}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 inline-flex items-center justify-center gap-2"
                >
                  <ExternalLink size={15} /> Open to sign on this device
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={() => { setLink(null); setQuery(''); setError(''); }}
              className="self-start text-sm font-semibold text-[#2a276e] hover:underline"
            >
              Send to another patient
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};

export default SendConsentDrawer;
