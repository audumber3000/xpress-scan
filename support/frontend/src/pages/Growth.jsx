import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, ArrowRightLeft, Users, Target, TrendingUp, PhoneCall, AlertTriangle, X, CalendarDays, Trophy, CircleOff, Upload, Download, FileText, CheckCircle2, Edit2, Save } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../utils/api';
import { PageHeader, Card, Badge, Spinner, fmt } from '../components/ui';

const STAGE_COLOR = {
  new_lead: 'slate',
  contact_attempted: 'amber',
  connected: 'sky',
  demo_scheduled: 'violet',
  demo_done: 'brand',
  trial_started: 'amber',
  trial_active: 'emerald',
  trial_expired: 'slate',
  negotiation: 'amber',
  won: 'emerald',
  lost: 'rose',
  nurture: 'sky',
};

const pretty = (s) => (s || '').replace(/_/g, ' ');

// Deterministic color from name hash → consistent avatar tint per lead
const AVATAR_COLORS = [
  'bg-rose-100 text-rose-700',
  'bg-orange-100 text-orange-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-teal-100 text-teal-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-pink-100 text-pink-700',
];

function avatarFor(name) {
  const s = (name || '?').trim();
  const initial = (s[0] || '?').toUpperCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const color = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return { initial, color };
}

function LeadAvatar({ name, size = 'md' }) {
  const { initial, color } = avatarFor(name);
  const sz = size === 'sm'
    ? 'w-6 h-6 text-[10px]'
    : size === 'lg'
      ? 'w-10 h-10 text-sm'
      : 'w-7 h-7 text-[11px]';
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-bold flex-shrink-0`}>
      {initial}
    </div>
  );
}

export default function Growth() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pipeline');
  const [summary, setSummary] = useState(null);
  const [pipeline, setPipeline] = useState([]);
  const [stages, setStages] = useState([]);
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    q: '', stage: '', source: '',
    lead_name: '', contact_person: '', phone: '', owner: '', mrr_min: '',
  });
  const clearFilters = () => setFilters({
    q: '', stage: '', source: '',
    lead_name: '', contact_person: '', phone: '', owner: '', mrr_min: '',
  });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ lead_name: '', contact_person: '', phone: '', source: 'instagram', stage: 'new_lead', expected_mrr: 0 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerMode, setDrawerMode] = useState('view'); // view | edit | create
  const [quickNote, setQuickNote] = useState('');
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const loadSummaryAndPipeline = async () => {
    const [sum, pipe, stageList] = await Promise.all([
      api.get('/growth/summary'),
      api.get('/growth/pipeline'),
      api.get('/growth/stages'),
    ]);
    setSummary(sum);
    setPipeline(pipe.stages || []);
    setStages(stageList || []);
  };

  const openLeadDrawer = async (leadId, startInEdit = false) => {
    setDrawerMode(startInEdit ? 'edit' : 'view');
    setDrawerOpen(true);
    setDrawerLoading(true);
    setQuickNote('');
    try {
      const res = await api.get(`/growth/${leadId}`);
      setSelectedLead(res.lead || null);
      setSelectedActivity(res.activity || []);
      if (startInEdit && res.lead) setEditForm(buildEditForm(res.lead));
    } catch {
      toast.error('Failed to load lead details');
      setDrawerOpen(false);
    } finally {
      setDrawerLoading(false);
    }
  };

  const buildEditForm = (lead) => ({
    lead_name: lead.lead_name || '',
    contact_person: lead.contact_person || '',
    phone: lead.phone || '',
    email: lead.email || '',
    source: lead.source || 'other',
    stage: lead.stage || 'new_lead',
    owner: lead.owner || '',
    priority: lead.priority || 'medium',
    expected_mrr: lead.expected_mrr ?? 0,
    next_follow_up_at: lead.next_follow_up_at ? lead.next_follow_up_at.slice(0, 16) : '',
    lost_reason: lead.lost_reason || '',
    notes: lead.notes || '',
  });

  const startEdit = () => {
    if (!selectedLead) return;
    setEditForm(buildEditForm(selectedLead));
    setDrawerMode('edit');
  };

  const saveEdit = async () => {
    if (!selectedLead) return;
    if (!editForm.lead_name?.trim()) {
      toast.error('Lead name is required');
      return;
    }
    setSavingEdit(true);
    try {
      const payload = { ...editForm };
      if (!payload.next_follow_up_at) delete payload.next_follow_up_at;
      if (payload.expected_mrr === '' || payload.expected_mrr === null) payload.expected_mrr = 0;
      await api.patch(`/growth/${selectedLead.id}`, payload);
      toast.success('Lead updated');
      await Promise.all([loadSummaryAndPipeline(), loadLeads()]);
      await openLeadDrawer(selectedLead.id);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to update lead');
    } finally {
      setSavingEdit(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerMode('view');
    setSelectedLead(null);
    setSelectedActivity([]);
    setQuickNote('');
    setEditForm({});
  };

  const openCreateDrawer = () => {
    setDrawerMode('create');
    setSelectedLead(null);
    setSelectedActivity([]);
    setQuickNote('');
    setForm({ lead_name: '', contact_person: '', phone: '', source: 'instagram', stage: 'new_lead', expected_mrr: 0 });
    setDrawerLoading(false);
    setDrawerOpen(true);
  };

  const runQuickAction = async (action) => {
    if (!selectedLead) return;
    try {
      if (action === 'call') {
        await api.post(`/growth/${selectedLead.id}/activity`, {
          activity_type: 'call',
          title: 'Call attempted',
          details: quickNote || `Called ${selectedLead.contact_person || selectedLead.lead_name}`,
        });
      } else if (action === 'demo') {
        await api.post(`/growth/${selectedLead.id}/activity`, {
          activity_type: 'demo',
          title: 'Demo completed',
          details: quickNote || 'Demo done with decision maker',
        });
        await api.post(`/growth/${selectedLead.id}/move-stage`, {
          to_stage: 'demo_done',
          note: quickNote || 'Moved via quick action: demo done',
        });
      } else if (action === 'trial') {
        await api.post(`/growth/${selectedLead.id}/activity`, {
          activity_type: 'trial',
          title: 'Trial started',
          details: quickNote || 'Trial started for lead',
        });
        await api.post(`/growth/${selectedLead.id}/move-stage`, {
          to_stage: 'trial_active',
          note: quickNote || 'Moved via quick action: trial active',
        });
      } else if (action === 'won') {
        await api.post(`/growth/${selectedLead.id}/move-stage`, {
          to_stage: 'won',
          note: quickNote || 'Lead converted to paid customer',
        });
      } else if (action === 'lost') {
        await api.post(`/growth/${selectedLead.id}/move-stage`, {
          to_stage: 'lost',
          outcome: quickNote || 'No decision / lost',
          note: quickNote || 'Marked as lost via quick action',
        });
      }

      toast.success('Action completed');
      await Promise.all([loadSummaryAndPipeline(), loadLeads()]);
      await openLeadDrawer(selectedLead.id);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Quick action failed');
    }
  };

  const loadLeads = async () => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.stage) params.set('stage', filters.stage);
    if (filters.source) params.set('source', filters.source);
    if (filters.lead_name) params.set('lead_name', filters.lead_name);
    if (filters.contact_person) params.set('contact_person', filters.contact_person);
    if (filters.phone) params.set('phone', filters.phone);
    if (filters.owner) params.set('owner', filters.owner);
    if (filters.mrr_min) params.set('mrr_min', filters.mrr_min);
    params.set('page', String(page));
    params.set('limit', '20');
    const res = await api.get(`/growth?${params.toString()}`);
    setLeads(res.leads || []);
    setTotal(res.total || 0);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      await Promise.all([loadSummaryAndPipeline(), loadLeads()]);
    } catch {
      toast.error('Failed to load growth data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      loadLeads().catch(() => toast.error('Failed to refresh leads'));
    }, 280);
    return () => clearTimeout(t);
  }, [page, filters]);
  useEffect(() => { setPage(1); }, [filters]);

  const moveStage = async (leadId, toStage) => {
    try {
      await api.post(`/growth/${leadId}/move-stage`, { to_stage: toStage });
      toast.success('Lead stage updated');
      await Promise.all([loadSummaryAndPipeline(), loadLeads()]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to move stage');
    }
  };

  const createLead = async () => {
    if (!form.lead_name?.trim()) {
      toast.error('Lead name is required');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/growth', form);
      toast.success('Lead added');
      await Promise.all([loadSummaryAndPipeline(), loadLeads()]);
      if (drawerMode === 'create') {
        const createdId = res?.id || res?.lead?.id;
        if (createdId) {
          await openLeadDrawer(createdId);
        } else {
          closeDrawer();
        }
      }
      setForm({ lead_name: '', contact_person: '', phone: '', source: 'instagram', stage: 'new_lead', expected_mrr: 0 });
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to add lead');
    } finally {
      setCreating(false);
    }
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / 20)), [total]);
  const [pageTab, setPageTab] = useState('metrics');

  const openImport = () => {
    setImportFile(null);
    setImportPreview([]);
    setImportResult(null);
    setImportOpen(true);
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Only CSV files are accepted');
      return;
    }
    setImportFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split('\n').filter(Boolean);
      const rows = lines.slice(0, 6).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
      setImportPreview(rows);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importFile) { toast.error('Please select a CSV file first'); return; }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await api.post('/growth/import-csv', formData);
      setImportResult(res);
      toast.success(`Imported ${res.imported} leads`);
      await Promise.all([loadSummaryAndPipeline(), loadLeads()]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const downloadSample = () => {
    const rows = [
      ['lead_name', 'contact_person', 'phone', 'email', 'source', 'stage', 'owner', 'priority', 'expected_mrr', 'notes'],
      ['City Dental Clinic', 'Dr. Priya Sharma', '9876543210', 'priya@citydental.com', 'instagram', 'new_lead', 'Audumber', 'high', '899', 'Interested in demo'],
      ['SmileCare Hospital', 'Dr. Rahul Mehta', '9988776655', 'rahul@smilecare.in', 'google', 'contact_attempted', 'Audumber', 'medium', '899', ''],
      ['Bright Smile Dental', '', '9123456789', '', 'referral', 'new_lead', '', 'low', '', 'Follow up next week'],
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'leads_import_sample.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Spinner />;

  return (
    <div className="p-6 space-y-6 max-w-[1250px]">
      <PageHeader
        title="Growth"
        subtitle="Leads, sales funnel, demos, trials, and conversions"
        actions={(
          <div className="flex items-center gap-2">
            <button
              onClick={openImport}
              className="h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1"
            >
              <Upload size={13} /> Import CSV
            </button>
            <button
              onClick={openCreateDrawer}
              className="h-8 px-3 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 inline-flex items-center gap-1"
            >
              <Plus size={13} /> Add Lead
            </button>
            <button
              onClick={refresh}
              className="h-8 px-3 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Refresh
            </button>
          </div>
        )}
      />

      {/* Page-level tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-6">
          {[
            { id: 'metrics', label: 'Metrics' },
            { id: 'pipeline', label: 'Pipeline & Leads' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setPageTab(t.id)}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                pageTab === t.id
                  ? 'border-[#29828a] text-[#29828a]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Metrics tab ── */}
      {pageTab === 'metrics' && (
        <div className="space-y-5">
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <Card className="p-3"><p className="text-[10px] text-slate-400 uppercase">Leads</p><p className="text-lg font-bold text-slate-900">{fmt.num(summary.totals?.leads)}</p></Card>
              <Card className="p-3"><p className="text-[10px] text-slate-400 uppercase">Won</p><p className="text-lg font-bold text-emerald-600">{fmt.num(summary.totals?.won)}</p></Card>
              <Card className="p-3"><p className="text-[10px] text-slate-400 uppercase">Lost</p><p className="text-lg font-bold text-rose-600">{fmt.num(summary.totals?.lost)}</p></Card>
              <Card className="p-3"><p className="text-[10px] text-slate-400 uppercase">Active Trials</p><p className="text-lg font-bold text-amber-600">{fmt.num(summary.totals?.active_trials)}</p></Card>
              <Card className="p-3"><p className="text-[10px] text-slate-400 uppercase">Win Rate</p><p className="text-lg font-bold text-brand-700">{summary.totals?.win_rate || 0}%</p></Card>
              <Card className="p-3"><p className="text-[10px] text-slate-400 uppercase">Expected MRR</p><p className="text-lg font-bold text-slate-900">{fmt.inr(summary.totals?.expected_mrr)}</p></Card>
            </div>
          )}

          {!!summary?.overdue_leads?.length && (
            <Card className="border-amber-200 bg-amber-50/50">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-800">Overdue Follow-ups ({summary.overdue_leads.length})</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {summary.overdue_leads.slice(0, 8).map(lead => (
                  <button key={lead.id} onClick={() => openLeadDrawer(lead.id)}
                    className="text-left bg-white border border-amber-200 rounded-lg px-3 py-2 hover:border-amber-300">
                    <p className="text-xs font-semibold text-slate-800">{lead.lead_name}</p>
                    <p className="text-[11px] text-slate-500">{pretty(lead.stage)} · {lead.delay_hours}h delayed</p>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {!!summary?.conversion_steps?.length && (
            <Card>
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-800">Stage Conversion %</h3>
                <p className="text-xs text-slate-400">Visibility into funnel health at each step</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.conversion_steps || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="to" tickFormatter={(v) => pretty(v)} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 100]} />
                      <Tooltip formatter={(v) => [`${v}%`, 'Conversion']} labelFormatter={(label) => pretty(label)} />
                      <Bar dataKey="conversion_pct" fill="#29828a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {summary.conversion_steps.map((s) => (
                    <div key={`${s.from}-${s.to}`} className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-xs font-semibold text-slate-700">{pretty(s.from)} → {pretty(s.to)}</p>
                      <p className="text-[11px] text-slate-400">{s.from_count} to {s.to_count} leads</p>
                      <p className="text-sm font-bold text-[#29828a] mt-0.5">{s.conversion_pct}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Pipeline & Leads tab ── */}
      {pageTab === 'pipeline' && (
        <Card>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {[
              { id: 'pipeline', label: 'Pipeline', icon: ArrowRightLeft },
              { id: 'leads', label: 'Leads', icon: Users },
              { id: 'playbook', label: 'Playbook', icon: Target },
            ].map(t => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`h-8 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 ${active ? 'bg-white text-[#29828a] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Icon size={14} /> {t.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'pipeline' && (
            <div className="mt-4 overflow-x-auto">
              <div className="flex gap-3 min-w-max pb-2">
                {pipeline.map(stage => (
                  <div key={stage.id} className="w-72 bg-slate-50 rounded-xl border border-slate-200/70 flex flex-col" style={{ height: 560 }}>
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200/70 flex-shrink-0">
                      <Badge color={STAGE_COLOR[stage.id] || 'slate'}>{pretty(stage.id)}</Badge>
                      <span className="text-xs text-slate-400">{stage.count}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                      {(stage.items || []).map(lead => (
                        <div key={lead.id} onClick={() => openLeadDrawer(lead.id)} className="w-full text-left bg-white border border-slate-200 rounded-lg p-2.5 hover:border-brand-300 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <LeadAvatar name={lead.lead_name} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 truncate">{lead.lead_name}</p>
                              <p className="text-[11px] text-slate-400 truncate">{lead.contact_person || '—'} · {lead.phone || '—'}</p>
                            </div>
                          </div>
                          {lead.notes && (
                            <p className="mt-1.5 text-[10px] text-slate-500 leading-snug line-clamp-2 italic">
                              “{lead.notes}”
                            </p>
                          )}
                          <div className="flex items-center justify-between gap-2 mt-2">
                            <Badge color="sky">{lead.source || 'unknown'}</Badge>
                            <span className="text-xs font-semibold text-slate-700">{fmt.inr(lead.expected_mrr)}</span>
                          </div>
                          <div className="mt-2">
                            <select value={lead.stage || 'new_lead'} onClick={(e) => e.stopPropagation()}
                              onChange={(e) => { e.stopPropagation(); moveStage(lead.id, e.target.value); }}
                              className="w-full h-7 px-2 text-xs border border-slate-200 rounded-md bg-white">
                              {stages.map(s => <option key={s} value={s}>{pretty(s)}</option>)}
                            </select>
                          </div>
                        </div>
                      ))}
                      {stage.count === 0 && (
                        <p className="text-[11px] text-slate-300 text-center py-4">No leads</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'leads' && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-400">Each column has its own search. Filters apply automatically.</p>
                <button onClick={clearFilters} className="h-7 px-2.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold hover:bg-slate-200">Clear filters</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <div className="max-h-[540px] overflow-y-auto">
                  <table className="w-full text-sm min-w-[920px]">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="border-b border-slate-100">
                        <th className="py-2.5 px-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-left w-[26%]">Lead</th>
                        <th className="py-2.5 px-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-left">Contact</th>
                        <th className="py-2.5 px-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-left">Phone</th>
                        <th className="py-2.5 px-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-left">Source</th>
                        <th className="py-2.5 px-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-left">Stage</th>
                        <th className="py-2.5 px-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-left">Owner</th>
                        <th className="py-2.5 px-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-left">MRR ≥</th>
                        <th className="py-2.5 px-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-left">Follow-up</th>
                        <th className="py-2.5 px-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-left">Move</th>
                        <th className="py-2.5 px-3" />
                      </tr>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="py-1.5 px-2">
                          <input value={filters.lead_name} onChange={(e) => setFilters(f => ({ ...f, lead_name: e.target.value }))}
                            placeholder="Search name…" className="w-full h-7 px-2 text-xs border border-slate-200 rounded-md bg-white" />
                        </th>
                        <th className="py-1.5 px-2">
                          <input value={filters.contact_person} onChange={(e) => setFilters(f => ({ ...f, contact_person: e.target.value }))}
                            placeholder="Search contact…" className="w-full h-7 px-2 text-xs border border-slate-200 rounded-md bg-white" />
                        </th>
                        <th className="py-1.5 px-2">
                          <input value={filters.phone} onChange={(e) => setFilters(f => ({ ...f, phone: e.target.value }))}
                            placeholder="Search phone…" className="w-full h-7 px-2 text-xs border border-slate-200 rounded-md bg-white" />
                        </th>
                        <th className="py-1.5 px-2">
                          <select value={filters.source} onChange={(e) => setFilters(f => ({ ...f, source: e.target.value }))}
                            className="w-full h-7 px-2 text-xs border border-slate-200 rounded-md bg-white">
                            <option value="">All</option>
                            {['instagram', 'facebook', 'google', 'referral', 'direct', 'other'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </th>
                        <th className="py-1.5 px-2">
                          <select value={filters.stage} onChange={(e) => setFilters(f => ({ ...f, stage: e.target.value }))}
                            className="w-full h-7 px-2 text-xs border border-slate-200 rounded-md bg-white">
                            <option value="">All</option>
                            {stages.map(s => <option key={s} value={s}>{pretty(s)}</option>)}
                          </select>
                        </th>
                        <th className="py-1.5 px-2">
                          <input value={filters.owner} onChange={(e) => setFilters(f => ({ ...f, owner: e.target.value }))}
                            placeholder="Owner…" className="w-full h-7 px-2 text-xs border border-slate-200 rounded-md bg-white" />
                        </th>
                        <th className="py-1.5 px-2">
                          <input type="number" min="0" value={filters.mrr_min} onChange={(e) => setFilters(f => ({ ...f, mrr_min: e.target.value }))}
                            placeholder="min ₹" className="w-full h-7 px-2 text-xs border border-slate-200 rounded-md bg-white" />
                        </th>
                        <th className="py-1.5 px-2" />
                        <th className="py-1.5 px-2" />
                        <th className="py-1.5 px-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {leads.length === 0 && (
                        <tr><td colSpan={10} className="py-8 text-center text-sm text-slate-400">No leads match these filters.</td></tr>
                      )}
                      {leads.map(lead => (
                        <tr key={lead.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3">
                            <button onClick={() => openLeadDrawer(lead.id)} className="text-left flex items-center gap-2 min-w-0">
                              <LeadAvatar name={lead.lead_name} />
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 hover:text-brand-700 truncate">{lead.lead_name}</p>
                                {lead.notes && (
                                  <p className="text-[10px] text-slate-400 italic truncate max-w-[200px]">“{lead.notes}”</p>
                                )}
                              </div>
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-xs">{lead.contact_person || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-600 text-xs">{lead.phone || '—'}</td>
                          <td className="py-2.5 px-3"><Badge color="sky">{lead.source || 'unknown'}</Badge></td>
                          <td className="py-2.5 px-3"><Badge color={STAGE_COLOR[lead.stage] || 'slate'}>{pretty(lead.stage || 'new_lead')}</Badge></td>
                          <td className="py-2.5 px-3 text-slate-600 text-xs">{lead.owner || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-700 font-semibold text-xs">{fmt.inr(lead.expected_mrr)}</td>
                          <td className="py-2.5 px-3 text-xs text-slate-400">{lead.next_follow_up_at ? fmt.datetime(lead.next_follow_up_at) : '—'}</td>
                          <td className="py-2.5 px-3">
                            <select value={lead.stage || 'new_lead'} onChange={(e) => moveStage(lead.id, e.target.value)} className="h-7 px-2 text-xs border border-slate-200 rounded-md bg-white">
                              {stages.map(s => <option key={s} value={s}>{pretty(s)}</option>)}
                            </select>
                          </td>
                          <td className="py-2.5 px-2">
                            <button onClick={() => openLeadDrawer(lead.id, true)}
                              title="Edit lead"
                              className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700 inline-flex items-center justify-center">
                              <Edit2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{total > 0 ? `${(page - 1) * 20 + 1}-${Math.min(page * 20, total)} of ${total}` : '0 results'}</span>
                <div className="flex gap-1">
                  <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="h-7 px-2 rounded bg-slate-100 text-slate-600 disabled:opacity-30">Prev</button>
                  <span className="h-7 px-2 inline-flex items-center">{page}/{totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="h-7 px-2 rounded bg-slate-100 text-slate-600 disabled:opacity-30">Next</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'playbook' && (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-4 bg-slate-50 border-slate-200">
                <h4 className="text-sm font-semibold text-slate-800 mb-2 inline-flex items-center gap-1.5"><TrendingUp size={16} /> Recommended Funnel</h4>
                <ol className="space-y-1.5 text-sm text-slate-600">
                  {['New Lead','Contact Attempted','Connected','Demo Scheduled','Demo Done','Trial Active','Negotiation','Won / Lost'].map((x, i) => (
                    <li key={x}><span className="text-slate-400 mr-1">{i + 1}.</span>{x}</li>
                  ))}
                </ol>
              </Card>
              <Card className="p-4 bg-slate-50 border-slate-200">
                <h4 className="text-sm font-semibold text-slate-800 mb-2 inline-flex items-center gap-1.5"><PhoneCall size={16} /> Operating Rules</h4>
                <ul className="space-y-1.5 text-sm text-slate-600 list-disc pl-4">
                  <li>Every lead must have next follow-up date.</li>
                  <li>No activity for 3 days in active stages = overdue.</li>
                  <li>Demo done should always create trial or explicit lost reason.</li>
                  <li>Won stage should include expected/final MRR.</li>
                  <li>Lost leads move to nurture if there is future potential.</li>
                </ul>
              </Card>
            </div>
          )}
        </Card>
      )}

      {importOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={() => setImportOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Import Leads from CSV</p>
                  <p className="text-xs text-slate-400 mt-0.5">Duplicates (same phone/email) are skipped automatically</p>
                </div>
                <button onClick={() => setImportOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center text-slate-400">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Column reference */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Required CSV Columns</p>
                    <button onClick={downloadSample} className="h-7 px-2.5 rounded-lg bg-brand-50 text-brand-700 text-[11px] font-semibold hover:bg-brand-100 inline-flex items-center gap-1">
                      <Download size={12} /> Sample CSV
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                    {[
                      ['lead_name', 'Required — clinic/business name'],
                      ['contact_person', 'Doctor or owner name'],
                      ['phone', 'Used for duplicate check'],
                      ['email', 'Used for duplicate check'],
                      ['source', 'instagram, google, referral…'],
                      ['stage', 'new_lead, connected, demo_done…'],
                      ['owner', 'Who owns this lead'],
                      ['priority', 'high / medium / low'],
                      ['expected_mrr', 'Number in INR (e.g. 899)'],
                      ['notes', 'Any free-text notes'],
                    ].map(([col, hint]) => (
                      <div key={col} className="flex gap-1.5">
                        <span className="font-mono font-semibold text-brand-700 shrink-0">{col}</span>
                        <span className="text-slate-400 truncate">{hint}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Drop zone */}
                {!importResult && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleFileSelect(e.dataTransfer.files[0]); }}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${importFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50/30'}`}
                  >
                    <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFileSelect(e.target.files[0])} />
                    {importFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText size={18} className="text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-700">{importFile.name}</span>
                        <span className="text-xs text-slate-400">({(importFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-semibold text-slate-600">Drop CSV here or click to browse</p>
                        <p className="text-xs text-slate-400 mt-1">UTF-8 or Latin-1 encoding · max 5 MB</p>
                      </>
                    )}
                  </div>
                )}

                {/* Preview table */}
                {importPreview.length > 1 && !importResult && (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs min-w-max">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {importPreview[0].map((h, i) => (
                            <th key={i} className="py-1.5 px-3 text-[10px] font-semibold text-slate-500 uppercase text-left whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {importPreview.slice(1).map((row, ri) => (
                          <tr key={ri} className="hover:bg-slate-50">
                            {row.map((cell, ci) => (
                              <td key={ci} className="py-1.5 px-3 text-slate-700 max-w-[140px] truncate">{cell || <span className="text-slate-300">—</span>}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-[10px] text-slate-400 px-3 py-1.5">Showing first 5 rows preview</p>
                  </div>
                )}

                {/* Result */}
                {importResult && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      <p className="text-sm font-semibold text-emerald-800">Import complete</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-lg font-bold text-emerald-600">{importResult.imported}</p>
                        <p className="text-[10px] text-slate-500 uppercase">Imported</p>
                      </div>
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-lg font-bold text-amber-500">{importResult.skipped_duplicates}</p>
                        <p className="text-[10px] text-slate-500 uppercase">Skipped</p>
                      </div>
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-lg font-bold text-rose-500">{importResult.errors?.length || 0}</p>
                        <p className="text-[10px] text-slate-500 uppercase">Errors</p>
                      </div>
                    </div>
                    {importResult.errors?.length > 0 && (
                      <div className="mt-2 max-h-28 overflow-y-auto space-y-1">
                        {importResult.errors.map((e, i) => (
                          <p key={i} className="text-xs text-rose-600">Row {e.row}: {e.reason}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 justify-end">
                {importResult ? (
                  <>
                    <button onClick={() => { setImportFile(null); setImportPreview([]); setImportResult(null); }} className="h-9 px-4 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100">Import More</button>
                    <button onClick={() => setImportOpen(false)} className="h-9 px-4 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700">Done</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setImportOpen(false)} className="h-9 px-4 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancel</button>
                    <button onClick={handleImport} disabled={!importFile || importing} className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5">
                      {importing ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing...</> : <><Upload size={14} /> Import Leads</>}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/35" onClick={closeDrawer} />
          <aside className="fixed right-0 top-0 h-full w-full sm:w-[460px] bg-white z-50 border-l border-slate-200 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-2 min-w-0">
                {selectedLead?.lead_name && <LeadAvatar name={selectedLead.lead_name} size="lg" />}
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Lead Details</p>
                  <p className="text-sm font-semibold text-slate-900 truncate">{selectedLead?.lead_name || 'Loading...'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {drawerMode === 'view' && selectedLead && (
                  <button onClick={startEdit} className="h-8 px-2.5 rounded-lg bg-brand-50 text-brand-700 text-xs font-semibold hover:bg-brand-100 inline-flex items-center gap-1">
                    <Edit2 size={12} /> Edit
                  </button>
                )}
                <button onClick={closeDrawer} className="w-8 h-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center text-slate-500">
                  <X size={16} />
                </button>
              </div>
            </div>

            {drawerLoading ? (
              <div className="p-6"><Spinner /></div>
            ) : drawerMode === 'edit' && selectedLead ? (
              <div className="p-4 space-y-3">
                <Card className="p-3 space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Edit Lead</p>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Lead / Clinic Name *</label>
                    <input value={editForm.lead_name} onChange={(e) => setEditForm(f => ({ ...f, lead_name: e.target.value }))}
                      className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Contact Person</label>
                      <input value={editForm.contact_person} onChange={(e) => setEditForm(f => ({ ...f, contact_person: e.target.value }))}
                        className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Phone</label>
                      <input value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Email</label>
                    <input value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Source</label>
                      <select value={editForm.source} onChange={(e) => setEditForm(f => ({ ...f, source: e.target.value }))}
                        className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50">
                        {['instagram', 'facebook', 'google', 'referral', 'direct', 'other'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Stage</label>
                      <select value={editForm.stage} onChange={(e) => setEditForm(f => ({ ...f, stage: e.target.value }))}
                        className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50">
                        {stages.map(s => <option key={s} value={s}>{pretty(s)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Owner</label>
                      <input value={editForm.owner} onChange={(e) => setEditForm(f => ({ ...f, owner: e.target.value }))}
                        className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Priority</label>
                      <select value={editForm.priority} onChange={(e) => setEditForm(f => ({ ...f, priority: e.target.value }))}
                        className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50">
                        {['high', 'medium', 'low'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Expected MRR (₹)</label>
                      <input type="number" min="0" value={editForm.expected_mrr}
                        onChange={(e) => setEditForm(f => ({ ...f, expected_mrr: e.target.value === '' ? '' : Number(e.target.value) }))}
                        className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Next Follow-up</label>
                      <input type="datetime-local" value={editForm.next_follow_up_at}
                        onChange={(e) => setEditForm(f => ({ ...f, next_follow_up_at: e.target.value }))}
                        className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Notes</label>
                    <textarea rows={3} value={editForm.notes}
                      onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Quick note shown on the pipeline card…"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                  </div>
                  {editForm.stage === 'lost' && (
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Lost Reason</label>
                      <input value={editForm.lost_reason}
                        onChange={(e) => setEditForm(f => ({ ...f, lost_reason: e.target.value }))}
                        className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button onClick={() => setDrawerMode('view')}
                      className="h-9 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200">
                      Cancel
                    </button>
                    <button onClick={saveEdit} disabled={savingEdit}
                      className="h-9 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 inline-flex items-center justify-center gap-1">
                      <Save size={13} /> {savingEdit ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </Card>
              </div>
            ) : drawerMode === 'create' ? (
              <div className="p-4 space-y-4">
                <Card className="p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Create Lead</p>
                  <div className="space-y-2">
                    <input
                      value={form.lead_name}
                      onChange={(e) => setForm(f => ({ ...f, lead_name: e.target.value }))}
                      placeholder="Lead / Clinic name *"
                      className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={form.contact_person}
                        onChange={(e) => setForm(f => ({ ...f, contact_person: e.target.value }))}
                        placeholder="Contact person"
                        className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50"
                      />
                      <input
                        value={form.phone}
                        onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone"
                        className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={form.source} onChange={(e) => setForm(f => ({ ...f, source: e.target.value }))} className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50">
                        {['instagram', 'facebook', 'google', 'referral', 'direct', 'other'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select value={form.stage} onChange={(e) => setForm(f => ({ ...f, stage: e.target.value }))} className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50">
                        {stages.map(s => <option key={s} value={s}>{pretty(s)}</option>)}
                      </select>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={form.expected_mrr}
                      onChange={(e) => setForm(f => ({ ...f, expected_mrr: Number(e.target.value || 0) }))}
                      placeholder="Expected MRR"
                      className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button onClick={closeDrawer} className="h-9 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200">Cancel</button>
                    <button onClick={createLead} disabled={creating} className="h-9 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 inline-flex items-center justify-center gap-1">
                      <Plus size={13} /> {creating ? 'Adding...' : 'Add Lead'}
                    </button>
                  </div>
                </Card>
              </div>
            ) : selectedLead ? (
              <div className="p-4 space-y-4">
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge color={STAGE_COLOR[selectedLead.stage] || 'slate'}>{pretty(selectedLead.stage)}</Badge>
                    <Badge color="sky">{selectedLead.source || 'unknown'}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-slate-500">Contact: <span className="text-slate-800 font-medium">{selectedLead.contact_person || '—'}</span></p>
                    <p className="text-slate-500">Phone: <span className="text-slate-800 font-medium">{selectedLead.phone || '—'}</span></p>
                    <p className="text-slate-500">Owner: <span className="text-slate-800 font-medium">{selectedLead.owner || '—'}</span></p>
                    <p className="text-slate-500">MRR: <span className="text-slate-800 font-medium">{fmt.inr(selectedLead.expected_mrr)}</span></p>
                    <p className="text-slate-500 col-span-2">Next follow-up: <span className="text-slate-800 font-medium">{selectedLead.next_follow_up_at ? fmt.datetime(selectedLead.next_follow_up_at) : '—'}</span></p>
                  </div>
                </Card>

                <Card className="p-3">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Quick Actions</p>
                  <textarea
                    rows={2}
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    placeholder="Optional note/outcome"
                    className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50"
                  />
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button onClick={() => runQuickAction('call')} className="h-8 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200">Call</button>
                    <button onClick={() => runQuickAction('demo')} className="h-8 rounded-lg bg-violet-100 text-violet-700 text-xs font-semibold hover:bg-violet-200">Demo Done</button>
                    <button onClick={() => runQuickAction('trial')} className="h-8 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold hover:bg-amber-200">Start Trial</button>
                    <button onClick={() => runQuickAction('won')} className="h-8 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold hover:bg-emerald-200 inline-flex items-center justify-center gap-1"><Trophy size={13} /> Won</button>
                    <button onClick={() => runQuickAction('lost')} className="h-8 col-span-2 rounded-lg bg-rose-100 text-rose-700 text-xs font-semibold hover:bg-rose-200 inline-flex items-center justify-center gap-1"><CircleOff size={13} /> Mark Lost</button>
                  </div>
                </Card>

                <Card className="p-3">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Activity Timeline</p>
                  {selectedActivity.length === 0 ? (
                    <p className="text-xs text-slate-400">No activity yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedActivity.map(item => (
                        <div key={item.id} className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/50">
                          <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{item.details || '—'}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-slate-400">{item.by_user || 'system'}</span>
                            <span className="text-[10px] text-slate-400 inline-flex items-center gap-1"><CalendarDays size={11} /> {fmt.datetime(item.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            ) : (
              <div className="p-6 text-sm text-slate-400">Lead not found.</div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
