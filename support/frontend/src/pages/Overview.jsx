import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Users, CalendarDays, Receipt, Ticket,
  TrendingUp, AlertCircle, CheckCircle2, Clock, ChevronRight
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import api from '../utils/api';
import { PageHeader, StatCard, Card, CardHeader, Badge, Spinner, fmt } from '../components/ui';

const PRIORITY_MAP = { urgent: 'rose', high: 'amber', normal: 'sky', low: 'slate' };
const CHART_TOOLTIP = { contentStyle: { borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 } };

export default function Overview() {
  const [overview, setOverview] = useState(null);
  const [growth, setGrowth] = useState([]);
  const [activity, setActivity] = useState([]);
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [ov, gr, ac, tk] = await Promise.all([
          api.get('/metrics/overview'),
          api.get('/metrics/growth'),
          api.get('/metrics/activity'),
          api.get('/tickets?status=open&limit=5'),
        ]);
        setOverview(ov);
        setGrowth(gr.weekly || []);
        setActivity((ac.daily || []).slice(-14));
        setRecentTickets(tk.tickets || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <Spinner />;

  const c = overview?.clinics || {};
  const t = overview?.tickets || {};

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      <PageHeader title="Overview" subtitle="Platform snapshot across all clinics" />

      {/* Clinic KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Clinics" value={c.total ?? '—'} sub={`+${c.new_this_month ?? 0} this month`} icon={Building2} color="brand" />
        <StatCard label="Active" value={c.active ?? '—'} icon={CheckCircle2} color="emerald" />
        <StatCard label="Paid Plans" value={c.paid ?? '—'} sub={`${c.free ?? 0} free`} icon={TrendingUp} color="sky" />
        <StatCard label="Suspended" value={c.suspended ?? '—'} icon={AlertCircle} color="rose" />
      </div>

      {/* Platform KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Patients" value={fmt.num(overview?.patients?.total)} icon={Users} color="violet" />
        <StatCard label="Appointments" value={fmt.num(overview?.appointments?.total)} icon={CalendarDays} color="emerald" />
        <StatCard label="Invoices" value={fmt.num(overview?.invoices?.total)} icon={Receipt} color="amber" />
        <StatCard label="Revenue" value={fmt.inr(overview?.invoices?.total_revenue)} icon={TrendingUp} color="brand" />
      </div>

      {/* Ticket KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Open Tickets" value={t.open ?? 0} icon={Ticket} color="amber" />
        <StatCard label="In Progress" value={t.in_progress ?? 0} icon={Clock} color="sky" />
        <StatCard label="Resolved Today" value={t.resolved_today ?? 0} icon={CheckCircle2} color="emerald" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="New Clinics / Week" />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={growth} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP} />
              <Bar dataKey="new_clinics" name="Clinics" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader title="Activity — Last 14 Days" />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={activity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP} />
              <Line type="monotone" dataKey="appointments" stroke="#4f46e5" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="invoices" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent open tickets */}
      {recentTickets.length > 0 && (
        <Card padding={false}>
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Open Tickets</h3>
            <Link to="/tickets" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-0.5">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentTickets.map(tk => (
              <Link key={tk.id} to={`/tickets/${tk.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{tk.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{tk.clinic_name} · {tk.category}</p>
                </div>
                <Badge color={PRIORITY_MAP[tk.priority] || 'slate'}>{tk.priority}</Badge>
                <span className="text-xs text-slate-400 whitespace-nowrap">{fmt.date(tk.created_at)}</span>
                <ChevronRight size={14} className="text-slate-300" />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
