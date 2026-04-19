import React, { useEffect, useState, useCallback } from 'react';
import { Tag, Search, Plus, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { PageHeader, Card, Badge, Spinner, fmt } from '../components/ui';

export default function MarketingPromos() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: '', discount_percent: '', discount_amount: '', usage_limit: '100', expiry_date: '' });

  const fetchPromos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/marketing/promocodes');
      setPromos(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  const filtered = promos.filter(p => p.code?.toLowerCase().includes(q.toLowerCase()));

  const handleCreate = async () => {
    if (!form.code) {
      toast.error('Code is required');
      return;
    }
    setCreating(true);
    try {
      const payload = { ...form };
      if (payload.discount_percent) payload.discount_percent = Number(payload.discount_percent);
      if (payload.discount_amount) payload.discount_amount = Number(payload.discount_amount);
      payload.usage_limit = Number(payload.usage_limit);
      if (!payload.expiry_date) delete payload.expiry_date;
      
      await api.post('/marketing/promocodes', payload);
      toast.success('Promocode created');
      setDrawerOpen(false);
      setForm({ code: '', discount_percent: '', discount_amount: '', usage_limit: '100', expiry_date: '' });
      fetchPromos();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to create promocode');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id, isActive) => {
    try {
      await api.patch(`/marketing/promocodes/${id}`, { is_active: !isActive });
      setPromos(promos.map(p => p.id === id ? { ...p, is_active: !isActive } : p));
      toast.success(isActive ? 'Promocode deactivated' : 'Promocode activated');
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this promocode?')) return;
    try {
      await api.delete(`/marketing/promocodes/${id}`);
      toast.success('Promocode deleted');
      fetchPromos();
    } catch (e) {
      toast.error('Failed to delete promocode');
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <PageHeader
        title="Promocodes"
        subtitle="Manage discount codes for clinic subscriptions"
        actions={
          <div className="flex items-center gap-3">
             <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search codes..." value={q} onChange={e => setQ(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400 w-52 transition-colors" />
            </div>
            <button 
              onClick={() => setDrawerOpen(true)}
              className="h-8 px-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors">
              <Plus size={14} /> New Code
            </button>
          </div>
        }
      />

      <Card padding={false}>
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Tag size={24} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">No promo codes found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Code', 'Discount', 'Usage', 'Expiry', 'Status', 'Actions'].map(h => (
                    <th key={h} className="py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-800">{p.code}</td>
                    <td className="py-3 px-4">
                      {p.discount_percent ? `${p.discount_percent}%` : fmt.inr(p.discount_amount)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {p.used_count} / {p.usage_limit}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {p.expiry_date ? fmt.date(p.expiry_date) : 'No expiry'}
                    </td>
                    <td className="py-3 px-4">
                       <Badge color={p.is_active ? 'green' : 'slate'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleToggle(p.id, p.is_active)} title={p.is_active ? 'Deactivate' : 'Activate'}
                          className={`p-1 transition-colors ${p.is_active ? 'text-emerald-500 hover:text-slate-400' : 'text-slate-300 hover:text-emerald-500'}`}>
                          {p.is_active ? <ToggleRight size={18}/> : <ToggleLeft size={18}/>}
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/35" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed right-0 top-0 h-full w-full sm:w-[460px] bg-white z-50 border-l border-slate-200 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between z-10">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Promocodes</p>
                <p className="text-sm font-semibold text-slate-900">Create New Promocode</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center text-slate-500">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <Card className="p-4 space-y-3">
                <div>
                   <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-2">Code *</label>
                   <input value={form.code} onChange={(e) => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="e.g. SUMMER10" className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-2">Discount %</label>
                     <input type="number" value={form.discount_percent} onChange={(e) => setForm({...form, discount_percent: e.target.value})} placeholder="10" className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                   </div>
                   <div>
                     <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-2">Flat Discount (INR)</label>
                     <input type="number" value={form.discount_amount} onChange={(e) => setForm({...form, discount_amount: e.target.value})} placeholder="500" className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-2">Usage Limit</label>
                     <input type="number" value={form.usage_limit} onChange={(e) => setForm({...form, usage_limit: e.target.value})} placeholder="100" className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                   </div>
                   <div>
                     <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-2">Expiry Date</label>
                     <input type="date" value={form.expiry_date} onChange={(e) => setForm({...form, expiry_date: e.target.value})} className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-700" />
                   </div>
                </div>

                <div className="flex items-center gap-2 mt-6">
                  <button onClick={() => setDrawerOpen(false)} className="flex-1 h-9 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200">Cancel</button>
                  <button onClick={handleCreate} disabled={creating} className="flex-1 h-9 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 inline-flex items-center justify-center gap-1">
                    <Plus size={14} /> {creating ? 'Creating...' : 'Create Promo'}
                  </button>
                </div>
              </Card>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
