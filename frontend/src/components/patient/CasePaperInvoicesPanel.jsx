import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, FileText, ChevronRight } from 'lucide-react';
import { api } from '../../utils/api';
import { getCurrencySymbol } from '../../utils/currency';
import { formatDate } from '../../utils/datetime';

const STATUS = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  finalized: { label: 'Finalized', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  partially_paid: { label: 'Partial', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  paid_verified: { label: 'Paid', cls: 'bg-green-50 text-green-700 border-green-200' },
  paid_unverified: { label: 'Paid', cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600 border-red-200' },
};

/**
 * CasePaperInvoicesPanel — right-side panel listing every invoice for one case
 * paper (a case paper can carry several), with a button to start a new one.
 */
const CasePaperInvoicesPanel = ({ open, onClose, casePaperId, onNew, onOpen }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const cur = getCurrencySymbol();

  const fetchInvoices = useCallback(async () => {
    if (!casePaperId) { setInvoices([]); return; }
    setLoading(true);
    try {
      const data = await api.get('/invoices', { params: { case_paper_id: casePaperId, limit: 100 } });
      setInvoices(Array.isArray(data) ? data : []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [casePaperId]);

  useEffect(() => { if (open) fetchInvoices(); }, [open, fetchInvoices]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Invoices</h2>
            <p className="text-xs text-gray-500 mt-0.5">All bills for this case paper</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-10">Loading…</p>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm font-medium text-gray-500">No invoices yet</p>
              <p className="text-xs text-gray-400 mt-1">Create one for this visit below.</p>
            </div>
          ) : (
            invoices.map((inv) => {
              const s = STATUS[inv.status] || STATUS.draft;
              const due = Number(inv.due_amount ?? Math.max(0, (inv.total || 0) - (inv.paid_amount || 0)));
              return (
                <button
                  key={inv.id}
                  onClick={() => onOpen(inv.id)}
                  className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-[#2a276e] hover:bg-gray-50 transition-all flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{inv.invoice_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.cls}`}>{s.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(inv.created_at)}</p>
                    <p className="text-sm text-gray-700 mt-1.5">
                      <span className="font-semibold">{cur}{Number(inv.total || 0).toLocaleString('en-IN')}</span>
                      {due > 0 && <span className="text-amber-600"> · {cur}{due.toLocaleString('en-IN')} due</span>}
                      {due <= 0 && (inv.total || 0) > 0 && <span className="text-green-600"> · paid</span>}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
                </button>
              );
            })
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onNew}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm"
          >
            <Plus size={18} /> New invoice
          </button>
        </div>
      </div>
    </div>
  );
};

export default CasePaperInvoicesPanel;
