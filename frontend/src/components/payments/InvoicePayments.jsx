import React, { useState } from 'react';
import { Download, AlertTriangle } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { getCurrencySymbol } from '../../utils/currency';
import { formatDate, formatTime } from '../../utils/datetime';
import { downloadAuthedFile, isManualWhatsApp, shareReceiptManually } from '../../utils/whatsapp';
import { api } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from '../common/EmptyState';
import { receipt as receiptArt } from '../../assets/illustrations';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// Renders in the clinic's timezone; pure dates (paid_on) are shown as-is.
const fmtDate = (s) => formatDate(s);

/**
 * The part-payment history for one invoice, as its own tab in the invoice
 * drawer.
 *
 * It used to be a list crammed under the line items, which left no room to show
 * what a bookkeeper actually needs per installment — receipt number, the day
 * the money arrived versus the day it was entered, the method, the note. A tab
 * gets the full drawer width, so those become columns instead of a run-on
 * subtitle.
 *
 * Read-only: recording a payment happens through Mark as Paid in the drawer
 * footer, which already handles the partial case. Two ways to take money would
 * be two code paths to keep agreeing with each other.
 */
const InvoicePayments = ({ invoice }) => {
  const [receiptFor, setReceiptFor] = useState(null);
  const [sharingFor, setSharingFor] = useState(null);
  const { user } = useAuth();

  const payments = invoice?.payments || [];
  const total = Number(invoice?.total || 0);
  const paid = Number(invoice?.paid_amount || 0);
  const due = Number(invoice?.due_amount ?? Math.max(total - paid, 0));
  const canRecord = ['finalized', 'partially_paid', 'paid_unverified', 'paid_verified'].includes(invoice?.status);

  // Each installment has its own receipt: this payment, the total paid so far,
  // and the balance as it stood that day. Rendered server-side on click.
  const openReceipt = async (payment) => {
    setReceiptFor(payment.id);
    try {
      await downloadAuthedFile(
        `/invoices/${invoice.id}/payments/${payment.id}/receipt`,
        `receipt_${payment.receipt_number || payment.id}.pdf`
      );
    } catch (e) {
      toast.error('Could not open the receipt');
    } finally {
      setReceiptFor(null);
    }
  };

  // Deliberately the same shape as handleSendWhatsApp in InvoiceEditor, which
  // drives the WhatsApp button in the drawer footer: own-number clinics get a
  // prefilled chat, everyone else goes through the backend, and whatever the
  // backend says is what the user is told. An earlier version quietly fell back
  // to downloading the PDF when the automated send wasn't configured — the
  // button promises "send", so doing something else instead was a lie.
  const shareReceipt = async (payment) => {
    if (!invoice?.patient_phone) {
      toast.error('Patient phone number is required');
      return;
    }

    if (isManualWhatsApp(user)) {
      setSharingFor(payment.id);
      try {
        const opened = await shareReceiptManually(invoice, payment, user);
        if (opened) toast.success('Receipt downloaded — attach it in the WhatsApp chat that opened');
        else toast.error('Could not open WhatsApp — check the patient phone number');
      } catch (error) {
        console.error('Manual WhatsApp failed:', error);
        toast.error('Failed to prepare the WhatsApp message');
      } finally {
        setSharingFor(null);
      }
      return;
    }

    setSharingFor(payment.id);
    try {
      const response = await api.post(`/invoices/${invoice.id}/payments/${payment.id}/send-whatsapp`);
      if (response.success) {
        toast.success(`Receipt sent successfully to ${invoice.patient_phone}`);
      } else {
        toast.error(response.message || 'Failed to send receipt via WhatsApp');
      }
    } catch (error) {
      console.error('Error sending receipt via WhatsApp:', error);
      toast.error(error.response?.data?.detail || error.message || 'Failed to send receipt via WhatsApp');
    } finally {
      setSharingFor(null);
    }
  };

  if (!canRecord) {
    return (
      <EmptyState
        image={receiptArt}
        title="Not billable yet"
        subtitle="Finalize the invoice and payments against it show up here."
        className="bg-white rounded-xl border border-dashed border-gray-200"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Where the bill stands */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Invoice total', value: total, cls: 'text-gray-900' },
          { label: 'Paid so far', value: paid, cls: 'text-green-600' },
          { label: 'Balance due', value: due, cls: due > 0 ? 'text-amber-600' : 'text-green-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-lg font-bold mt-0.5 tabular-nums ${s.cls}`}>{money(s.value)}</p>
          </div>
        ))}
      </div>

      {/* The installments */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-[#f8fafc]">
              <tr>
                {['Receipt', 'Received on', 'Amount', 'Method', 'Note'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <EmptyState
                      image={receiptArt}
                      size="sm"
                      title="No payments recorded yet"
                      subtitle="Record the first one below and its receipt is generated automatically."
                    />
                  </td>
                </tr>
              ) : payments.map((p) => (
                <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors duration-150">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs font-mono text-gray-600">{p.receipt_number || '—'}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-sm text-gray-900">{fmtDate(p.paid_on || p.created_at)}</p>
                    {/* Money dated earlier than the day it was written down is
                        normal, but the books and the cash drawer only agree if
                        it's said out loud. */}
                    {p.is_back_dated ? (
                      <span
                        title={`Money received ${fmtDate(p.paid_on)}, entered ${fmtDate(p.recorded_on)}`}
                        className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700"
                      >
                        <AlertTriangle size={9} /> Entered {fmtDate(p.recorded_on)}
                      </span>
                    ) : (
                      p.created_at && <p className="text-xs text-gray-400">{formatTime(p.created_at)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">{money(p.amount)}</span>
                    {p.receipt_balance_due != null && (
                      <p className="text-xs text-gray-400 tabular-nums">
                        {Number(p.receipt_balance_due) > 0
                          ? `${money(p.receipt_balance_due)} left`
                          : 'Settled'}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{p.method || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px]">
                    <span className="line-clamp-2">{p.note || '—'}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => shareReceipt(p)}
                        disabled={sharingFor === p.id || !invoice?.patient_phone}
                        title={invoice?.patient_phone
                          ? `Send receipt to ${invoice.patient_phone} on WhatsApp`
                          : 'No phone number on this patient'}
                        className="p-2 rounded-lg text-gray-400 hover:text-[#25D366] hover:bg-[#25D366]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {sharingFor === p.id
                          ? <span className="block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                          : <FaWhatsapp size={17} />}
                      </button>
                      <button
                        onClick={() => openReceipt(p)}
                        disabled={receiptFor === p.id}
                        title={p.receipt_number ? `Download receipt ${p.receipt_number}` : "Download this payment's receipt"}
                        className="p-2 rounded-lg text-gray-400 hover:text-[#2a276e] hover:bg-[#2a276e]/10 transition-colors disabled:opacity-40"
                      >
                        {receiptFor === p.id
                          ? <span className="block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                          : <Download size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default InvoicePayments;
