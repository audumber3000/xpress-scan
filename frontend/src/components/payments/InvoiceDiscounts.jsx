import React, { useState } from "react";
import { Trash2, TicketPercent } from "lucide-react";
import { getCurrencySymbol } from "../../utils/currency";
import { formatDateTime } from "../../utils/datetime";
import GearLoader from "../GearLoader";

/**
 * Discounts granted after an invoice was issued.
 *
 * Draft invoices edit their discount inline in the totals row (see
 * InvoiceLineItems) — nothing has been handed to the patient yet. Once the bill
 * is finalized or part-paid, a concession is a decision worth recording, so each
 * one is its own dated row with a reason and the person who granted it.
 */
const InvoiceDiscounts = ({ invoice, onAdd, onRemove }) => {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [type, setType] = useState("amount");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState("");

  const discounts = invoice?.post_issue_discounts || [];
  const status = invoice?.status;

  // Only meaningful once the bill exists in the patient's hands.
  const isIssued = status && !["draft", "cancelled"].includes(status);
  if (!isIssued) return null;

  const currency = getCurrencySymbol();
  const formatAmount = (a) =>
    `${currency}${Number(a || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const outstanding = Math.max(Number(invoice?.total || 0) - Number(invoice?.paid_amount || 0), 0);

  // Mirrors the server rule: a discount can never exceed what is still due,
  // because that would drop the bill below money already collected.
  const previewAmount = type === "percentage"
    ? (Number(invoice?.subtotal || 0) * (Number(value || 0) / 100))
    : Number(value || 0);
  const exceedsDue = previewAmount > outstanding + 0.005;

  const reset = () => {
    setValue("");
    setType("amount");
    setReason("");
    setError("");
    setAdding(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!Number(value) || Number(value) <= 0) {
      setError("Enter a discount greater than zero.");
      return;
    }
    if (!reason.trim()) {
      setError("Please give a reason for this discount.");
      return;
    }
    if (exceedsDue) {
      setError(`You can discount up to ${formatAmount(outstanding)} on this invoice.`);
      return;
    }
    try {
      setSaving(true);
      await onAdd({ value: Number(value), discount_type: type, reason: reason.trim() });
      reset();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Could not apply this discount.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id) => {
    try {
      setRemovingId(id);
      await onRemove(id);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TicketPercent size={18} className="text-amber-600" />
          <h3 className="text-lg font-semibold text-gray-900">Discounts after issue</h3>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            disabled={outstanding <= 0}
            title={outstanding <= 0 ? "Nothing left to discount — this invoice is fully settled." : undefined}
            className="px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Add discount
          </button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={handleSubmit}
          className="bg-amber-50/60 border border-amber-100 rounded-xl p-4 space-y-3 mb-4"
        >
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="w-full sm:w-44">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Discount
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white rounded-lg p-0.5 border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setType("percentage")}
                    className={`px-2 py-1 text-xs font-semibold rounded-md ${type === "percentage" ? "bg-[#2a276e] text-white" : "text-gray-500"}`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("amount")}
                    className={`px-2 py-1 text-xs font-semibold rounded-md ${type === "amount" ? "bg-[#2a276e] text-white" : "text-gray-500"}`}
                  >
                    {currency}
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  autoFocus
                  className="flex-1 min-w-0 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] text-right"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Goodwill, long-standing patient"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-500">
              {type === "percentage" && Number(value) > 0
                ? <>That's <span className="font-semibold text-gray-700">{formatAmount(previewAmount)}</span> off. </>
                : null}
              Up to <span className="font-semibold text-gray-700">{formatAmount(outstanding)}</span> can be discounted.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={saving}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || exceedsDue}
                className="px-4 py-2 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <GearLoader size="w-4 h-4" />}
                Apply discount
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}

      {discounts.length === 0 ? (
        !adding && (
          <p className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-4 py-3">
            No discount has been given on this invoice since it was issued.
          </p>
        )
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
          {discounts.map((d) => (
            <div key={d.id} className="flex items-start justify-between gap-3 px-4 py-3 bg-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-red-600">- {formatAmount(d.amount)}</span>
                  {d.discount_type === "percentage" && (
                    <span className="text-xs font-medium text-gray-400">({d.value}% of subtotal)</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-0.5 break-words">{d.reason}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDateTime(d.applied_at)}
                  {d.applied_by_name ? ` · by ${d.applied_by_name}` : ""}
                </p>
              </div>
              <button
                onClick={() => handleRemove(d.id)}
                disabled={removingId === d.id}
                title="Remove this discount"
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0 disabled:opacity-40"
              >
                {removingId === d.id ? <GearLoader size="w-4 h-4" /> : <Trash2 size={15} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvoiceDiscounts;
