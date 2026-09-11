import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, FileText, Stethoscope, ClipboardCheck, X, Eye,
  ChevronDown, ChevronUp, Loader2, Check, LayoutTemplate, ExternalLink, Printer,
  AlertTriangle,
} from 'lucide-react';
import { notify } from '../../utils/notify';
import { api } from '../../utils/api';
import { printLetterheadRuler } from '../../utils/letterheadRuler';

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
  logo: true, doctor_name: true, patient_contact: true,
  patient_age_gender: true, amount_in_words: true, computer_generated_note: true,
  clinic_name: true, doctor_qualifications: true,
};

// Printing onto the clinic's own headed paper. Off unless they say otherwise —
// a clinic that has never opened this screen must keep the document it has.
const LETTERHEAD_OFF = {
  enabled: false, top_mm: 45, bottom_mm: 20, left_mm: 15, right_mm: 15,
};

// A4, and the ceiling on a single edge. The limit that matters is the pair —
// top plus bottom, left plus right, have to leave a strip worth printing on —
// and the server enforces that where both halves are known. This is only here
// so a slipped keypress cannot put 4500 in the box.
// A4 at the CSS reference resolution of 96dpi: 210mm and 297mm exactly. The
// preview iframe is laid out at this size so millimetres inside it are real,
// then scaled down to whatever room the pane has.
const A4_PX_W = Math.round((210 / 25.4) * 96);
const A4_PX_H = Math.round((297 / 25.4) * 96);

const MAX_OFFSET_MM = 250;
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MIN_CONTENT_MM = 25;

// The four edges, in the order somebody reads them off a sheet of paper.
const EDGES = [
  { key: 'top_mm', label: 'Top' },
  { key: 'bottom_mm', label: 'Bottom' },
  { key: 'left_mm', label: 'Left' },
  { key: 'right_mm', label: 'Right' },
];

const DEFAULT_CONFIGS = {
  invoice:      { template_id: 'classic', logo_url: '', primary_color: '#FF9800', footer_text: '', show: { ...ALL_SHOWN }, letterhead: { ...LETTERHEAD_OFF } },
  prescription: { template_id: 'classic', logo_url: '', primary_color: '#2a276e', footer_text: '', show: { ...ALL_SHOWN }, letterhead: { ...LETTERHEAD_OFF } },
  consent:      { template_id: 'classic', logo_url: '', primary_color: '#2a276e', footer_text: '', show: { ...ALL_SHOWN }, letterhead: { ...LETTERHEAD_OFF } },
};

