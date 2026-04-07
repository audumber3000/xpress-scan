import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { IndianRupee, Receipt, TrendingUp, AlertCircle } from 'lucide-react';
import api from '../utils/api';
import { PageHeader, StatCard, Card, CardHeader, StatusBadge, DataTable, Pagination, FilterSelect, Spinner, fmt } from '../components/ui';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PIE_COLORS = ['#4f46e5','#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6'];
const CHART_TOOLTIP = { contentStyle: { borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 } };

const INV_COLUMNS = [
  { key: 'invoice_number', label: 'Invoice #', render: r => <span className="font-mono text-xs text-slate-500">{r.invoice_number}</span> },
  { key: 'clinic', label: 'Clinic', render: r => <span className="font-medium text-slate-800 truncate max-w-[160px] block">{r.clinic}</span> },
  { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
  { key: 'payment_mode', label: 'Mode', render: r => <span className="text-xs text-slate-500">{r.payment_mode || '—'}</span> },
  { key: 'total', label: 'Total', render: r => <span className="font-semibold text-slate-900">{fmt.inr(r.total)}</span> },
  { key: 'paid_amount', label: 'Paid', render: r => <span className="text-emerald-600 font-medium">{fmt.inr(r.paid_amount)}</span> },
  { key: 'due_amount', label: 'Due', render: r => <span className="text-amber-600 font-medium">{fmt.inr(r.due_amount)}</span> },
  { key: 'created_at', label: 'Date', render: r => <span className="text-xs text-slate-400">{fmt.date(r.created_at)}</span> },
];

export default function Financials() {
  const [summary, setSummary] = useState(null);
  const [revenueChart, setRevenueChart] = useState([]);
  const [byClinic, setByClinic] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, c, inv] = await Promise.all([
        api.get('/financials/summary'),
        api.get('/financials/revenue-over-time?months=12'),
        api.get('/financials/by-clinic?limit=10'),
        api.get(`/financials/invoices?page=${page}&per_page=50${statusFilter ? `&status=${statusFilter}` : ''}${modeFilter ? `&payment_mode=${modeFilter}` : ''}`),
      ]);
      setSummary(s);
      setRevenueChart(r.map(x => ({ name: `${MONTHS[x.month - 1]} ${x.year}`, revenue: x.revenue })));
      setByClinic(c);
      setInvoices(inv.invoices);
      setTotal(inv.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, statusFilter, modeFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      <PageHeader title="Financials" subtitle="Revenue, invoices, and payment data" />

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Revenue" value={fmt.inr(summary.total_revenue)} icon={IndianRupee} color="brand" />
          <StatCard label="Paid Invoices" value={fmt.num(summary.paid_invoices)} sub={`of ${fmt.num(summary.total_invoices)} total`} icon={Receipt} color="emerald" />
          <StatCard label="Avg Invoice" value={fmt.inr(summary.avg_invoice)} icon={TrendingUp} color="sky" />
          <StatCard label="Pending" value={fmt.inr(summary.pending_amount)} icon={AlertCircle} color="amber" />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Revenue Over Time" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueChart} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip {...CHART_TOOLTIP} formatter={v => fmt.inr(v)} />
              <Bar dataKey="revenue" fill="#4f46e5" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader title="Payment Methods" />
          {summary?.payment_methods?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={summary.payment_methods} dataKey="amount" nameKey="mode" cx="50%" cy="50%" outerRadius={70}
                  label={({ mode, percent }) => `${mode} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {summary.payment_methods.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt.inr(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-40 text-slate-300 text-sm">No data</div>}
        </Card>
      </div>

      {/* Top clinics */}
      {byClinic.length > 0 && (
        <Card>
          <CardHeader title="Top Clinics by Revenue" />
          <div className="space-y-2.5">
            {byClinic.map((c, i) => (
              <div key={c.clinic_id} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-slate-400 text-right">{i + 1}</span>
                <span className="text-sm font-medium text-slate-800 flex-1 truncate">{c.clinic}</span>
                <span className="text-xs text-slate-400">{c.count} inv</span>
                <span className="text-sm font-semibold text-brand-700 w-24 text-right">{fmt.inr(c.revenue)}</span>
                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${byClinic[0]?.revenue ? (c.revenue / byClinic[0].revenue) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Invoice table */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-800 flex-1">Invoices ({fmt.num(total)})</h3>
          <FilterSelect value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }}
            options={['draft','finalized','partially_paid','paid_unverified','paid_verified','cancelled'].map(s => ({ value: s, label: s.replace(/_/g,' ') }))} placeholder="All Statuses" />
          <FilterSelect value={modeFilter} onChange={v => { setModeFilter(v); setPage(1); }}
            options={['UPI','Cash','Card','Cheque','Online']} placeholder="All Modes" />
        </div>
        <DataTable columns={INV_COLUMNS} data={invoices} loading={loading} emptyIcon={Receipt} emptyText="No invoices found" />
        <Pagination page={page} total={total} perPage={50} onPageChange={setPage} />
      </Card>
    </div>
  );
}
