import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Building2, ChevronRight, Users, User, Crown } from 'lucide-react';
import api from '../utils/api';
import { PageHeader, Card, Badge, StatusBadge as SBadge, Pagination, Spinner, TabBar, fmt } from '../components/ui';

const PLAN_MAP = { free: 'slate', professional: 'violet', professional_annual: 'sky', enterprise: 'amber' };
const STATUS_TABS = ['all', 'active', 'suspended'];
const PLAN_TABS = ['all', 'free', 'professional', 'enterprise'];

const TABS = [
  { id: 'clinics', label: 'Clinics' },
  { id: 'owners', label: 'Owners' },
];

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex bg-slate-100 p-0.5 rounded-lg">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)}
          className={`px-3 py-1.5 text-[11px] font-semibold rounded-md capitalize transition-all ${
            value === o ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          {o}
        </button>
      ))}
    </div>
  );
}

function ClinicsTab() {
  const [clinics, setClinics] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const fetchClinics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (q) params.set('q', q);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (planFilter !== 'all') params.set('plan', planFilter);
      const res = await api.get(`/clinics?${params}`);
      setClinics(res.clinics || []);
      setTotal(res.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [q, statusFilter, planFilter, page]);

  useEffect(() => { fetchClinics(); }, [fetchClinics]);
  useEffect(() => { setPage(1); }, [q, statusFilter, planFilter]);

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <SegmentedControl options={STATUS_TABS} value={statusFilter} onChange={setStatusFilter} />
          <SegmentedControl options={PLAN_TABS} value={planFilter} onChange={setPlanFilter} />
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search clinics..." value={q} onChange={e => setQ(e.target.value)}
            className="h-8 pl-8 pr-3 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400 w-52 transition-colors" />
        </div>
      </div>

      <Card padding={false}>
        {loading ? <Spinner /> : clinics.length === 0 ? (
          <div className="py-20 text-center">
            <Building2 size={24} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">No clinics found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Clinic', 'Plan', 'Status', 'Patients', 'Revenue', 'Joined', ''].map(h => (
                    <th key={h} className="py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {clinics.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 size={14} className="text-brand-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{c.name}</p>
                          <p className="text-[11px] text-slate-400">{c.clinic_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4"><Badge color={PLAN_MAP[c.subscription_plan] || 'slate'}>{c.subscription_plan || 'free'}</Badge></td>
                    <td className="py-3 px-4"><SBadge status={c.status} /></td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1 text-sm text-slate-600">
                        <Users size={12} className="text-slate-400" /> {fmt.num(c.patient_count)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-700">{fmt.inr(c.total_revenue)}</td>
                    <td className="py-3 px-4 text-xs text-slate-400">{fmt.date(c.created_at)}</td>
                    <td className="py-3 px-4">
                      <Link to={`/clinics/${c.id}`} className="flex items-center gap-0.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
                        View <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} total={total} perPage={LIMIT} onPageChange={setPage} />
      </Card>
    </>
  );
}

function OwnersTab() {
  const [owners, setOwners] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const fetchOwners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (q) params.set('q', q);
      const res = await api.get(`/owners?${params}`);
      setOwners(res.owners || []);
      setTotal(res.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [q, page]);

  useEffect(() => { fetchOwners(); }, [fetchOwners]);
  useEffect(() => { setPage(1); }, [q]);

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center justify-end">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search owners by name or email..." value={q} onChange={e => setQ(e.target.value)}
            className="h-8 pl-8 pr-3 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400 w-72 transition-colors" />
        </div>
      </div>

      <Card padding={false}>
        {loading ? <Spinner /> : owners.length === 0 ? (
          <div className="py-20 text-center">
            <Crown size={24} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">No owners found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Owner', 'Clinics', 'Patients', 'Revenue', 'Joined', ''].map(h => (
                    <th key={h} className="py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {owners.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <User size={14} className="text-violet-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{o.name || '—'}</p>
                          <p className="text-[11px] text-slate-400 truncate">{o.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        <Badge color="violet">{o.clinic_count}</Badge>
                        {(o.clinics || []).slice(0, 3).map(c => (
                          <span key={c.id} className="text-[11px] text-slate-500 truncate max-w-[140px]">{c.name}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1 text-sm text-slate-600">
                        <Users size={12} className="text-slate-400" /> {fmt.num(o.patient_count)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-700">{fmt.inr(o.total_revenue)}</td>
                    <td className="py-3 px-4 text-xs text-slate-400">{fmt.date(o.created_at)}</td>
                    <td className="py-3 px-4">
                      <Link to={`/owners/${o.id}`} className="flex items-center gap-0.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
                        View <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} total={total} perPage={LIMIT} onPageChange={setPage} />
      </Card>
    </>
  );
}

export default function Clinics() {
  const [tab, setTab] = useState(() => (
    new URLSearchParams(window.location.search).get('tab') === 'owners' ? 'owners' : 'clinics'
  ));

  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url);
  }, [tab]);

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <PageHeader
        title="Clinics & Owners"
        subtitle="Manage clinic accounts and their owners"
      />

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'clinics' ? <ClinicsTab /> : <OwnersTab />}
    </div>
  );
}
