import React, { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { api } from '../../../utils/api';
import { notify } from '../../../utils/notify';
import { getCurrencySymbol } from '../../../utils/currency';
import { invoiceMoney } from './invoiceStatus';
import { useAuth } from '../../../contexts/AuthContext';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Row = ({ label, value, valueClass = 'text-gray-900', labelClass = 'text-gray-600' }) => (
  <div className="flex justify-between items-baseline text-[13px]">
    <span className={labelClass}>{label}</span>
    <span className={`font-medium tabular-nums ${valueClass}`}>{value}</span>
  </div>
);

/**
 * Subtotal down to what is still owed.
 *
 * The stack used to stop at Total, so a part-paid bill never said anywhere in
 * the left column what the patient still owes — the one figure the drawer
 * exists to answer. Paid and Balance Due close that, and Balance Due carries
 * the only tinted row because it is the number somebody is about to act on.
 *
 * Total was painted #25D366 — WhatsApp green, on a figure that is not a success
 * state. It is plain now; the green belongs to money actually collected.
 *
 * The discount editor and the offer picker moved in with the stack rather than
 * staying behind as props: both only ever read the invoice and call
 * onUpdateInvoice, so they are self-contained here.
 */
const InvoiceTotals = ({ invoice, canEdit, onUpdateInvoice }) => {
  const { user } = useAuth();
  const [localDiscount, setLocalDiscount] = useState(invoice?.discount || 0);
  const [localDiscountType, setLocalDiscountType] = useState(invoice?.discount_type || 'amount');
  const [editing, setEditing] = useState(false);
  const [taxEditing, setTaxEditing] = useState(false);
  const [localRate, setLocalRate] = useState(invoice?.tax_rate ?? '');
  const [activeOffers, setActiveOffers] = useState([]);

  useEffect(() => {
    if (!canEdit) return;
    api.get('/offers/active').then((d) => setActiveOffers(Array.isArray(d) ? d : [])).catch(() => {});
  }, [canEdit]);

  if (!invoice) return null;

  const isDraft = invoice.status === 'draft';
  const { total, paid, due } = invoiceMoney(invoice);
  const showsCollection = !isDraft;

  // The clinic's own word for it, so an Indian bill says GST and a British one
  // says VAT. tax_label already exists on the clinic and the PDF already uses
  // it; the screen was the only place still saying "GST" to everybody.
  const taxLabel = (user?.clinic?.tax_label || 'Tax').replace(/\s*No\.?$/i, '').trim() || 'Tax';
  const rate = invoice.tax_rate;

  const applyTax = () => {
    // Blank clears the rate rather than setting 0: "not configured" and
    // "deliberately zero-rated" are different answers on a bill.
    const v = localRate === '' ? null : Math.max(0, Math.min(100, parseFloat(localRate) || 0));
    onUpdateInvoice({ tax_rate: v });
    setTaxEditing(false);
  };

  const applyDiscount = () => {
    onUpdateInvoice({ discount: parseFloat(localDiscount) || 0, discount_type: localDiscountType });
    setEditing(false);
  };

  const applyOffer = async (offerId) => {
    if (!offerId) return;
    try {
      const res = await api.post('/offers/validate', {
        offer_id: Number(offerId),
        subtotal: Number(invoice?.subtotal || 0),
      });
      if (!res?.valid) { notify.problem(res?.reason || "This offer can't be applied to this bill."); return; }
      setLocalDiscount(res.discount);
      setLocalDiscountType(res.discount_type);
      onUpdateInvoice({ discount: res.discount, discount_type: res.discount_type, applied_offer_id: Number(offerId) });
      notify.done('Offer applied');
    } catch {
      notify.problem('Could not apply the offer');
    }
  };

  const offerSuffix = invoice.applied_offer_name ? ` (${invoice.applied_offer_name})` : '';

  return (
    <div className="w-full sm:w-[280px] sm:ml-auto">
      <div className="flex flex-col gap-1.5">
        <Row label="Subtotal" value={money(invoice.subtotal)} />

        {canEdit && activeOffers.length > 0 && (
          <div className="flex items-center justify-between gap-2 py-0.5">
            <span className="text-[13px] text-gray-600">Apply offer</span>
            <select
              value=""
              onChange={(e) => applyOffer(e.target.value)}
              className="text-[11px] border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-700 outline-none focus:border-[#2a276e] max-w-[55%]"
            >
              <option value="">Choose an offer…</option>
              {activeOffers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} — {o.discount_type === 'percentage' ? `${o.value}%` : `${getCurrencySymbol()}${o.value}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {canEdit ? (
          <div className="flex items-center justify-between gap-2 group text-[13px]">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-gray-600 hover:text-[#2a276e]"
            >
              Discount{offerSuffix}
              {!editing && <Pencil size={11} className="opacity-0 group-hover:opacity-100 transition" />}
            </button>

            {editing ? (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-gray-100 rounded p-0.5 border border-gray-200">
                  <button type="button" onClick={() => setLocalDiscountType('percentage')} className={`px-1.5 py-0.5 text-[11px] font-semibold rounded ${localDiscountType === 'percentage' ? 'bg-white text-[#2a276e]' : 'text-gray-500'}`}>%</button>
                  <button type="button" onClick={() => setLocalDiscountType('amount')} className={`px-1.5 py-0.5 text-[11px] font-semibold rounded ${localDiscountType === 'amount' ? 'bg-white text-[#2a276e]' : 'text-gray-500'}`}>{getCurrencySymbol()}</button>
                </div>
                <input
                  type="number"
                  min="0"
                  value={localDiscount}
                  onChange={(e) => setLocalDiscount(e.target.value)}
                  autoFocus
                  className="w-14 px-1.5 py-1 text-[12px] border border-gray-300 rounded outline-none focus:border-[#2a276e] text-right"
                />
                <button type="button" onClick={applyDiscount} className="text-[11px] bg-[#2a276e] text-white font-semibold px-2 py-1 rounded hover:bg-[#1e1c4f] transition">Apply</button>
              </div>
            ) : (
              <button type="button" onClick={() => setEditing(true)} className="font-medium text-red-600 tabular-nums hover:underline">
                - {money(invoice.discount_amount)}
              </button>
            )}
          </div>
        ) : (
          Number(invoice.discount_amount || 0) > 0 && (
            <>
              <Row label={`Discount${offerSuffix}`} value={`- ${money(invoice.discount_amount)}`} valueClass="text-red-600" />
              {Number(invoice.post_issue_discount_total || 0) > 0 && (
                <div className="flex justify-between text-[11px] text-gray-400 -mt-1">
                  <span>incl. after issue</span>
                  <span className="tabular-nums">{money(invoice.post_issue_discount_total)}</span>
                </div>
              )}
            </>
          )
        )}

        {/* The label was hardcoded to "Tax (GST 0%)" and the amount was always
            zero, because nothing ever computed one. The rate is per invoice and
            editable here the same way the discount is, and it uses the clinic's
            own word for it — GST in India, VAT elsewhere. */}
        {canEdit ? (
          <div className="flex items-center justify-between gap-2 group text-[13px]">
            <button
              type="button"
              onClick={() => setTaxEditing(true)}
              className="flex items-center gap-1 text-gray-600 hover:text-[#2a276e]"
            >
              {taxLabel}{rate ? ` ${rate}%` : ''}
              {!taxEditing && <Pencil size={11} className="opacity-0 group-hover:opacity-100 transition" />}
            </button>

            {taxEditing ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  autoFocus
                  value={localRate}
                  onChange={(e) => setLocalRate(e.target.value)}
                  className="w-16 px-1.5 py-1 text-[12px] border border-gray-300 rounded outline-none focus:border-[#2a276e] text-right"
                />
                <span className="text-[12px] text-gray-400">%</span>
                <button
                  type="button"
                  onClick={applyTax}
                  className="text-[11px] bg-[#2a276e] text-white font-semibold px-2 py-1 rounded hover:bg-[#1e1c4f] transition"
                >
                  Apply
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTaxEditing(true)}
                className="font-medium text-gray-900 tabular-nums hover:underline"
              >
                {money(invoice.tax)}
              </button>
            )}
          </div>
        ) : (
          <Row label={`${taxLabel}${rate ? ` ${rate}%` : ''}`} value={money(invoice.tax)} />
        )}

        <div className="flex justify-between items-baseline border-t border-gray-200 pt-2 mt-1">
          <span className="text-[13px] font-semibold text-gray-900">Total amount</span>
          <span className="text-[15px] font-bold text-gray-900 tabular-nums">{money(total)}</span>
        </div>

        {showsCollection && (
          <Row label="Paid" value={money(paid)} valueClass="text-emerald-600" />
        )}

        {showsCollection && (
          <div className={`mt-1.5 flex justify-between items-baseline rounded-lg px-3 py-2.5 border ${
            due > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
          }`}>
            <span className={`text-[13px] font-bold ${due > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
              {due > 0 ? 'Balance due' : 'Fully settled'}
            </span>
            <span className={`text-[15px] font-bold tabular-nums ${due > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {money(due)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceTotals;
