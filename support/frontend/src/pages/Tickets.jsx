import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Ticket, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import { PageHeader, Card, Badge, StatusBadge, Pagination, Spinner, fmt } from '../components/ui';

const PRIORITY_MAP = { urgent: 'rose', high: 'amber', normal: 'sky', low: 'slate' };
const STATUSES = ['all', 'open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['all', 'urgent', 'high', 'normal', 'low'];
const CATEGORIES = ['all', 'billing', 'setup', 'bug', 'feature', 'other'];

function SegCtrl({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium text-slate-400">{label}</span>
      <div className="flex bg-slate-100 p-0.5 rounded-lg">
        {options.map(o => (
          <button key={o} onClick={() => onChange(o)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md capitalize transition-all ${
              value === o ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>{o.replace('_', ' ')}</button>
        ))}
      </div>
    </div>
  );
}

export default function Tickets() {
  const [searchParams] = useSearchParams();
  const preClinicId = parseInt(searchParams.get('clinic_id') || '0');

  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [clinicId] = useState(preClinicId);
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (clinicId) params.set('clinic_id', clinicId);
      const res = await api.get(`/tickets?${params}`);
      setTickets(res.tickets || []);
      setTotal(res.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [statusFilter, priorityFilter, categoryFilter, clinicId, page]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { setPage(1); }, [statusFilter, priorityFilter, categoryFilter]);

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <PageHeader title="Tickets" subtitle={`${fmt.num(total)} support tickets`} />

      <div className="flex flex-wrap gap-3">
        <SegCtrl label="Status" options={STATUSES} value={statusFilter} onChange={setStatusFilter} />
        <SegCtrl label="Priority" options={PRIORITIES} value={priorityFilter} onChange={setPriorityFilter} />
        <SegCtrl label="Category" options={CATEGORIES} value={categoryFilter} onChange={setCategoryFilter} />
      </div>

      <Card padding={false}>
        {loading ? <Spinner /> : tickets.length === 0 ? (
          <div className="py-20 text-center">
            <Ticket size={24} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">No tickets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Clinic', 'Title', 'Category', 'Priority', 'Status', 'Created', 'Last Reply', ''].map(h => (
                    <th key={h} className="py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tickets.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-slate-700">{t.clinic_name}</td>
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-slate-800 max-w-[200px] truncate">{t.title}</p>
                      <p className="text-[11px] text-slate-400">{t.message_count} msg{t.message_count !== 1 ? 's' : ''}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 capitalize">{t.category}</td>
                    <td className="py-3 px-4"><Badge color={PRIORITY_MAP[t.priority] || 'slate'}>{t.priority}</Badge></td>
                    <td className="py-3 px-4"><StatusBadge status={t.status} /></td>
                    <td className="py-3 px-4 text-xs text-slate-400">{fmt.date(t.created_at)}</td>
                    <td className="py-3 px-4 text-xs">
                      {t.last_reply_at ? (
                        <span className={t.last_reply_is_staff ? 'text-emerald-600' : 'text-amber-600'}>
                          {fmt.date(t.last_reply_at)} · {t.last_reply_is_staff ? 'staff' : 'clinic'}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <Link to={`/tickets/${t.id}`} className="flex items-center gap-0.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
                        Open <ChevronRight size={13} />
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
    </div>
  );
}
