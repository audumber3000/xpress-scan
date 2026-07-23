import React, { useState, useMemo } from "react";
import { X, Wallet } from "lucide-react";
import { toast } from "react-toastify";
import { getCurrencySymbol } from "../../utils/currency";
import { clinicToday, formatDate } from "../../utils/datetime";
import GearLoader from "../GearLoader";

/**
 * Record a payment against an invoice.
 *
 * This is where money gets entered — the schedule inside the invoice is a
 * read-only history. Two decisions drive the form: how much (the whole balance
 * or part of it) and when it was received. The date defaults to today but can
 * be moved back for cash taken earlier, which is normal in a clinic and needs
 * to be said out loud rather than silently assumed.
 */
const MODES = ["Cash", "UPI", "Card", "Net Banking", "Cheque"];
// Modes where a reference number is worth capturing. Cash has none.
const REF_MODES = ["UPI", "Card", "Net Banking", "Cheque"];

const MarkAsPaidModal = ({ invoice, onClose, onConfirm }) => {
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [utr, setUtr] = useState("");
  const [isPartial, setIsPartial] = useState(false);
  const [amountPaid, setAmountPaid] = useState("");
  const [paidOn, setPaidOn] = useState(clinicToday());
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const currency = getCurrencySymbol();
  const total = Number(invoice?.total || 0);
  const alreadyPaid = Number(invoice?.paid_amount || 0);
  const dueAmount = Math.max(0, Number(invoice?.due_amount ?? (total - alreadyPaid)));

  const money = (n) =>
    `${currency}${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const parsedAmount = Number(amountPaid || 0);
  const payingNow = isPartial ? parsedAmount : dueAmount;
  const balanceAfter = useMemo(
    () => Math.max(0, dueAmount - (Number.isFinite(payingNow) ? payingNow : 0)),
    [dueAmount, payingNow]
  );
  const isBackDated = paidOn < clinicToday();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!paymentMode) {
      toast.error("Please select a payment mode");
      return;
    }
    if (isPartial) {
      if (!parsedAmount || parsedAmount <= 0) {
        toast.error("Enter a valid part payment amount");
        return;
      }
      if (parsedAmount >= dueAmount) {
        toast.error(`A part payment must be less than the balance of ${money(dueAmount)}`);
        return;
      }
    }

    setLoading(true);
    try {
      await onConfirm({
        payment_mode: paymentMode,
        utr: utr.trim() || null,
        is_partial: isPartial,
        amount_paid: isPartial ? parsedAmount : null,
        paid_on: paidOn || null,
        note: note.trim() || null,
      });
      onClose();
    } catch (error) {
      console.error("Error recording the payment:", error);
    } finally {
      setLoading(false);
    }
  };

  const fieldCls =
    "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:bg-white focus:ring-2 focus:ring-[#2a276e]/20 transition-colors";
  const labelCls = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => !loading && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <Wallet size={18} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Record payment</h2>
              <p className="text-xs text-gray-500">{invoice?.invoice_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition disabled:opacity-40"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Where the invoice stands, before anything is entered */}
        <div className="px-6 py-3 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Billed</p>
            <p className="font-semibold text-gray-900">{money(total)}</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Paid</p>
            <p className="font-semibold text-green-600">{money(alreadyPaid)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Balance</p>
            <p className="font-semibold text-amber-600">{money(dueAmount)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Full or part — a segmented control, not a checkbox buried in a box */}
          <div>
            <label className={labelCls}>How much</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPartial(false)}
                className={`px-3 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                  !isPartial
                    ? "border-[#2a276e] bg-[#2a276e]/[0.05] text-[#2a276e]"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                Full balance
                <span className="block text-xs font-normal text-gray-400 mt-0.5">{money(dueAmount)}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPartial(true)}
                className={`px-3 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                  isPartial
                    ? "border-[#2a276e] bg-[#2a276e]/[0.05] text-[#2a276e]"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                Part payment
                <span className="block text-xs font-normal text-gray-400 mt-0.5">Enter an amount</span>
              </button>
            </div>
          </div>

          {isPartial && (
            <div>
              <label className={labelCls}>Amount received</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-sm text-gray-400 pointer-events-none">
                  {currency}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className={`${fieldCls} pl-8 text-right`}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Must be less than the balance of {money(dueAmount)}.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Payment date</label>
              <input
                type="date"
                value={paidOn}
                max={clinicToday()}
                onChange={(e) => setPaidOn(e.target.value || clinicToday())}
                className={fieldCls}
              />
            </div>
            <div>
              <label className={labelCls}>Method</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className={fieldCls}>
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Money received earlier than today still belongs to its own day */}
          {isBackDated && (
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
              <p className="text-xs text-amber-800">
                This will count towards <span className="font-semibold">{formatDate(paidOn)}</span>,
                not today. We'll note that you entered it today.
              </p>
            </div>
          )}

          {/* A reference number only makes sense for non-cash */}
          {REF_MODES.includes(paymentMode) && (
            <div>
              <label className={labelCls}>Reference / UTR</label>
              <input
                type="text"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="Optional, but worth keeping for online payments"
                className={fieldCls}
              />
            </div>
          )}

          <div>
            <label className={labelCls}>Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
              className={fieldCls}
            />
          </div>
        </form>

        {/* What this payment does to the invoice, stated before you commit */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Paying <span className="font-semibold text-gray-900">{money(payingNow)}</span>
          </span>
          <span className={balanceAfter > 0 ? "text-amber-600 font-semibold" : "text-green-600 font-semibold"}>
            {balanceAfter > 0 ? `${money(balanceAfter)} will remain` : "Invoice will be settled"}
          </span>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <GearLoader size="w-4 h-4" />}
            {loading ? "Recording..." : "Record payment"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarkAsPaidModal;
