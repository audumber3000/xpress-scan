import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, ArrowRightLeft, Users, Target, TrendingUp, PhoneCall, AlertTriangle, X, CalendarDays, Trophy, CircleOff } from 'lucide-react';
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

export default function Growth() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pipeline');
  const [summary, setSummary] = useState(null);
  const [pipeline, setPipeline] = useState([]);
  const [stages, setStages] = useState([]);
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ q: '', stage: '', source: '' });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ lead_name: '', contact_person: '', phone: '', source: 'instagram', stage: 'new_lead', expected_mrr: 0 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerMode, setDrawerMode] = useState('view');
  const [quickNote, setQuickNote] = useState('');

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

  const openLeadDrawer = async (leadId) => {
    setDrawerMode('view');
    setDrawerOpen(true);
    setDrawerLoading(true);
    setQuickNote('');
    try {
      const res = await api.get(`/growth/${leadId}`);
      setSelectedLead(res.lead || null);
      setSelectedActivity(res.activity || []);
    } catch {
      toast.error('Failed to load lead details');
      setDrawerOpen(false);
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerMode('view');
    setSelectedLead(null);
    setSelectedActivity([]);
    setQuickNote('');
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
    if (!loading) loadLeads().catch(() => toast.error('Failed to refresh leads'));
  }, [page, filters.stage, filters.source]);

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

  if (loading) return <Spinner />;

  return (
    <div className="p-6 space-y-6 max-w-[1250px]">
      <PageHeader
        title="Growth"
        subtitle="Leads, sales funnel, demos, trials, and conversions"
        actions={(
          <div className="flex items-center gap-2">
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
              <button
                key={lead.id}
                onClick={() => openLeadDrawer(lead.id)}
                className="text-left bg-white border border-amber-200 rounded-lg px-3 py-2 hover:border-amber-300"
              >
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
                  <Bar dataKey="conversion_pct" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {summary.conversion_steps.map((s) => (
                <div key={`${s.from}-${s.to}`} className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-xs font-semibold text-slate-700">{pretty(s.from)} → {pretty(s.to)}</p>
                  <p className="text-[11px] text-slate-400">{s.from_count} to {s.to_count} leads</p>
                  <p className="text-sm font-bold text-brand-700 mt-0.5">{s.conversion_pct}%</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

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
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`h-8 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 ${active ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'pipeline' && (
          <div className="mt-4 overflow-x-auto">
            <div className="flex gap-3 min-w-max pb-2">
              {pipeline.map(stage => (
                <div key={stage.id} className="w-72 bg-slate-50 rounded-xl border border-slate-200/70 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge color={STAGE_COLOR[stage.id] || 'slate'}>{pretty(stage.id)}</Badge>
                    <span className="text-xs text-slate-400">{stage.count}</span>
                  </div>

                  <div className="space-y-2">
                    {(stage.items || []).slice(0, 8).map(lead => (
                      <div key={lead.id} onClick={() => openLeadDrawer(lead.id)} className="w-full text-left bg-white border border-slate-200 rounded-lg p-2.5 hover:border-brand-300 cursor-pointer">
                        <p className="text-sm font-semibold text-slate-800 truncate">{lead.lead_name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{lead.contact_person || '—'} · {lead.phone || '—'}</p>
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <Badge color="sky">{lead.source || 'unknown'}</Badge>
                          <span className="text-xs font-semibold text-slate-700">{fmt.inr(lead.expected_mrr)}</span>
                        </div>
                        <div className="mt-2">
                          <select
                            value={lead.stage || 'new_lead'}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              moveStage(lead.id, e.target.value);
                            }}
                            className="w-full h-7 px-2 text-xs border border-slate-200 rounded-md bg-white"
                          >
                            {stages.map(s => <option key={s} value={s}>{pretty(s)}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                    {stage.count > 8 && <p className="text-[11px] text-slate-400 text-center">+{stage.count - 8} more</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input value={filters.q} onChange={(e) => setFilters(f => ({ ...f, q: e.target.value }))} placeholder="Search lead/contact/phone" className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white" />
              <select value={filters.stage} onChange={(e) => setFilters(f => ({ ...f, stage: e.target.value }))} className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white">
                <option value="">All stages</option>
                {stages.map(s => <option key={s} value={s}>{pretty(s)}</option>)}
              </select>
              <select value={filters.source} onChange={(e) => setFilters(f => ({ ...f, source: e.target.value }))} className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white">
                <option value="">All sources</option>
                {['instagram', 'facebook', 'google', 'referral', 'direct', 'other'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => loadLeads()} className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200">Apply</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Lead', 'Source', 'Stage', 'Owner', 'MRR', 'Follow-up', 'Move'].map(h => (
                      <th key={h} className="py-2.5 px-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3">
                        <button onClick={() => openLeadDrawer(lead.id)} className="text-left">
                          <p className="font-semibold text-slate-800 hover:text-brand-700">{lead.lead_name}</p>
                        </button>
                        <p className="text-[11px] text-slate-400">{lead.contact_person || '—'} · {lead.phone || '—'}</p>
                      </td>
                      <td className="py-2.5 px-3"><Badge color="sky">{lead.source || 'unknown'}</Badge></td>
                      <td className="py-2.5 px-3"><Badge color={STAGE_COLOR[lead.stage] || 'slate'}>{pretty(lead.stage || 'new_lead')}</Badge></td>
                      <td className="py-2.5 px-3 text-slate-600">{lead.owner || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-semibold">{fmt.inr(lead.expected_mrr)}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-400">{lead.next_follow_up_at ? fmt.datetime(lead.next_follow_up_at) : '—'}</td>
                      <td className="py-2.5 px-3">
                        <select value={lead.stage || 'new_lead'} onChange={(e) => moveStage(lead.id, e.target.value)} className="h-7 px-2 text-xs border border-slate-200 rounded-md bg-white">
                          {stages.map(s => <option key={s} value={s}>{pretty(s)}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                {[
                  'New Lead',
                  'Contact Attempted',
                  'Connected',
                  'Demo Scheduled',
                  'Demo Done',
                  'Trial Active',
                  'Negotiation',
                  'Won / Lost',
                ].map((x, i) => <li key={x}><span className="text-slate-400 mr-1">{i + 1}.</span>{x}</li>)}
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

      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/35" onClick={closeDrawer} />
          <aside className="fixed right-0 top-0 h-full w-full sm:w-[460px] bg-white z-50 border-l border-slate-200 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between z-10">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Lead Details</p>
                <p className="text-sm font-semibold text-slate-900">{selectedLead?.lead_name || 'Loading...'}</p>
              </div>
              <button onClick={closeDrawer} className="w-8 h-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center text-slate-500">
                <X size={16} />
              </button>
            </div>

            {drawerLoading ? (
              <div className="p-6"><Spinner /></div>
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
