import React, { useEffect, useMemo, useState } from 'react';
import {
  Send, MessageSquare, Mail, RefreshCcw, Image as ImageIcon,
  Building2, Sprout, Phone, History, Beaker, AlertTriangle, CheckCircle2, X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { PageHeader, Card, TabBar, Spinner, fmt } from '../components/ui';

const TABS = [
  { id: 'clinics',  label: 'To Clinics',  icon: Building2 },
  { id: 'leads',    label: 'To Leads',    icon: Sprout },
  { id: 'numbers',  label: 'Bulk Phone',  icon: Phone },
  { id: 'history',  label: 'History',     icon: History },
];

// ---------- Shared bits ----------------------------------------------------

function useWhatsappTemplates() {
  const [templates, setTemplates] = useState([]);
  useEffect(() => {
    let alive = true;
    api.get('/marketing/whatsapp-templates')
      .then((res) => { if (alive && Array.isArray(res)) setTemplates(res); })
      .catch((err) => console.error('Failed to load whatsapp templates', err));
    return () => { alive = false; };
  }, []);
  return templates;
}

function TemplatePicker({ templates, value, onChange, headerImageUrl, onHeaderImageChange }) {
  const selected = templates.find((t) => t.name === value) || null;
  const requiresImage = !!selected?.requires_image;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          WhatsApp Template
        </label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400"
        >
          <option value="">Select template…</option>
          {templates.map((t) => (
            <option key={t.name} value={t.name}>
              {t.label}{t.requires_image ? ' · Image' : ''}
            </option>
          ))}
        </select>
        {selected && (
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold text-slate-700 flex items-center gap-2">
              {selected.name}
              {requiresImage && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium">
                  <ImageIcon size={10} /> Image header required
                </span>
              )}
            </div>
            {selected.description && (
              <div className="mt-1 text-xs text-slate-500">{selected.description}</div>
            )}
          </div>
        )}
      </div>

      {requiresImage && (
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Header Image URL
          </label>
          <input
            type="url"
            value={headerImageUrl || ''}
            onChange={(e) => onHeaderImageChange(e.target.value)}
            placeholder="https://your-cdn.example.com/banner.jpg"
            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400"
          />
          <div className="mt-1 text-[11px] text-slate-500">
            Public HTTPS URL — Meta / MSG91 fetch it at send-time.
          </div>
          {/^https?:\/\//i.test(headerImageUrl || '') && (
            <div className="mt-2 inline-block rounded-lg border border-slate-200 bg-white p-2">
              <img
                src={headerImageUrl}
                alt="header preview"
                className="max-h-28 max-w-[240px] object-contain rounded"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TestSendButton({ template, headerImageUrl }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!template) return toast.error('Pick a template first');
    if (!phone.trim()) return toast.error('Enter a phone number');
    setBusy(true);
    try {
      await api.post('/marketing/test-message', {
        template_name: template,
        phone: phone.trim(),
        header_image_url: headerImageUrl || undefined,
      });
      toast.success(`Test sent to ${phone}`);
      setOpen(false);
    } catch (err) {
      toast.error(err?.detail || 'Test send failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 px-3 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg flex items-center gap-1.5 transition-colors"
      >
        <Beaker size={14} /> Send test to one number
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Send a test</h3>
                <p className="text-xs text-slate-500 mt-0.5">Verify the template renders before broadcasting.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <input
              type="tel"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98xxx xxxxx"
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="h-9 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button onClick={send} disabled={busy}
                className="h-9 px-4 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-60">
                {busy ? <RefreshCcw size={12} className="animate-spin" /> : <Send size={12} />}
                Send test
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ConfirmModal({ open, onClose, onConfirm, title, summary, busy }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            <div className="text-xs text-slate-600 mt-2 leading-relaxed">{summary}</div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            className="h-9 px-4 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-60">
            {busy ? <RefreshCcw size={12} className="animate-spin" /> : <Send size={12} />}
            Yes, broadcast
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ result }) {
  if (!result) return null;
  return (
    <div className="mt-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
      <div className="flex items-center gap-2 text-emerald-800 text-sm font-semibold">
        <CheckCircle2 size={16} /> Dispatch results
      </div>
      <ul className="text-xs text-emerald-900 mt-2 space-y-1">
        {result.total_attempted != null && <li>Total targets: <strong>{result.total_attempted}</strong></li>}
        {result.total_pasted != null && <li>Pasted: <strong>{result.total_pasted}</strong></li>}
        {result.valid_count != null && <li>Valid: <strong>{result.valid_count}</strong></li>}
        {result.invalid_count != null && <li>Invalid: <strong>{result.invalid_count}</strong></li>}
        {result.duplicate_count != null && <li>Duplicates: <strong>{result.duplicate_count}</strong></li>}
        <li>Sent: <strong>{result.sent_count}</strong></li>
        {result.skipped != null && <li>Skipped: <strong>{result.skipped}</strong></li>}
        <li>Failed: <strong>{result.errors?.length || 0}</strong></li>
      </ul>
      {result.errors?.length > 0 && (
        <details className="mt-2">
          <summary className="text-[11px] font-semibold text-rose-700 cursor-pointer">View errors</summary>
          <div className="mt-2 p-2 bg-white text-rose-700 rounded border border-rose-200 max-h-32 overflow-y-auto text-[11px] font-mono">
            {result.errors.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        </details>
      )}
    </div>
  );
}

// ---------- Tab 1: To Clinics ---------------------------------------------

function ClinicsTab() {
  const templates = useWhatsappTemplates();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    channel: 'whatsapp',
    target_criteria: 'all',
    subject: '',
    template_name: '',
    message_body: '',
    header_image_url: '',
  });
  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!form.template_name && templates[0]?.name) change('template_name', templates[0].name);
  }, [templates]); // eslint-disable-line react-hooks/exhaustive-deps

  const validate = () => {
    if (form.channel === 'email' && !form.message_body) return 'Email body is required';
    if (form.channel === 'whatsapp' && !form.template_name) return 'Pick a WhatsApp template';
    return null;
  };

  const send = async () => {
    const err = validate();
    if (err) return toast.error(err);
    setConfirm(true);
  };

  const dispatch = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post('/marketing/bulk-message', form);
      setResult(res);
      toast.success(`Sent to ${res.sent_count} clinic(s)`);
      setConfirm(false);
    } catch (err) {
      toast.error('Failed to dispatch');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Channel</label>
            <div className="flex gap-2">
              {[
                { v: 'whatsapp', icon: MessageSquare, label: 'WhatsApp', tone: 'green' },
                { v: 'email', icon: Mail, label: 'Email', tone: 'blue' },
              ].map(({ v, icon: Icon, label, tone }) => (
                <label key={v} className={`flex-1 flex items-center justify-center gap-2 p-2.5 border rounded-xl cursor-pointer transition-all ${
                  form.channel === v
                    ? `bg-${tone}-50 border-${tone}-200 text-${tone}-700`
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}>
                  <input type="radio" checked={form.channel === v} onChange={() => change('channel', v)} className="hidden" />
                  <Icon size={16} /> <span className="text-sm font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Target</label>
            <select value={form.target_criteria} onChange={(e) => change('target_criteria', e.target.value)}
              className="w-full h-[44px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400">
              <option value="all">All clinics</option>
              <option value="active">Active subscription</option>
              <option value="trial">Free / trial</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {form.channel === 'whatsapp' ? (
          <TemplatePicker
            templates={templates}
            value={form.template_name}
            onChange={(v) => change('template_name', v)}
            headerImageUrl={form.header_image_url}
            onHeaderImageChange={(v) => change('header_image_url', v)}
          />
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Email subject</label>
              <input type="text" value={form.subject} onChange={(e) => change('subject', e.target.value)}
                placeholder="Important update from MolarPlus"
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Email body</label>
              <textarea rows={5} value={form.message_body} onChange={(e) => change('message_body', e.target.value)}
                placeholder="Type your message…"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          {form.channel === 'whatsapp' ? (
            <TestSendButton template={form.template_name} headerImageUrl={form.header_image_url} />
          ) : <span />}
          <button onClick={send}
            className="h-10 px-5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
            <Send size={14} /> Broadcast
          </button>
        </div>

        <ResultCard result={result} />
      </div>

      <ConfirmModal
        open={confirm}
        busy={busy}
        title={`Broadcast to ${form.target_criteria === 'all' ? 'all clinics' : form.target_criteria}?`}
        summary={
          <>
            Channel: <strong>{form.channel}</strong>
            {form.channel === 'whatsapp' && <>, template: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{form.template_name}</code></>}
            . This action can't be undone.
          </>
        }
        onConfirm={dispatch}
        onClose={() => setConfirm(false)}
      />
    </Card>
  );
}

// ---------- Tab 2: To Leads -----------------------------------------------

function LeadsTab() {
  const templates = useWhatsappTemplates();
  const [opts, setOpts] = useState({ stages: [], sources: [], by_stage: {}, by_source: {}, total_leads: 0 });
  const [stages, setStages] = useState([]);
  const [sources, setSources] = useState([]);
  const [template, setTemplate] = useState('');
  const [headerImage, setHeaderImage] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get('/marketing/leads/options').then(setOpts).catch(console.error);
  }, []);
  useEffect(() => {
    if (!template && templates[0]?.name) setTemplate(templates[0].name);
  }, [templates]); // eslint-disable-line

  // Re-preview as filters change
  useEffect(() => {
    let alive = true;
    api.post('/marketing/leads/preview', { stages, sources })
      .then((r) => { if (alive) setPreview(r); })
      .catch(console.error);
    return () => { alive = false; };
  }, [stages.join(','), sources.join(',')]); // eslint-disable-line

  const toggle = (list, setter, item) =>
    setter(list.includes(item) ? list.filter((s) => s !== item) : [...list, item]);

  const broadcast = async () => {
    if (!template) return toast.error('Pick a template');
    setConfirm(true);
  };
  const dispatch = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post('/marketing/bulk-message-leads', {
        template_name: template,
        stages: stages.length ? stages : null,
        sources: sources.length ? sources : null,
        header_image_url: headerImage || undefined,
      });
      setResult(res);
      toast.success(`Sent to ${res.sent_count} lead(s)`);
      setConfirm(false);
    } catch (err) {
      toast.error('Failed to dispatch');
    } finally {
      setBusy(false);
    }
  };

  const Pill = ({ label, count, active, onClick }) => (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
        active
          ? 'bg-brand-600 text-white border-brand-600'
          : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
      }`}>
      {label}{count != null ? ` · ${count}` : ''}
    </button>
  );

  return (
    <Card>
      <div className="space-y-5">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Filter by stage <span className="text-slate-400 font-normal normal-case">(none = all)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {opts.stages.map((s) => (
              <Pill key={s} label={s.replace(/_/g, ' ')} count={opts.by_stage[s]}
                active={stages.includes(s)} onClick={() => toggle(stages, setStages, s)} />
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Filter by source <span className="text-slate-400 font-normal normal-case">(none = all)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {opts.sources.map((s) => (
              <Pill key={s} label={s} count={opts.by_source[s]}
                active={sources.includes(s)} onClick={() => toggle(sources, setSources, s)} />
            ))}
          </div>
        </div>

        <TemplatePicker templates={templates} value={template} onChange={setTemplate}
          headerImageUrl={headerImage} onHeaderImageChange={setHeaderImage} />

        {preview && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="font-semibold text-slate-700 mb-1">
              {preview.valid_count} unique recipient(s) ready
              {preview.invalid_count > 0 && (
                <span className="ml-2 text-rose-600 font-normal">
                  · {preview.invalid_count} invalid phone(s) skipped
                </span>
              )}
              {preview.duplicate_count > 0 && (
                <span className="ml-2 text-amber-600 font-normal">
                  · {preview.duplicate_count} duplicate(s) skipped
                </span>
              )}
            </div>
            {preview.preview?.length > 0 && (
              <div className="text-slate-500 space-y-0.5">
                {preview.preview.map((p, i) => (
                  <div key={i}>{p.name} <span className="text-slate-400">— {p.phone} <em>· {p.stage}</em></span></div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <TestSendButton template={template} headerImageUrl={headerImage} />
          <button onClick={broadcast}
            disabled={!preview?.valid_count}
            className="h-10 px-5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
            <Send size={14} /> Broadcast to {preview?.valid_count || 0} lead(s)
          </button>
        </div>

        <ResultCard result={result} />
      </div>

      <ConfirmModal
        open={confirm}
        busy={busy}
        title={`Send to ${preview?.valid_count || 0} lead(s)?`}
        summary={<>Template: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{template}</code>. This action can't be undone.</>}
        onConfirm={dispatch}
        onClose={() => setConfirm(false)}
      />
    </Card>
  );
}

// ---------- Tab 3: Bulk Phone ---------------------------------------------

function NumbersTab() {
  const templates = useWhatsappTemplates();
  const [raw, setRaw] = useState('');
  const [template, setTemplate] = useState('');
  const [headerImage, setHeaderImage] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!template && templates[0]?.name) setTemplate(templates[0].name);
  }, [templates]); // eslint-disable-line

  // Debounced live preview
  useEffect(() => {
    if (!raw.trim()) { setPreview(null); return; }
    const t = setTimeout(() => {
      api.post('/marketing/bulk-message-numbers/preview', { raw })
        .then(setPreview)
        .catch(console.error);
    }, 300);
    return () => clearTimeout(t);
  }, [raw]);

  const broadcast = () => {
    if (!template) return toast.error('Pick a template');
    if (!preview?.valid_count) return toast.error('No valid numbers');
    setConfirm(true);
  };
  const dispatch = async () => {
    setBusy(true);
    setResult(null);
    try {
      const numbers = raw.split(/[\s,;]+/).filter(Boolean);
      const res = await api.post('/marketing/bulk-message-numbers', {
        template_name: template,
        numbers,
        header_image_url: headerImage || undefined,
      });
      setResult(res);
      toast.success(`Sent to ${res.sent_count} number(s)`);
      setConfirm(false);
    } catch (err) {
      toast.error('Failed to dispatch');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="space-y-5">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Phone numbers
          </label>
          <textarea
            rows={6}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"Paste numbers — one per line, comma- or space-separated.\n\n9876543210, +91 98765 43211\n919876543212\n0098765 43213"}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400"
          />
          {preview && (
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">Pasted: <strong>{preview.total_pasted}</strong></span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Valid: <strong>{preview.valid_count}</strong></span>
              {preview.invalid_count > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Invalid: <strong>{preview.invalid_count}</strong></span>
              )}
              {preview.duplicate_count > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Duplicates: <strong>{preview.duplicate_count}</strong></span>
              )}
            </div>
          )}
          {preview?.preview_invalid?.length > 0 && (
            <details className="mt-1.5 text-[11px]">
              <summary className="text-rose-600 cursor-pointer font-medium">Show invalid numbers</summary>
              <div className="mt-1 p-2 bg-rose-50 border border-rose-200 rounded font-mono text-rose-700">
                {preview.preview_invalid.join(', ')}
                {preview.invalid_count > preview.preview_invalid.length && ' …'}
              </div>
            </details>
          )}
        </div>

        <TemplatePicker templates={templates} value={template} onChange={setTemplate}
          headerImageUrl={headerImage} onHeaderImageChange={setHeaderImage} />

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <TestSendButton template={template} headerImageUrl={headerImage} />
          <button onClick={broadcast} disabled={!preview?.valid_count}
            className="h-10 px-5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
            <Send size={14} /> Broadcast to {preview?.valid_count || 0} number(s)
          </button>
        </div>

        <ResultCard result={result} />
      </div>

      <ConfirmModal
        open={confirm}
        busy={busy}
        title={`Send to ${preview?.valid_count || 0} number(s)?`}
        summary={<>Template: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{template}</code>. Invalid + duplicate numbers in your paste are skipped automatically.</>}
        onConfirm={dispatch}
        onClose={() => setConfirm(false)}
      />
    </Card>
  );
}

// ---------- Tab 4: History ------------------------------------------------

const KIND_ICON = { clinics: Building2, leads: Sprout, numbers: Phone, test: Beaker };
const KIND_TONE = { clinics: 'brand', leads: 'emerald', numbers: 'sky', test: 'slate' };

function HistoryTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/marketing/campaigns')
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (loading) return <Card><Spinner /></Card>;
  if (!rows.length) {
    return (
      <Card>
        <div className="py-12 text-center">
          <History size={24} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">No campaigns sent yet.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding={false}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700">Recent campaigns</h3>
        <button onClick={load} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
          <RefreshCcw size={12} /> Refresh
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((r) => {
          const Icon = KIND_ICON[r.target_kind] || Send;
          const tone = KIND_TONE[r.target_kind] || 'slate';
          const successRate = r.total_recipients > 0 ? Math.round((r.sent_count / r.total_recipients) * 100) : 0;
          return (
            <div key={r.id}>
              <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                className="w-full px-4 py-3 hover:bg-slate-50/60 transition-colors flex items-center gap-3 text-left">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${tone}-50 text-${tone}-600 flex-shrink-0`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">
                    {r.template_name || r.subject || '(no template)'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {r.target_kind} · {r.channel} · {fmt.date(r.created_at)}
                    {r.sent_by && ` · by ${r.sent_by}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-700">
                    {r.sent_count} / {r.total_recipients}
                  </div>
                  <div className={`text-[11px] ${successRate >= 90 ? 'text-emerald-600' : successRate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {successRate}% success
                  </div>
                </div>
              </button>
              {expanded === r.id && (
                <div className="px-4 pb-3 text-xs text-slate-600 space-y-1">
                  <div>Failed: {r.failed_count} · Skipped: {r.skipped_count}</div>
                  {r.target_filter && (
                    <div className="font-mono text-[11px] text-slate-500">
                      Filter: {JSON.stringify(r.target_filter)}
                    </div>
                  )}
                  {r.errors_summary?.length > 0 && (
                    <div className="mt-1 p-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-700 font-mono max-h-32 overflow-y-auto">
                      {r.errors_summary.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- Page shell ----------------------------------------------------

export default function MarketingCampaigns() {
  const [tab, setTab] = useState(() =>
    new URLSearchParams(window.location.search).get('tab') || 'clinics'
  );

  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url);
  }, [tab]);

  return (
    <div className="p-6 space-y-5 max-w-[900px]">
      <PageHeader
        title="Campaigns & Bulk Messages"
        subtitle="Send WhatsApp templates and email broadcasts to clinics, leads, or any list of phone numbers."
      />

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'clinics' && <ClinicsTab />}
      {tab === 'leads' && <LeadsTab />}
      {tab === 'numbers' && <NumbersTab />}
      {tab === 'history' && <HistoryTab />}
    </div>
  );
}
