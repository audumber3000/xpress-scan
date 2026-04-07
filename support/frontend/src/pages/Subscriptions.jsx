import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { CreditCard, CheckCircle2, XCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { PageHeader, StatCard, Card, CardHeader, Badge, StatusBadge, Pagination, FilterSelect, Spinner, fmt } from '../components/ui';

const PLAN_MAP = { free: 'slate', professional: 'sky', enterprise: 'violet' };
const PLAN_ORDER = ['enterprise', 'professional', 'free'];
const PLAN_BAR = { enterprise: 'bg-violet-500', professional: 'bg-sky-500', free: 'bg-slate-400' };
const STATUS_BAR = { active: 'bg-emerald-500', paused: 'bg-amber-400', cancelled: 'bg-rose-500', expired: 'bg-slate-400' };
const LIMIT = 50;

function PlanBar({ plan, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700 capitalize">{plan}</span>
        <span className="text-slate-500">{fmt.num(count)} · {pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${PLAN_BAR[plan] || 'bg-brand-400'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Subscriptions() {
  const [summary, setSummary] = useState(null);
  const [subs, setSubs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([
        api.get('/subscriptions/summary'),
        api.get(`/subscriptions/?page=${page}&per_page=${LIMIT}${statusFilter ? `&status=${statusFilter}` : ''}${planFilter ? `&plan_name=${planFilter}` : ''}`),
      ]);
      setSummary(s);
      setSubs(list.subscriptions);
      setTotal(list.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, statusFilter, planFilter]);

  useEffect(() => { load(); }, [load]);

  const daysUntil = (d) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

  const expiringSoon = useMemo(() => {
    return subs
      .filter(s => s.status === 'active' && s.current_end && daysUntil(s.current_end) <= 30 && daysUntil(s.current_end) > 0)
      .sort((a, b) => new Date(a.current_end) - new Date(b.current_end));
  }, [subs]);

  const filtered = useMemo(() => {
    if (!search.trim()) return subs;
    const q = search.toLowerCase();
    return subs.filter(s => s.clinic?.toLowerCase().includes(q) || s.provider_subscription_id?.toLowerCase().includes(q));
  }, [subs, search]);

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <PageHeader title="Subscriptions" subtitle="Manage clinic plans and upcoming renewals" />

      {loading && !summary ? <Spinner /> : (
        <>
          {summary && (
            <>
              {/* KPI Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total" value={fmt.num(summary.total)} icon={CreditCard} color="brand" />
                <StatCard
                  label="Active"
                  value={fmt.num(summary.by_status?.active || 0)}
                  icon={CheckCircle2}
                  color="emerald"
                  sub={summary.total ? `${Math.round(((summary.by_status?.active || 0) / summary.total) * 100)}% of total` : ''}
                />
                <StatCard label="Expiring ≤30d" value={expiringSoon.length} icon={AlertTriangle} color="amber" />
                <StatCard
                  label="Churned"
                  value={fmt.num((summary.by_status?.cancelled || 0) + (summary.by_status?.expired || 0))}
                  icon={XCircle}
                  color="rose"
                />
              </div>

              {/* Breakdown + Expiring soon */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Plan bars */}
                <Card>
                  <CardHeader title="By Plan" />
                  <div className="space-y-4">
                    {PLAN_ORDER.filter(p => summary.by_plan?.[p]).map(plan => (
                      <PlanBar key={plan} plan={plan} count={summary.by_plan[plan]} total={summary.total} />
                    ))}
                    {Object.keys(summary.by_plan || {}).filter(p => !PLAN_ORDER.includes(p)).map(plan => (
                      <PlanBar key={plan} plan={plan} count={summary.by_plan[plan]} total={summary.total} />
                    ))}
                  </div>
                </Card>

                {/* Status + Provider */}
                <Card>
                  <CardHeader title="By Status" />
                  <div className="space-y-3">
                    {Object.entries(summary.by_status || {}).map(([s, count]) => {
                      const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                      return (
                        <div key={s}>
                          <div className="flex items-center justify-between mb-1">
                            <StatusBadge status={s} />
                            <span className="text-xs font-semibold text-slate-700">{fmt.num(count)} <span className="font-normal text-slate-400">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${STATUS_BAR[s] || 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">By Provider</p>
                    {Object.entries(summary.by_provider || {}).map(([provider, count]) => (
                      <div key={provider} className="flex items-center justify-between py-1">
                        <span className="text-sm text-slate-700 capitalize">{provider || 'Manual'}</span>
                        <span className="text-sm font-semibold text-slate-800">{fmt.num(count)}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Expiring soon */}
                <Card>
                  <CardHeader title={`Expiring Soon (${expiringSoon.length})`} />
                  {expiringSoon.length === 0 ? (
                    <div className="py-6 text-center">
                      <CheckCircle2 size={20} className="mx-auto mb-2 text-emerald-400" />
                      <p className="text-xs text-slate-400">No active subscriptions expiring in 30 days</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {expiringSoon.slice(0, 8).map(s => {
                        const days = daysUntil(s.current_end);
                        return (
                          <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                            <div className="min-w-0">
                              <Link to={`/clinics/${s.clinic_id}`} className="text-xs font-semibold text-slate-800 hover:text-brand-600 truncate block">{s.clinic}</Link>
                              <span className="text-[11px] text-slate-400">{fmt.date(s.current_end)}</span>
                            </div>
                            <span className={`ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${days <= 7 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'}`}>
                              {days}d
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}

          {/* Table */}
          <Card padding={false}>
            <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-semibold text-slate-800">All Subscriptions ({fmt.num(total)})</h3>
              <div className="flex-1" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search clinic…"
                className="h-8 px-2.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400 w-40"
              />
              <FilterSelect value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }}
                options={['active', 'paused', 'cancelled', 'expired']} placeholder="All Statuses" />
              <FilterSelect value={planFilter} onChange={v => { setPlanFilter(v); setPage(1); }}
                options={['free', 'professional', 'enterprise']} placeholder="All Plans" />
            </div>

            {loading ? <Spinner /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[800px]">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Clinic', 'Plan', 'Status', 'Provider', 'Sub ID', 'Start', 'End', ''].map(h => (
                        <th key={h} className="py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map(s => {
                      const days = s.current_end ? daysUntil(s.current_end) : null;
                      const expiring = s.status === 'active' && days !== null && days <= 30 && days > 0;
                      return (
                        <tr key={s.id} className={`hover:bg-slate-50/60 transition-colors ${expiring ? 'bg-amber-50/40' : ''}`}>
                          <td className="py-2.5 px-4">
                            <Link to={`/clinics/${s.clinic_id}`} className="font-medium text-slate-800 hover:text-brand-600 truncate max-w-[160px] block">{s.clinic}</Link>
                          </td>
                          <td className="py-2.5 px-4"><Badge color={PLAN_MAP[s.plan_name] || 'slate'}>{s.plan_name}</Badge></td>
                          <td className="py-2.5 px-4"><StatusBadge status={s.status} /></td>
                          <td className="py-2.5 px-4 text-xs text-slate-500 capitalize">{s.provider || '—'}</td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400 max-w-[130px] truncate">{s.provider_subscription_id || '—'}</td>
                          <td className="py-2.5 px-4 text-xs text-slate-500">{fmt.date(s.current_start)}</td>
                          <td className="py-2.5 px-4 text-xs">
                            {s.current_end ? (
                              <span className={expiring ? (days <= 7 ? 'text-rose-600 font-semibold' : 'text-amber-600 font-medium') : 'text-slate-500'}>
                                {fmt.date(s.current_end)}
                                {expiring && <span className="ml-1 text-[10px]">({days}d)</span>}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-2.5 px-4">
                            <Link to={`/clinics/${s.clinic_id}`} className="flex items-center gap-0.5 text-[11px] font-semibold text-brand-600 hover:text-brand-700">
                              View <ChevronRight size={12} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} className="py-16 text-center text-sm text-slate-400">No subscriptions found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={page} total={total} perPage={LIMIT} onPageChange={setPage} />
          </Card>
        </>
      )}
    </div>
  );
}
