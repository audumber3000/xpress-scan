import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe, Monitor, Smartphone, Loader2, Check, AlertCircle, ExternalLink,
  Copy, Image as ImageIcon, Trash2, Plus, Eye, EyeOff, X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../utils/api';

/**
 * Marketing → Website.
 *
 * Same shape as Control Center → Templates: settings on the left, a live
 * preview on the right. The preview is an iframe fed by the same renderer that
 * will serve the public page, so what you see here is literally the page, not
 * an approximation of it.
 *
 * The device toggle is not decoration. Almost everyone who finds a clinic
 * website arrives from a phone search, so the phone view is the one that
 * matters and it needs to be one click away.
 */

const DEVICES = {
  desktop: { label: 'Desktop', icon: Monitor, width: '100%', maxWidth: '100%', height: '100%' },
  mobile: { label: 'Mobile', icon: Smartphone, width: '390px', maxWidth: '390px', height: '844px' },
};

/** The toggle and the frame, shared by the docked pane and the full-screen sheet. */
const PreviewPane = ({ html, device, setDevice, refreshing, fullHeight }) => {
  const D = DEVICES[device];
  return (
    <>
      <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Preview</span>
          {refreshing && <Loader2 size={12} className="animate-spin text-gray-400" />}
        </div>

        {/* Most people who find a clinic online arrive from a phone search, so
            the phone view has to be one tap away rather than something you
            imagine from the desktop layout. */}
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
          {Object.entries(DEVICES).map(([id, d]) => {
            const Icon = d.icon;
            return (
              <button
                key={id}
                onClick={() => setDevice(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  device === id ? 'bg-white text-[#29828a] border border-gray-200' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={13} /> {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Flex, not grid: a grid item with justify-items:start is sized by its
          content, so the frame's width:100% had nothing to resolve against and
          the desktop preview collapsed to a phone-width column. */}
      <div className="flex-1 overflow-auto p-3 sm:p-5 flex items-start justify-center bg-gray-100">
        <div
          className="bg-white rounded-xl overflow-hidden border border-gray-200 transition-all duration-300 flex-shrink-0"
          style={{ width: D.width, maxWidth: '100%', height: device === 'mobile' ? D.height : fullHeight }}
        >
          {html ? (
            <iframe title="Website preview" srcDoc={html} className="w-full h-full border-0" sandbox="allow-same-origin" />
          ) : (
            <div className="h-full grid place-items-center text-gray-400 gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Building preview</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const Section = ({ title, hint, children }) => (
  <div className="border-b border-gray-100 px-5 py-4">
    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{title}</h3>
    {hint && <p className="text-[11px] text-gray-400 mt-0.5 mb-3 leading-snug">{hint}</p>}
    <div className={hint ? '' : 'mt-3'}>{children}</div>
  </div>
);

const ClinicWebsite = () => {
  const [settings, setSettings] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [device, setDevice] = useState('desktop');
  const [previewHtml, setPreviewHtml] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const fileRef = useRef(null);
  // What the server last confirmed, so a blur can tell a real edit from a
  // stray focus change.
  const savedColor = useRef(null);

  const loadPreview = useCallback(async () => {
    setRefreshing(true);
    try {
      // Fetched directly rather than through api.get: the helper parses every
      // response as JSON and hands back the Response object when that fails,
      // which is no use when the body is the HTML we want to render. Same shape
      // as the CSV exports elsewhere.
      const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${baseURL}/api/v1/marketing/website/preview`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      });
      setPreviewHtml(res.ok ? await res.text() : '');
    } catch {
      setPreviewHtml('');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        api.get('/marketing/website/settings'),
        api.get('/marketing/website/photos'),
      ]);
      setSettings(s);
      savedColor.current = s.primary_color;
      setPhotos(p || []);
    } catch {
      setSettings(null);
    }
    loadPreview();
  }, [loadPreview]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const patch = async (body, { silent } = {}) => {
    setSaving(true);
    try {
      const s = await api.put('/marketing/website/settings', body);
      setSettings(s);
      savedColor.current = s.primary_color;
      if (!silent) toast.success('Saved');
      loadPreview();
      return s;
    } catch (e) {
      toast.error(e?.message || 'Could not save that');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const photo = await api.post('/marketing/website/photos', fd);
      setPhotos((p) => [...p, photo]);
      toast.success('Photo added');
      loadPreview();
      loadAll();
    } catch (e) {
      toast.error(e?.message || 'Could not add that photo');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (id) => {
    try {
      await api.delete(`/marketing/website/photos/${id}`);
      setPhotos((p) => p.filter((x) => x.id !== id));
      loadPreview();
      loadAll();
    } catch (e) {
      toast.error(e?.message || 'Could not remove that photo');
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/c/${settings.slug}`;
  const pct = Math.round((settings.ready_count / settings.total_count) * 100);

  return (
    <div className="flex flex-col h-screen bg-gray-50/40">
      {/* Header, with the publish control kept at the top where it belongs. */}
      <div className="px-4 md:px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-[#29828a]/10 text-[#29828a] grid place-items-center flex-shrink-0">
            <Globe size={17} />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-900 leading-tight">Your website</h1>
            <p className="text-[11px] text-gray-500 truncate">
              Built from your Control Center setup, so it never goes stale.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Below lg the preview is not docked, so it needs its own way in. */}
          <button
            onClick={() => setSheetOpen(true)}
            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 min-h-[2.5rem] rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-gray-300"
          >
            <Monitor size={13} /> Preview
          </button>
          {settings.enabled && (
            <button
              onClick={() => { navigator.clipboard?.writeText(publicUrl); toast.success('Link copied'); }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-gray-300"
            >
              <Copy size={13} /> Copy link
            </button>
          )}
          <button
            onClick={() => patch({ website_enabled: !settings.enabled })}
            disabled={saving}
            className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[2.5rem] rounded-lg text-xs font-bold transition-colors disabled:opacity-60 ${
              settings.enabled
                ? 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
                : 'bg-[#29828a] hover:bg-[#1f6b72] text-white'
            }`}
          >
            {settings.enabled ? <><EyeOff size={14} /> Unpublish</> : <><Eye size={14} /> Publish</>}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: settings ─────────────────────────────────────────────── */}
        <aside className="w-full lg:w-[22rem] flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
          <Section title="Web address" hint="Where patients will find you.">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400 flex-shrink-0">/c/</span>
              <input
                defaultValue={settings.slug}
                onBlur={(e) => e.target.value !== settings.slug && patch({ website_slug: e.target.value })}
                className="flex-1 min-w-0 h-9 px-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#29828a] outline-none"
              />
            </div>
            {settings.enabled && (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold text-[#29828a] hover:underline">
                <ExternalLink size={11} /> Open live site
              </a>
            )}
          </Section>

          <Section title="Headline" hint="The sentence under your clinic name.">
            <input
              defaultValue={settings.tagline || ''}
              onBlur={(e) => e.target.value !== (settings.tagline || '') && patch({ tagline: e.target.value }, { silent: true })}
              placeholder="Gentle, unhurried dental care for families"
              className="w-full h-9 px-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#29828a] outline-none"
            />
            <textarea
              defaultValue={settings.about || ''}
              onBlur={(e) => e.target.value !== (settings.about || '') && patch({ website_about: e.target.value }, { silent: true })}
              placeholder="A short paragraph about the practice (optional)"
              rows={3}
              className="w-full mt-2 px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#29828a] outline-none resize-none"
            />
          </Section>

          <Section title="Photos" hint={`Up to 12. The first one becomes your hero image. ${photos.length}/12 added.`}>
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((p) => (
                <div key={p.id} className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(p.id)}
                    aria-label="Remove photo"
                    className="absolute top-1 right-1 w-6 h-6 rounded-md bg-white/90 text-gray-500 hover:text-red-600 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {photos.length < 12 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="aspect-[4/3] rounded-lg border border-dashed border-gray-300 grid place-items-center text-gray-400 hover:border-[#29828a] hover:text-[#29828a] transition-colors"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
                   onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
            {photos.length === 0 && (
              <p className="text-[11px] text-amber-700 mt-2 flex items-start gap-1.5">
                <ImageIcon size={12} className="mt-0.5 flex-shrink-0" />
                Without photos your hero shows a drawn illustration. A real photo of the
                practice does far more for a first-time visitor.
              </p>
            )}
          </Section>

          <Section title="Brand colour" hint="Used across the whole site.">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={(settings.primary_color || '#2a276e').toLowerCase()}
                onChange={(e) => setSettings((s) => ({ ...s, primary_color: e.target.value }))}
                // Save on commit, and only when it really moved. A bare onBlur
                // here wrote the clinic's brand colour on any loss of focus,
                // which is how a colour nobody chose ends up on the site.
                onBlur={(e) => {
                  const next = e.target.value.toLowerCase();
                  if (next !== (savedColor.current || '').toLowerCase()) {
                    savedColor.current = next;
                    patch({ primary_color: next }, { silent: true });
                  }
                }}
                className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer"
              />
              <span className="text-xs text-gray-500 font-mono">{settings.primary_color}</span>
            </div>
          </Section>

          <Section title="Numbers" hint="Shown as bands, never an exact patient count.">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.show_stats}
                onChange={(e) => patch({ website_show_stats: e.target.checked }, { silent: true })}
                className="w-4 h-4 accent-[#29828a]"
              />
              <span className="text-xs text-gray-700">Show patients treated, reviews and years open</span>
            </label>
          </Section>

          <Section title={`Setup ${settings.ready_count} of ${settings.total_count}`}
                   hint="Each one fills in a part of the page.">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-[#29828a] rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <ul className="space-y-1.5">
              {settings.readiness.map((c) => (
                <li key={c.key} className="flex items-start gap-2 text-xs">
                  <span className={`w-4 h-4 rounded-full grid place-items-center flex-shrink-0 mt-0.5 ${
                    c.done ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-300'
                  }`}>
                    {c.done ? <Check size={10} /> : <AlertCircle size={10} />}
                  </span>
                  <span className="min-w-0">
                    <span className={c.done ? 'text-gray-500' : 'text-gray-900 font-semibold'}>{c.label}</span>
                    {c.required && !c.done && <span className="text-red-500 font-bold"> *</span>}
                    {!c.done && c.hint && <span className="block text-[11px] text-gray-400">{c.hint}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </aside>

        {/* ── Right: live preview ────────────────────────────────────────
            Docked only from lg. At 768 the app sidebar plus a 22rem control
            column left the frame about 160px wide, which showed nothing useful,
            so below that the preview opens full screen instead. */}
        <main className="hidden lg:flex flex-1 flex-col overflow-hidden">
          <PreviewPane
            html={previewHtml} device={device} setDevice={setDevice}
            refreshing={refreshing} fullHeight="calc(100vh - 12rem)"
          />
        </main>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-[90] bg-white flex flex-col lg:hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-sm font-bold text-gray-900">Your website</h2>
            <button onClick={() => setSheetOpen(false)} aria-label="Close preview"
                    className="p-1.5 text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
          <PreviewPane
            html={previewHtml} device={device} setDevice={setDevice}
            refreshing={refreshing} fullHeight="100%"
          />
        </div>
      )}
    </div>
  );
};

export default ClinicWebsite;
