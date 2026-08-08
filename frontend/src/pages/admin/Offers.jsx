import React, { useCallback, useEffect, useState } from 'react';
import {
  Tag, Plus, Pencil, Trash2, Loader2, X, Percent, BadgeIndianRupee, Calendar,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../utils/api';
import { getCurrencySymbol } from '../../utils/currency';

/**
 * Offers & Discounts — a clinic-defined catalogue of reusable whole-invoice
 * offers. Created here, applied in billing (the invoice's "Apply offer"
 * selector reads /offers/active and resolves via /offers/validate).
 */

const cur = () => getCurrencySymbol();

const emptyForm = () => ({
  name: '',
  code: '',
  discount_type: 'percentage',
  value: '',
  valid_from: '',
  valid_to: '',
  min_invoice_amount: '',
  is_active: true,
});

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null);

const windowLabel = (o) => {
  const from = fmtDate(o.valid_from);
  const to = fmtDate(o.valid_to);
  if (from && to) return `${from} – ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return 'No expiry';
};

const isLive = (o) => {
  if (!o.is_active) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (o.valid_from && today < o.valid_from) return false;
  if (o.valid_to && today > o.valid_to) return false;
  return true;
};

const Offers = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // offer being edited, or null for new
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/offers');
      setOffers(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Could not load offers');
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (o) => {
    setEditing(o);
    setForm({
      name: o.name || '',
      code: o.code || '',
      discount_type: o.discount_type || 'percentage',
      value: o.value ?? '',
      valid_from: o.valid_from || '',
      valid_to: o.valid_to || '',
      min_invoice_amount: o.min_invoice_amount ?? '',
      is_active: o.is_active !== false,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Give the offer a name'); return; }
    const value = Number(form.value);
    if (!(value >= 0)) { toast.error('Enter a valid discount value'); return; }
    if (form.discount_type === 'percentage' && value > 100) { toast.error("A percentage can't exceed 100%"); return; }
    if (form.valid_from && form.valid_to && form.valid_to < form.valid_from) {
      toast.error("'Valid to' can't be before 'valid from'"); return;
    }
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      discount_type: form.discount_type,
      value,
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
      min_invoice_amount: form.min_invoice_amount === '' ? null : Number(form.min_invoice_amount),
      is_active: form.is_active,
    };
    setSaving(true);
    try {
      if (editing) await api.put(`/offers/${editing.id}`, payload);
      else await api.post('/offers', payload);
      toast.success(editing ? 'Offer updated' : 'Offer created');
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || 'Could not save the offer');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (o) => {
    try {
      await api.put(`/offers/${o.id}`, { is_active: !o.is_active });
      setOffers((prev) => prev.map((x) => (x.id === o.id ? { ...x, is_active: !o.is_active } : x)));
    } catch (e) {
      toast.error('Could not update the offer');
    }
  };

  const remove = async (o) => {
    if (!window.confirm(`Delete the offer "${o.name}"? This can't be undone.`)) return;
    try {
      await api.delete(`/offers/${o.id}`);
      setOffers((prev) => prev.filter((x) => x.id !== o.id));
      toast.success('Offer deleted');
    } catch (e) {
      toast.error('Could not delete the offer');
    }
  };

  const discountLabel = (o) =>
    o.discount_type === 'percentage' ? `${o.value}% off` : `${cur()}${o.value} off`;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Tag size={20} className="text-[#29828a]" /> Offers &amp; Discounts
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Create discounts you can apply to any bill.</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-[#29828a] hover:bg-[#1f6b72] text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus size={16} /> New offer
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
      ) : offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl bg-white/60 h-64 gap-3">
          <Tag size={28} className="text-gray-300" />
          <p className="text-gray-400 text-sm">No offers yet. Create your first discount.</p>
          <button onClick={openNew} className="text-[#29828a] text-sm font-semibold hover:underline">+ New offer</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {offers.map((o) => (
            <div key={o.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 truncate">{o.name}</h3>
                    {o.code && <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{o.code}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[#29828a] font-bold">
                    {o.discount_type === 'percentage' ? <Percent size={14} /> : <BadgeIndianRupee size={14} />}
                    <span>{discountLabel(o)}</span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                  isLive(o) ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  : o.is_active ? 'bg-amber-50 text-amber-600 border border-amber-100'
                  : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}>
                  {isLive(o) ? 'Live' : o.is_active ? 'Scheduled/Expired' : 'Inactive'}
                </span>
              </div>

              <div className="mt-3 space-y-1 text-xs text-gray-500">
                <div className="flex items-center gap-1.5"><Calendar size={12} /> {windowLabel(o)}</div>
                {o.min_invoice_amount ? <div>Min bill: {cur()}{o.min_invoice_amount}</div> : null}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-2">
                <button onClick={() => openEdit(o)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => toggleActive(o)} className="px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  {o.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => remove(o)} className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-500 border border-red-100 rounded-lg hover:bg-red-50">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[1px] p-4" onClick={() => !saving && setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{editing ? 'Edit offer' : 'New offer'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Offer name">
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diwali 10% off" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Discount type">
                  <select className={inputCls} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="amount">Flat amount ({cur()})</option>
                  </select>
                </Field>
                <Field label={form.discount_type === 'percentage' ? 'Percent off' : `Amount off (${cur()})`}>
                  <input type="number" min="0" className={inputCls} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.discount_type === 'percentage' ? '10' : '200'} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valid from"><input type="date" className={inputCls} value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} /></Field>
                <Field label="Valid to"><input type="date" className={inputCls} value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Code (optional)"><input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="DIWALI10" /></Field>
                <Field label={`Min bill (${cur()}, optional)`}><input type="number" min="0" className={inputCls} value={form.min_invoice_amount} onChange={(e) => setForm({ ...form, min_invoice_amount: e.target.value })} placeholder="0" /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded border-gray-300 text-[#29828a] focus:ring-[#29828a]/20" />
                Active
              </label>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-[#29828a] hover:bg-[#1f6b72] disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {editing ? 'Save changes' : 'Create offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const inputCls = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#29828a]/20 focus:border-[#29828a] outline-none transition-all';

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
    {children}
  </div>
);

export default Offers;
