import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, FileText, Stethoscope, ClipboardCheck, X, Eye,
  ChevronDown, ChevronUp, Loader2, Check, LayoutTemplate, ExternalLink,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../utils/api';

const TABS = [
  { id: 'invoice',      label: 'Invoices',      icon: FileText },
  { id: 'prescription', label: 'Prescriptions', icon: Stethoscope },
  { id: 'consent',      label: 'Consent Forms', icon: ClipboardCheck },
];

// Everything is shown until the clinic says otherwise, matching the backend
// resolver — see backend/domains/infrastructure/services/pdf_fields.py.
const ALL_SHOWN = {
  tax_number: true, contact: true, license_number: true, address: true,
  tagline: true, footer: true, signature: true, discount: true,
};

const DEFAULT_CONFIGS = {
  invoice:      { template_id: 'classic', logo_url: '', primary_color: '#FF9800', footer_text: '', show: { ...ALL_SHOWN } },
  prescription: { template_id: 'classic', logo_url: '', primary_color: '#2a276e', footer_text: '', show: { ...ALL_SHOWN } },
  consent:      { template_id: 'classic', logo_url: '', primary_color: '#2a276e', footer_text: '', show: { ...ALL_SHOWN } },
};

// Which switches make sense on which document. Tax and discount are invoice
// concepts — a prescription has no total to discount and no tax to declare.
const FIELD_ROWS = [
  { key: 'tagline',        label: 'Tagline',            hint: 'The line under your clinic name', settingsLink: true },
  { key: 'address',        label: 'Address',            hint: 'Clinic street address' },
  { key: 'contact',        label: 'Phone & email',      hint: 'Contact details in the letterhead' },
  { key: 'license_number', label: 'Licence number',     hint: 'Your registration number', settingsLink: true },
  { key: 'tax_number',     label: 'GST / Tax number',   hint: 'Only meaningful on a tax document', only: ['invoice'] },
  { key: 'signature',      label: 'Signature block',    hint: 'The authorised-signatory line', signatureLink: true },
  { key: 'footer',         label: 'Footer text',        hint: 'The disclaimer set below' },
  { key: 'discount',       label: 'Discount on invoice', hint: 'Hidden discounts are netted into the subtotal', only: ['invoice'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Small UI primitives
// ─────────────────────────────────────────────────────────────────────────────

const Section = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
};

const FieldLabel = ({ children }) => (
  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{children}</label>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main editor
// ─────────────────────────────────────────────────────────────────────────────

const TemplatesEditor = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('invoice');
  const [configs, setConfigs] = useState(DEFAULT_CONFIGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [variants, setVariants] = useState({ invoice: [], prescription: [], consent: [] });
  const [taxLabel, setTaxLabel] = useState('GST No.'); // clinic's country-specific tax label
  const [clinic, setClinic] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zoomVariant, setZoomVariant] = useState(null); // variant being viewed full-size

  // Resolve a backend-relative thumbnail path to a fully-qualified URL.
  // The backend mounts /static — frontend is on a different origin
  // (app.molarplus.com), so prefix with the backend host. VITE_BACKEND_URL is
  // the project's standard env var (see utils/api.js); falls back to localhost
  // for dev so this still works on `vite dev` without an .env file.
  const apiBase = import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:8000`;
  const thumbUrl = (path) => path?.startsWith('http') ? path : `${apiBase}${path}`;

  const cfg = configs[activeTab];
  const tabVariants = variants[activeTab] || [];
  const activeVariant = tabVariants.find((v) => v.id === cfg.template_id) || tabVariants[0];

  // ── Load existing config + clinic info ─────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [configList, me] = await Promise.all([
        api.get('/template-configs').catch(() => []),
        api.get('/clinics/me').catch(() => null),
      ]);
      const next = JSON.parse(JSON.stringify(DEFAULT_CONFIGS));
      if (me) {
        setClinic(me);
        if (me.tax_label) setTaxLabel(me.tax_label);
      }
      (configList || []).forEach((c) => {
        const k = c.category;
        if (next[k]) {
          next[k] = {
            ...next[k],
            template_id:   c.template_id   || next[k].template_id,
            logo_url:      c.logo_url      || next[k].logo_url || '',
            primary_color: c.primary_color || next[k].primary_color,
            footer_text:   c.footer_text   || '',
            // Absent keys stay shown, so a toggle added later doesn't
            // retroactively hide itself for clinics who saved before it existed.
            show: { ...ALL_SHOWN, ...(c.config_json?.show || {}) },
          };
        }
      });
      setConfigs(next);
    } catch (e) {
      console.error('[TemplatesEditor] load error', e);
      toast.error('Could not load template settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load variant catalogs once. Picker shows the strip above Branding so the
  // admin can switch layouts without leaving the page.
  useEffect(() => {
    Promise.all([
      api.get('/template-configs/variants/invoice').catch(() => ({ variants: [] })),
      api.get('/template-configs/variants/prescription').catch(() => ({ variants: [] })),
      api.get('/template-configs/variants/consent').catch(() => ({ variants: [] })),
    ]).then(([inv, rx, cons]) => {
      setVariants({
        invoice: inv?.variants || [],
        prescription: rx?.variants || [],
        consent: cons?.variants || [],
      });
    });
  }, []);

  // ── Debounced preview refresh (350 ms) ─────────────────────────────────────
  // Cancellable via the closure flag so a slow earlier request can't overwrite
  // a newer one (very common when the user drags the colour picker).
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const data = await api.post('/template-configs/preview', {
          category: activeTab,
          template_id: cfg.template_id,
          primary_color: cfg.primary_color,
          footer_text: cfg.footer_text,
          logo_url: cfg.logo_url || null,
          config_json: { show: cfg.show },
        });
        if (!cancelled && data?.html) setPreviewHtml(data.html);
      } catch (err) {
        if (!cancelled) console.warn('[TemplatesEditor] preview failed', err?.message);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
    // `show` is stringified into the dep list: it's a new object each render,
    // so comparing by reference would refetch the preview on every keystroke.
  }, [activeTab, cfg.template_id, cfg.primary_color, cfg.footer_text, cfg.logo_url,
      JSON.stringify(cfg.show), loading]);

  // ── Mutators ────────────────────────────────────────────────────────────────
  const updateField = (field, value) => {
    setConfigs((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], [field]: value } }));
  };

  const toggleField = (key) => {
    setConfigs((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], show: { ...prev[activeTab].show, [key]: !prev[activeTab].show[key] } },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/template-configs', {
        category:      activeTab,
        template_id:   cfg.template_id,
        // Deliberately null: the logo now lives on the clinic record only, so a
        // stale per-category override doesn't quietly outrank Clinic Details.
        logo_url:      null,
        primary_color: cfg.primary_color,
        footer_text:   cfg.footer_text,
        config_json:   { show: cfg.show },
      });
      // The old code also PATCHed /clinics/me here to mirror the GST number.
      // That route doesn't exist — it 405'd into a swallowed catch, so the GST
      // field never actually saved. GST is edited in Clinic Details; this
      // screen only decides whether it prints.
      setLastSavedAt(new Date());
      toast.success(`${TABS.find(t => t.id === activeTab).label} template saved`);
    } catch (err) {
      console.error('[TemplatesEditor] save error', err);
      toast.error(err?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Templates</h1>
            <p className="text-xs text-gray-500">PDF design for invoices and prescriptions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastSavedAt && !saving && (
            <span className="text-xs text-gray-500">
              Saved · {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#29828a] hover:bg-[#236d75] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? 'Saving…' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Body — side-by-side */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: form panel ───────────────────────────────────────────── */}
        <aside className="w-[380px] bg-white border-r border-gray-200 flex flex-col shrink-0">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 shrink-0">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm transition-colors ${
                    isActive
                      ? 'text-[#29828a] border-b-2 border-[#29828a] font-semibold'
                      : 'text-gray-500 border-b-2 border-transparent hover:text-gray-700'
                  }`}
                >
                  <Icon size={15} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Sections */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 size={20} className="animate-spin text-[#29828a]" />
                <span className="text-sm text-gray-500">Loading…</span>
              </div>
            ) : (
              <>
                <Section title="Layout">
                  {/* The chosen layout, stated plainly. Two page-shaped
                      thumbnails used to fill this 380px column to express a
                      choice between two things. */}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#29828a]/10 text-[#29828a] flex items-center justify-center shrink-0">
                      <LayoutTemplate size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{activeVariant?.name || 'Classic'}</p>
                      <p className="text-xs text-gray-500 leading-snug mt-0.5">
                        {activeVariant?.description || 'The default layout for this document.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    disabled={tabVariants.length === 0}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-xs font-semibold text-[#29828a] hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Change template
                    {tabVariants.length > 1 && ` (${tabVariants.length} available)`}
                  </button>
                </Section>

                <Section title="Branding">
                  <div>
                    <FieldLabel>Primary Accent Color</FieldLabel>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={cfg.primary_color}
                        onChange={(e) => updateField('primary_color', e.target.value.toUpperCase())}
                        className="w-12 h-10 rounded-md border border-gray-200 cursor-pointer bg-white"
                      />
                      <input
                        type="text"
                        value={cfg.primary_color}
                        onChange={(e) => updateField('primary_color', e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-mono focus:border-[#29828a] focus:ring-1 focus:ring-[#29828a] outline-none"
                        placeholder="#FF9800"
                      />
                    </div>
                  </div>

                  {/* One logo, one place to set it. This screen used to upload
                      its own per-document logo, which quietly outranked the one
                      in Clinic Details and left two answers to one question. */}
                  <div>
                    <FieldLabel>Clinic Logo</FieldLabel>
                    <div className="flex items-center gap-3">
                      {clinic?.logo_url ? (
                        <img
                          src={clinic.logo_url}
                          alt="Clinic logo"
                          className="w-14 h-14 rounded-md border border-gray-200 object-contain bg-white shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-md border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400 shrink-0">
                          None
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 leading-snug">
                          Your clinic logo appears on all three documents.
                        </p>
                        <button
                          type="button"
                          onClick={() => navigate('/admin/clinic')}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#29828a] hover:underline"
                        >
                          Manage in Clinic Details <ExternalLink size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </Section>

                <Section title="Visible Fields">
                  <p className="text-xs text-gray-500 -mt-1">
                    What prints on the {activeTab}. Unticking hides the field — it never
                    invents one, so anything you haven't filled in stays blank either way.
                  </p>

                  <div className="space-y-1">
                    {FIELD_ROWS.filter((f) => !f.only || f.only.includes(activeTab)).map((f) => (
                      <label
                        key={f.key}
                        className="flex items-start gap-2.5 py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={cfg.show?.[f.key] ?? true}
                          onChange={() => toggleField(f.key)}
                          className="mt-0.5 rounded border-gray-300 text-[#29828a] focus:ring-[#29828a]/30 cursor-pointer"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm text-gray-900">
                            {f.key === 'tax_number' ? `${taxLabel.replace(/ No\.$/, '')} number` : f.label}
                          </span>
                          <span className="block text-[11px] text-gray-400 leading-snug">{f.hint}</span>
                          {f.settingsLink && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); navigate('/admin/clinic'); }}
                              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#29828a] hover:underline"
                            >
                              Set in Clinic Details <ExternalLink size={10} />
                            </button>
                          )}
                          {f.signatureLink && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); navigate('/doctor-profile'); }}
                              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#29828a] hover:underline"
                            >
                              Upload your signature <ExternalLink size={10} />
                            </button>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>

                  {activeTab === 'invoice' && (
                    <p className="text-[11px] text-gray-400 italic border-t border-gray-100 pt-3">
                      Payment receipts follow these same settings, so a field hidden on the
                      bill stays hidden on the receipt for that payment.
                    </p>
                  )}
                </Section>

                <Section title="Footer / Disclaimer">
                  <div>
                    <FieldLabel>Footer Text</FieldLabel>
                    <textarea
                      value={cfg.footer_text}
                      onChange={(e) => updateField('footer_text', e.target.value)}
                      placeholder="e.g. This is a computer-generated document. No signature required."
                      rows={4}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:border-[#29828a] focus:ring-1 focus:ring-[#29828a] outline-none resize-none"
                    />
                    <p className="text-[11px] text-gray-400 italic mt-1">
                      Appears at the bottom of every {activeTab} PDF.
                    </p>
                  </div>
                </Section>

              </>
            )}
          </div>
        </aside>

        {/* ── Right: live preview ─────────────────────────────────────────── */}
        <main className="flex-1 bg-gray-100 overflow-auto">
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Live Preview</span>
            {previewLoading && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 size={12} className="animate-spin" />
                <span>Refreshing…</span>
              </div>
            )}
          </div>
          <div className="p-6 flex justify-center">
            <div className="w-full max-w-[820px] bg-white shadow-lg rounded-md overflow-hidden border border-gray-200" style={{ aspectRatio: '210 / 297' }}>
              {previewHtml ? (
                <iframe
                  title="Template preview"
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">Building preview…</span>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── Template picker ─────────────────────────────────────────────────
          A drawer rather than a strip in the sidebar: comparing layouts wants
          room, and the sidebar is where you tune the one you already chose. */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setPickerOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right">
            <div className="flex items-start justify-between p-5 border-b border-gray-200">
              <div>
                <h3 className="font-bold text-gray-900">Choose a layout</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  For {TABS.find((t) => t.id === activeTab)?.label.toLowerCase()}. Applies straight away; save to keep it.
                </p>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {tabVariants.map((v) => {
                const isActive = cfg.template_id === v.id;
                return (
                  <div
                    key={v.id}
                    className={`rounded-xl border-2 transition-all overflow-hidden ${
                      isActive ? 'border-[#29828a] bg-[#29828a]/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => { updateField('template_id', v.id); setPickerOpen(false); }}
                      className="w-full text-left p-3 flex gap-3"
                    >
                      <div className="w-20 shrink-0 aspect-[210/297] bg-white border border-gray-200 rounded overflow-hidden">
                        <img
                          src={thumbUrl(v.thumbnail)}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.opacity = '0.15'; }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-gray-900">{v.name}</span>
                          {isActive && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#29828a]">
                              <Check size={11} /> In use
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 leading-snug mt-1">{v.description}</p>
                      </div>
                    </button>
                    <div className="px-3 pb-3">
                      <button
                        type="button"
                        onClick={() => setZoomVariant(v)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <Eye size={13} /> View full size
                      </button>
                    </div>
                  </div>
                );
              })}

              {tabVariants.length === 1 && (
                <p className="text-xs text-gray-400 italic text-center pt-2">
                  This is the only layout available for this document so far.
                </p>
              )}
              {tabVariants.length === 0 && (
                <p className="text-sm text-gray-400 italic text-center py-8">No layouts available.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-size look at one layout, without committing to it. */}
      {zoomVariant && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-6"
          onClick={() => setZoomVariant(null)}
        >
          <div
            className="bg-white rounded-xl max-w-[720px] w-full max-h-full flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <div>
                <p className="text-sm font-bold text-gray-900">{zoomVariant.name}</p>
                <p className="text-xs text-gray-500">{zoomVariant.description}</p>
              </div>
              <button
                onClick={() => setZoomVariant(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100 p-5 flex justify-center">
              <img
                src={thumbUrl(zoomVariant.thumbnail)}
                alt={zoomVariant.name}
                className="max-w-full h-auto border border-gray-200 bg-white"
                onError={(e) => { e.currentTarget.style.opacity = '0.15'; }}
              />
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setZoomVariant(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  updateField('template_id', zoomVariant.id);
                  setZoomVariant(null);
                  setPickerOpen(false);
                }}
                className="px-4 py-2 bg-[#29828a] hover:bg-[#216b71] text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Use this layout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesEditor;
