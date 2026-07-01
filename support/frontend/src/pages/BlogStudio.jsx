import { useEffect, useState } from 'react';
import { Sparkles, Loader2, Send, Save, Trash2, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import client from '../utils/api';

const StatusBadge = ({ status }) => (
  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
    status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
  }`}>{status}</span>
);

export default function BlogStudio() {
  const [config, setConfig] = useState({ claude_ready: false, sanity_ready: false });
  const [posts, setPosts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ topic: '', keywords: '', tone: '', words: 900 });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [cfg, list] = await Promise.all([client.get('/blog/config'), client.get('/blog')]);
      setConfig(cfg);
      setPosts(list);
    } catch (e) { setError('Failed to load blog data'); }
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    if (!form.topic.trim()) return;
    setError(''); setGenerating(true);
    try {
      const post = await client.post('/blog/generate', form);
      setPosts((p) => [post, ...p]);
      setSelected(post);
    } catch (e) {
      setError(e.response?.data?.detail || 'Generation failed');
    } finally { setGenerating(false); }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true); setError('');
    try {
      const updated = await client.put(`/blog/${selected.id}`, {
        title: selected.title, slug: selected.slug, excerpt: selected.excerpt,
        seo_title: selected.seo_title, seo_description: selected.seo_description,
        body_markdown: selected.body_markdown, tags: selected.tags,
      });
      setSelected(updated);
      setPosts((p) => p.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) { setError(e.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  };

  const publish = async () => {
    if (!selected) return;
    if (!window.confirm('Publish this post to Sanity? It will go live on the blog.')) return;
    setPublishing(true); setError('');
    try {
      const updated = await client.post(`/blog/${selected.id}/publish`);
      setSelected(updated);
      setPosts((p) => p.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) { setError(e.response?.data?.detail || 'Publish failed'); }
    finally { setPublishing(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this draft?')) return;
    await client.delete(`/blog/${id}`);
    setPosts((p) => p.filter((x) => x.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const upd = (k, v) => setSelected((s) => ({ ...s, [k]: v }));
  const isPublished = selected?.status === 'published';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="text-indigo-600" size={22} /> AI Blog Studio
        </h1>
        <p className="text-sm text-gray-500 mt-1">Generate SEO blog drafts with Claude, review, then publish to Sanity.</p>
      </div>

      {/* Integration status */}
      <div className="flex flex-wrap gap-3 mb-5 text-xs">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold ${config.claude_ready ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {config.claude_ready ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} Claude {config.claude_ready ? 'connected' : '— set ANTHROPIC_API_KEY'}
        </span>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold ${config.sanity_ready ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {config.sanity_ready ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} Sanity {config.sanity_ready ? 'connected' : '— set SANITY_PROJECT_ID / DATASET / TOKEN'}
        </span>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* Left: generate + drafts */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-gray-800">New post</h2>
            <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}
              placeholder="Topic, e.g. 'Reduce no-shows with WhatsApp reminders'"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none" />
            <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              placeholder="Target keywords (optional)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none" />
            <div className="flex gap-2">
              <input value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}
                placeholder="Tone (optional)"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none" />
              <input type="number" min="300" step="100" value={form.words} onChange={(e) => setForm({ ...form, words: Number(e.target.value) })}
                className="w-24 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none" />
            </div>
            <button onClick={generate} disabled={generating || !config.claude_ready || !form.topic.trim()}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {generating ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : <><Sparkles size={16} /> Generate draft</>}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">Drafts ({posts.length})</div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
              {posts.length === 0 && <p className="px-4 py-6 text-sm text-gray-400 text-center">No posts yet</p>}
              {posts.map((p) => (
                <button key={p.id} onClick={() => setSelected(p)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selected?.id === p.id ? 'bg-indigo-50/60' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">{p.title || '(untitled)'}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{p.excerpt}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: editor */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          {!selected ? (
            <div className="h-full min-h-[300px] flex items-center justify-center text-gray-400 text-sm">
              Generate a draft or pick one to review.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={selected.status} />
                  {selected.model_used && <span className="text-[10px] text-gray-400">{selected.model_used}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {!isPublished && (
                    <button onClick={save} disabled={saving}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                    </button>
                  )}
                  {!isPublished && (
                    <button onClick={publish} disabled={publishing || !config.sanity_ready}
                      title={!config.sanity_ready ? 'Configure Sanity first' : ''}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-green-600 rounded-lg px-3 py-1.5 hover:bg-green-700 disabled:opacity-50">
                      {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Publish
                    </button>
                  )}
                  <button onClick={() => remove(selected.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>

              {isPublished && selected.published_url && (
                <a href={selected.published_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  Live: {selected.published_url} <ExternalLink size={13} />
                </a>
              )}

              <Field label="Title"><input disabled={isPublished} value={selected.title || ''} onChange={(e) => upd('title', e.target.value)} className="inp" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Slug"><input disabled={isPublished} value={selected.slug || ''} onChange={(e) => upd('slug', e.target.value)} className="inp" /></Field>
                <Field label="Tags (comma-separated)"><input disabled={isPublished} value={(selected.tags || []).join(', ')} onChange={(e) => upd('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} className="inp" /></Field>
              </div>
              <Field label="Excerpt"><input disabled={isPublished} value={selected.excerpt || ''} onChange={(e) => upd('excerpt', e.target.value)} className="inp" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SEO title"><input disabled={isPublished} value={selected.seo_title || ''} onChange={(e) => upd('seo_title', e.target.value)} className="inp" /></Field>
                <Field label="SEO description"><input disabled={isPublished} value={selected.seo_description || ''} onChange={(e) => upd('seo_description', e.target.value)} className="inp" /></Field>
              </div>
              <Field label="Body (Markdown)">
                <textarea disabled={isPublished} value={selected.body_markdown || ''} onChange={(e) => upd('body_markdown', e.target.value)}
                  rows={20} className="inp font-mono text-[13px] leading-relaxed resize-y" />
              </Field>
            </div>
          )}
        </div>
      </div>

      <style>{`.inp{width:100%;border:1px solid #e5e7eb;border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem;outline:none}.inp:focus{box-shadow:0 0 0 3px rgba(99,102,241,.15)}.inp:disabled{background:#f9fafb;color:#6b7280}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</span>
      {children}
    </label>
  );
}