// Which switches make sense on which document. Tax and discount are invoice
// concepts — a prescription has no total to discount and no tax to declare.
const FIELD_ROWS = [
  { key: 'clinic_name',    label: 'Clinic name',        hint: 'The name at the top of the document' },
  { key: 'tagline',        label: 'Tagline',            hint: 'The line under your clinic name', settingsLink: true },
  { key: 'address',        label: 'Address',            hint: 'Clinic street address' },
  { key: 'contact',        label: 'Phone & email',      hint: 'Contact details in the letterhead' },
  { key: 'license_number', label: 'Licence number',     hint: 'Your registration number', settingsLink: true },
  { key: 'tax_number',     label: 'GST / Tax number',   hint: 'Only meaningful on a tax document', only: ['invoice'] },
  { key: 'signature',      label: 'Signature block',    hint: 'The authorised-signatory line', signatureLink: true },
  { key: 'footer',         label: 'Footer text',        hint: 'The disclaimer set below' },
  { key: 'discount',       label: 'Discount on invoice', hint: 'Hidden discounts are netted into the subtotal', only: ['invoice'] },
  { key: 'logo',           label: 'Logo',               hint: 'Your clinic logo at the top' },
  { key: 'doctor_name',    label: "Doctor's name",      hint: 'The treating doctor on this document' },
  { key: 'doctor_qualifications', label: 'Doctor\'s qualifications', hint: 'The letters under the name, e.g. BDS, MDS', profileLink: true },
  { key: 'patient_contact', label: 'Patient phone & address', hint: 'Useful on a bill, less so on a handout' },
  { key: 'patient_age_gender', label: 'Patient age & sex', hint: 'The age / sex line under the name' },
  { key: 'amount_in_words', label: 'Amount in words',   hint: '"Rupees four thousand only"', only: ['invoice'] },
  { key: 'computer_generated_note', label: 'Computer-generated note', hint: 'The "does not require a signature" line', only: ['invoice'] },
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
  // A failed refresh used to leave the last good document on screen with only a
  // console warning. That reads as "the toggle did nothing" — the pane is the
  // only feedback this screen has, so a stale render is worse than an error.
  const [previewError, setPreviewError] = useState('');
  // How far the A4 page has to shrink to fit the pane. Measured rather than
  // assumed: the pane is fluid, and a fixed guess would either clip the page or
  // leave a gap beside it.
  const previewBoxRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);
  useEffect(() => {
    const box = previewBoxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const w = box.clientWidth;
      if (w > 0) setPreviewScale(w / A4_PX_W);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [previewHtml]);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [variants, setVariants] = useState({ invoice: [], prescription: [], consent: [] });
  const [taxLabel, setTaxLabel] = useState('GST No.'); // clinic's country-specific tax label
  const [clinic, setClinic] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zoomVariant, setZoomVariant] = useState(null); // variant being viewed full-size

  // Escape closes whichever of the two is on top, the way every other modal in
  // the app behaves. The full-size view sits above the gallery, so it goes
  // first rather than both closing at once and losing the user's place.
  useEffect(() => {
    if (!pickerOpen && !zoomVariant) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (zoomVariant) setZoomVariant(null);
      else setPickerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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
            letterhead: { ...LETTERHEAD_OFF, ...(c.config_json?.letterhead || {}) },
          };
        }
      });
      setConfigs(next);
    } catch (e) {
      console.error('[TemplatesEditor] load error', e);
      notify.problem('Could not load template settings');
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
  //
  // `show` and `letterhead` are objects rebuilt on every render, so depending on
  // them by reference would refetch the preview on every keystroke. Their
  // serialised form is the real dependency — and reading it back inside the
  // effect, rather than closing over the objects, is what lets the exhaustive
  // deps rule verify this instead of being told to ignore it.
  const showKey = JSON.stringify(cfg.show ?? {});
  const letterheadKey = JSON.stringify(cfg.letterhead ?? {});
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
          config_json: { show: JSON.parse(showKey), letterhead: JSON.parse(letterheadKey) },
        });
        if (!cancelled && data?.html) {
          setPreviewHtml(data.html);
          setPreviewError('');
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[TemplatesEditor] preview failed', err?.message);
          setPreviewError(err?.message || 'Could not refresh the preview.');
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [activeTab, cfg.template_id, cfg.primary_color, cfg.footer_text, cfg.logo_url,
      showKey, letterheadKey, loading]);

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
        config_json:   { show: cfg.show, letterhead: cfg.letterhead },
      });
      // The old code also PATCHed /clinics/me here to mirror the GST number.
      // That route doesn't exist — it 405'd into a swallowed catch, so the GST
      // field never actually saved. GST is edited in Clinic Details; this
      // screen only decides whether it prints.
      setLastSavedAt(new Date());
      notify.done(`${TABS.find(t => t.id === activeTab).label} template saved`);
    } catch (err) {
      console.error('[TemplatesEditor] save error', err);
      notify.problem(err, 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
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
            className="flex items-center gap-2 px-4 py-2 bg-[#29828a] hover:bg-[#236d75] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm shrink-0 whitespace-nowrap"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? 'Saving…' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Body — side by side once there is room, stacked before that */}
      <div className="flex flex-col xl:flex-row flex-1 overflow-y-auto xl:overflow-hidden">
        {/* ── Left: form panel ───────────────────────────────────────────── */}
        <aside className="w-full xl:w-[380px] bg-white border-b xl:border-b-0 xl:border-r border-gray-200 flex flex-col shrink-0 xl:h-full xl:overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-1 shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 px-2 py-3.5 text-sm transition-colors ${
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
          <div className="flex-1 xl:overflow-y-auto">
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
                          {f.profileLink && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); navigate('/doctor-profile'); }}
                              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#29828a] hover:underline"
                            >
                              Set them on your profile <ExternalLink size={10} />
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

                {/* Pre-printed letterhead.
                    Plenty of clinics already own headed paper and want our
                    documents printed onto it. Their stationery is not just a
                    band across the top: the sheet that prompted this has a
                    services list down the left margin and a vitals box down the
                    right, so all four edges are measured independently. */}
                <Section title="Pre-printed letterhead" defaultOpen={false}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!cfg.letterhead?.enabled}
                      onChange={() => updateField('letterhead', {
                        ...cfg.letterhead, enabled: !cfg.letterhead?.enabled,
                      })}
                      className="mt-0.5 w-4 h-4 accent-[#29828a]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-800">
                        I print on my own letterhead
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        Your clinic name, logo, address and footer come off the document,
                        because the paper already carries them.
                      </span>
                    </span>
                  </label>

                  {cfg.letterhead?.enabled && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <FieldLabel>Blank space to leave, in millimetres</FieldLabel>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                          {EDGES.map(({ key, label }) => (
                            <div key={key}>
                              <label className="block text-[11px] text-gray-500 mb-1">{label}</label>
                              <input
                                type="number" min={0} max={MAX_OFFSET_MM}
                                value={cfg.letterhead?.[key] ?? 0}
                                onChange={(e) => updateField('letterhead', {
                                  ...cfg.letterhead,
                                  [key]: Math.max(0, Math.min(MAX_OFFSET_MM, Number(e.target.value) || 0)),
                                })}
                                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-md text-sm focus:border-[#29828a] focus:ring-1 focus:ring-[#29828a] outline-none"
                              />
                            </div>
                          ))}
                        </div>
                        {/* Said here rather than discovered on paper. The server
                            scales an impossible pair back in proportion, so the
                            document still prints — but a clinic should be told
                            the numbers it typed are not the ones being used. */}
                        {(() => {
                          const lh = cfg.letterhead || {};
                          const h = (lh.top_mm || 0) + (lh.bottom_mm || 0);
                          const w = (lh.left_mm || 0) + (lh.right_mm || 0);
                          const tall = h > PAGE_H_MM - MIN_CONTENT_MM;
                          const wide = w > PAGE_W_MM - MIN_CONTENT_MM;
                          if (!tall && !wide) {
                            return (
                              <p className="mt-1.5 text-[11px] text-gray-400">
                                Leaves {PAGE_W_MM - w} × {PAGE_H_MM - h}mm to print on.
                              </p>
                            );
                          }
                          return (
                            <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
                              {tall && wide ? 'Those offsets leave no room'
                                : tall ? 'Top and bottom leave no room'
                                  : 'Left and right leave no room'}
                              {' '}on an A4 sheet, so they will be scaled back to fit.
                            </p>
                          );
                        })()}
                      </div>

                      {/* Nobody can guess "45mm". Without this, setting it up is
                          trial and error at one sheet of headed paper per go. */}
                      <div className="rounded-lg border border-[#29828a]/20 bg-[#29828a]/5 p-3">
                        <p className="text-xs text-gray-700 leading-relaxed">
                          <strong>Not sure of the numbers?</strong> Print the test sheet on a
                          blank page, hold it against your letterhead, and read off how much
                          space each edge needs.
                        </p>
                        <button
                          type="button"
                          onClick={printLetterheadRuler}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#29828a] hover:bg-[#216b71] text-white text-xs font-semibold"
                        >
                          <Printer size={13} /> Print test sheet
                        </button>
                      </div>
                    </div>
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
        <main className="flex-1 bg-gray-100 xl:overflow-auto">
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Live Preview</span>
            {previewLoading && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 size={12} className="animate-spin" />
                <span>Refreshing…</span>
              </div>
            )}
            {!previewLoading && previewError && (
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                <AlertTriangle size={12} />
                <span>Preview is out of date. Reload the page and sign in again.</span>
              </div>
            )}
          </div>
          <div className="p-4 sm:p-6 flex justify-center">
            <div
              ref={previewBoxRef}
              className="w-full max-w-[820px] bg-white shadow-lg rounded-md overflow-hidden border border-gray-200"
              style={{ aspectRatio: '210 / 297' }}
            >
              {previewHtml ? (
                /* Rendered at a literal A4 in CSS pixels and then scaled to fit,
                   rather than stretched to whatever the pane happens to be.
                   The document is measured in millimetres — the letterhead band
                   most of all — and a millimetre only means a millimetre if the
                   page it sits on is A4-sized. Stretching instead of scaling is
                   how a 45mm offset came out looking like 38. */
                <iframe
                  title="Template preview"
                  srcDoc={previewHtml}
                  className={`border-0 ${previewError ? 'opacity-40' : ''}`}
                  style={{
                    width: `${A4_PX_W}px`,
                    height: `${A4_PX_H}px`,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                  }}
                  sandbox="allow-same-origin"
                />
              ) : previewError ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
                  <AlertTriangle size={20} className="text-amber-600" />
                  <span className="text-sm font-semibold text-gray-700">Could not build the preview</span>
                  <span className="text-xs text-gray-500">{previewError}</span>
                </div>
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

      {/* ── Template gallery ────────────────────────────────────────────────
          A centred modal, not a side drawer. Choosing a layout is comparing
          pictures, and a 448px drawer could show one column of stamp-sized
          thumbnails — so the choice was made from the description rather than
          from the page, which is the one thing a template picker exists to
          show. The grid gives every layout the same width and puts three of
          them side by side, which is how you actually tell them apart. */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPickerOpen(false)} />

          <div className="relative w-full max-w-5xl max-h-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-200 shrink-0">
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900">Choose a layout</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  For {TABS.find((t) => t.id === activeTab)?.label.toLowerCase()}. Shown in the app's
                  colours so you are comparing layouts, not palettes — your own accent is applied
                  the moment you pick one. Applies straight away; save to keep it.
                </p>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                aria-label="Close"
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-gray-50">
              {tabVariants.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-12">No layouts available.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tabVariants.map((v) => {
                    const isActive = cfg.template_id === v.id;
                    return (
                      <div
                        key={v.id}
                        className={`group rounded-xl border bg-white overflow-hidden transition-colors ${
                          isActive ? 'border-[#29828a]' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {/* The page itself, at a size you can read the shape of.
                            Clicking it picks the layout. */}
                        <button
                          type="button"
                          onClick={() => { updateField('template_id', v.id); setPickerOpen(false); }}
                          className="block w-full text-left cursor-pointer"
                          title={`Use the ${v.name} layout`}
                        >
                          <div className="relative aspect-[210/297] bg-white border-b border-gray-100 overflow-hidden">
                            <img
                              src={thumbUrl(v.thumbnail)}
                              alt={`${v.name} layout`}
                              loading="lazy"
                              className="w-full h-full object-cover object-top"
                              onError={(e) => { e.currentTarget.style.opacity = '0.15'; }}
                            />
                            {isActive && (
                              <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#29828a] text-white text-[10px] font-bold shadow-sm">
                                <Check size={11} /> In use
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-sm font-semibold text-gray-900">{v.name}</p>
                            <p className="text-xs text-gray-500 leading-snug mt-1">{v.description}</p>
                          </div>
                        </button>

                        <div className="px-3 pb-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setZoomVariant(v)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                          >
                            <Eye size={13} /> Full size
                          </button>
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => { updateField('template_id', v.id); setPickerOpen(false); }}
                              className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#29828a] hover:bg-[#216b71] transition-colors"
                            >
                              Use this
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
