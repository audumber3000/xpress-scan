import React, { useEffect, useState, useCallback } from 'react';
import { Share2, Search, Plus, Trash2, Edit2, X, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { PageHeader, Card, Badge, Spinner, fmt } from '../components/ui';

export default function MarketingReferrals() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: '', creator_name: '', discount_percent: '' });

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/marketing/referrals');
      setReferrals(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const filtered = referrals.filter(r => 
    r.code?.toLowerCase().includes(q.toLowerCase()) || 
    r.creator_name?.toLowerCase().includes(q.toLowerCase())
  );

  const handleCreate = async () => {
    if (!form.creator_name) {
      toast.error('Creator name is required');
      return;
    }
    setCreating(true);
    try {
      const payload = { ...form };
      if (!payload.code) delete payload.code; // let backend auto-generate
      if (payload.discount_percent) payload.discount_percent = Number(payload.discount_percent);
      else delete payload.discount_percent;

      await api.post('/marketing/referrals', payload);
      toast.success('Referral created');
      setDrawerOpen(false);
      setForm({ code: '', creator_name: '', discount_percent: '' });
      fetchReferrals();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to create referral');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this referral?')) return;
    try {
      await api.delete(`/marketing/referrals/${id}`);
      toast.success('Referral deleted');
      fetchReferrals();
    } catch (e) {
      toast.error('Failed to delete referral');
    }
  };

  const handleCopy = (code) => {
    const link = `https://app.molarplus.com/signup?ref=${code}`;
    navigator.clipboard.writeText(link);
    toast.success('Signup link copied to clipboard');
  };

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <PageHeader
        title="Referral Manager"
        subtitle="Manage affiliate and content creator referral codes"
        actions={
          <div className="flex items-center gap-3">
             <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search..." value={q} onChange={e => setQ(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400 w-52 transition-colors" />
            </div>
            <button 
              onClick={() => setDrawerOpen(true)}
              className="h-8 px-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors">
              <Plus size={14} /> New Referral
            </button>
          </div>
        }
      />

      <Card padding={false}>
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Share2 size={24} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">No referral codes found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Code', 'Creator', 'Discount', 'Signups', 'Status', 'Created', 'Actions'].map(h => (
                    <th key={h} className="py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-brand-600">{r.code}</span>
                        <button onClick={() => handleCopy(r.code)} className="p-1 text-slate-400 hover:text-brand-600 transition-colors" title="Copy Signup Link">
                           <Copy size={13} />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-800">{r.creator_name}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {r.discount_percent ? `${r.discount_percent}%` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge color="violet">{r.signup_count || 0} Signups</Badge>
                    </td>
                    <td className="py-3 px-4">
                       <Badge color={r.is_active ? 'green' : 'slate'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {fmt.date(r.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                         <button className="p-1 text-slate-400 hover:text-brand-600 cursor-not-allowed" title="Edit coming soon"><Edit2 size={14}/></button>
                         <button onClick={() => handleDelete(r.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
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
                <p className="text-xs text-slate-400 uppercase tracking-wide">Referrals</p>
                <p className="text-sm font-semibold text-slate-900">Create New Referral</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center text-slate-500">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <Card className="p-4 space-y-3">
                <div>
                   <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-2">Creator Name *</label>
                   <input value={form.creator_name} onChange={(e) => setForm({...form, creator_name: e.target.value})} placeholder="e.g. Dr. Jane (Instagram)" className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                </div>
                <div>
                   <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-2">Specific Code (Optional)</label>
                   <input value={form.code} onChange={(e) => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="Leave blank to auto-generate" className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                </div>
                <div>
                   <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-2">Discount given to clinic % (Optional)</label>
                   <input type="number" value={form.discount_percent} onChange={(e) => setForm({...form, discount_percent: e.target.value})} placeholder="10" className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50" />
                </div>

                <div className="flex items-center gap-2 mt-6">
                  <button onClick={() => setDrawerOpen(false)} className="flex-1 h-9 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200">Cancel</button>
                  <button onClick={handleCreate} disabled={creating} className="flex-1 h-9 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 inline-flex items-center justify-center gap-1">
                    <Plus size={14} /> {creating ? 'Creating...' : 'Create Referral'}
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
