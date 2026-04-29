import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, FileText, Stethoscope, ClipboardCheck, Upload, X,
  ChevronDown, ChevronUp, Loader2, Check,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { api, authenticatedFetch } from '../../utils/api';

const TABS = [
  { id: 'invoice',      label: 'Invoices',      icon: FileText },
  { id: 'prescription', label: 'Prescriptions', icon: Stethoscope },
  { id: 'consent',      label: 'Consent Forms', icon: ClipboardCheck },
];

const DEFAULT_CONFIGS = {
  invoice:      { template_id: 'classic', logo_url: '', primary_color: '#FF9800', footer_text: '', gst_number: '' },
  prescription: { template_id: 'classic', logo_url: '', primary_color: '#2a276e', footer_text: '', gst_number: '' },
  consent:      { template_id: 'classic', logo_url: '', primary_color: '#2a276e', footer_text: '', gst_number: '' },
};

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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [variants, setVariants] = useState({ invoice: [], prescription: [], consent: [] });

  const fileInputRef = useRef(null);

  // Resolve a backend-relative thumbnail path to a fully-qualified URL.
  // The backend mounts /static — frontend may be on a different origin in dev,
  // so we use the same origin as the rest of the API.
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api\/v1\/?$/, '');
  const thumbUrl = (path) => path?.startsWith('http') ? path : `${apiBase}${path}`;

  const cfg = configs[activeTab];

  // ── Load existing config + clinic info ─────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [configList, me] = await Promise.all([
        api.get('/template-configs').catch(() => []),
        api.get('/clinics/me').catch(() => null),
      ]);
      const next = JSON.parse(JSON.stringify(DEFAULT_CONFIGS));
      if (me) {
        next.invoice.gst_number  = me.gst_number  || '';
        next.invoice.logo_url    = me.logo_url    || '';
        next.invoice.template_id = me.invoice_template || 'classic';
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
        });
        if (!cancelled && data?.html) setPreviewHtml(data.html);
      } catch (err) {
        if (!cancelled) console.warn('[TemplatesEditor] preview failed', err?.message);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [activeTab, cfg.template_id, cfg.primary_color, cfg.footer_text, cfg.logo_url, loading]);

  // ── Mutators ────────────────────────────────────────────────────────────────
  const updateField = (field, value) => {
    setConfigs((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], [field]: value } }));
  };

  const handlePickLogo = () => fileInputRef.current?.click();

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Logo must be PNG or JPEG');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be under 5 MB');
      e.target.value = '';
      return;
    }
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('category', activeTab);
      formData.append('file', file);
      const data = await api.post('/template-configs/logo', formData);
      if (data?.logo_url) {
        updateField('logo_url', data.logo_url);
        toast.success('Logo uploaded — remember to save changes');
      } else {
        toast.error('Upload failed. Try a different image.');
      }
    } catch (err) {
      console.error('[TemplatesEditor] logo upload error', err);
      toast.error(err?.detail || 'Could not upload logo');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleRemoveLogo = () => updateField('logo_url', '');

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/template-configs', {
        category:      activeTab,
        template_id:   cfg.template_id,
        logo_url:      cfg.logo_url || null,
        primary_color: cfg.primary_color,
        footer_text:   cfg.footer_text,
      });
      // Mirror invoice GST + logo onto the clinic record so legacy code paths
      // that read clinic.gst_number / clinic.logo_url see the same source of truth.
      if (activeTab === 'invoice') {
        await authenticatedFetch('/clinics/me', {
          method: 'PATCH',
          body: JSON.stringify({
            gst_number: cfg.gst_number,
            logo_url: cfg.logo_url || null,
            invoice_template: cfg.template_id,
          }),
        }).catch(() => { /* best-effort sync, don't fail the save */ });
      }
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
                  <div className="grid grid-cols-2 gap-3">
                    {(variants[activeTab] || []).map((v) => {
                      const isActive = cfg.template_id === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => updateField('template_id', v.id)}
                          className={`relative p-2 rounded-lg border-2 transition-all text-left ${
                            isActive
                              ? 'border-[#29828a] bg-[#29828a]/5 shadow-sm'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          {isActive && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#29828a] flex items-center justify-center shadow">
                              <Check size={12} className="text-white" />
                            </div>
                          )}
                          <div className="aspect-[210/297] bg-white border border-gray-100 rounded overflow-hidden mb-2">
                            <img
                              src={thumbUrl(v.thumbnail)}
                              alt={v.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.opacity = '0.2'; }}
                            />
                          </div>
                          <div className="text-xs font-semibold text-gray-900">{v.name}</div>
                          <div className="text-[10px] text-gray-500 leading-tight mt-0.5 line-clamp-2">{v.description}</div>
                        </button>
                      );
                    })}
                    {(variants[activeTab] || []).length === 0 && (
                      <div className="col-span-2 text-xs text-gray-400 italic py-4 text-center">
                        No layout variants available.
                      </div>
                    )}
                  </div>
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

                  <div>
                    <FieldLabel>Clinic Logo</FieldLabel>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                    {cfg.logo_url ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={cfg.logo_url}
                          alt="Logo"
                          className="w-16 h-16 rounded-md border border-gray-200 object-contain bg-white"
                        />
                        <div className="flex-1 flex flex-col gap-2">
                          <button
                            onClick={handlePickLogo}
                            disabled={uploadingLogo}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md text-xs font-semibold text-[#29828a] hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            {uploadingLogo ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                            Replace
                          </button>
                          <button
                            onClick={handleRemoveLogo}
                            disabled={uploadingLogo}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-md text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            <X size={12} />
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handlePickLogo}
                        disabled={uploadingLogo}
                        className="w-full flex flex-col items-center justify-center gap-1 py-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                      >
                        {uploadingLogo
                          ? <Loader2 size={20} className="animate-spin text-[#29828a]" />
                          : <Upload size={20} className="text-[#29828a]" />}
                        <span className="text-sm font-semibold text-gray-900 mt-1">
                          {uploadingLogo ? 'Uploading…' : 'Click to upload logo'}
                        </span>
                        <span className="text-[11px] text-gray-500">PNG or JPEG, up to 5 MB</span>
                      </button>
                    )}
                    <p className="text-[11px] text-gray-400 italic mt-2">
                      Used in the {activeTab} PDF header. Empty = use the clinic-wide logo.
                    </p>
                  </div>
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

                {activeTab === 'invoice' && (
                  <Section title="Tax & Identity">
                    <div>
                      <FieldLabel>Clinic GST Number</FieldLabel>
                      <input
                        type="text"
                        value={cfg.gst_number}
                        onChange={(e) => updateField('gst_number', e.target.value.toUpperCase())}
                        placeholder="29GGGGG1314R9Z6"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-mono uppercase focus:border-[#29828a] focus:ring-1 focus:ring-[#29828a] outline-none"
                      />
                    </div>
                  </Section>
                )}
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
    </div>
  );
};

export default TemplatesEditor;
