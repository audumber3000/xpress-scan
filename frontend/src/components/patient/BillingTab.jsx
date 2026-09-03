import React, { useMemo, useState } from 'react';
import { Printer, Plus } from 'lucide-react';
import EmptyState from '../common/EmptyState';
import { receipt } from '../../assets/illustrations';
import { notify } from '../../utils/notify';
import { useAuth } from '../../contexts/AuthContext';
import { shareInvoiceManually } from '../../utils/whatsapp';
import { printPatientFile } from '../../utils/patientPrint';
import InvoiceEditor from '../payments/InvoiceEditor';
import WhatsAppIcon from '../common/WhatsAppIcon';
import FileFilterBar from './files/FileFilterBar';
import InvoiceRow from './billing/InvoiceRow';
import PaymentSummaryCard from './billing/PaymentSummaryCard';
import OutstandingCard from './billing/OutstandingCard';

import QuotationsPanel from './billing/QuotationsPanel';
/**
 * This patient's bills: the list at two thirds, the money at one third.
 *
 * The list is what you scan; the summary, what is owed, and the handful of
 * actions are what you glance at on the way past. Splitting them evenly would
 * give the same weight to six numbers and forty invoices.
 *
 * Every figure on the right is computed from the same array the list renders,
 * so the summary can never describe a different set of invoices than the ones
 * on screen.
 */
const SORTS = [
  { value: 'newest', label: 'Sort: Newest first' },
  { value: 'oldest', label: 'Sort: Oldest first' },
  { value: 'amount', label: 'Sort: Largest first' },
];

const STATUS_FILTER = [
  { value: 'all', label: 'All invoices' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partly paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'draft', label: 'Drafts' },
];

const BillingTab = ({ patient, invoices = [], casePapers = [], prescriptions = [], patientId, refreshInvoices }) => {
  const { user } = useAuth();
  const [openInvoiceId, setOpenInvoiceId] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (i) => {
      const s = String(i.status || '').toLowerCase();
      if (status === 'unpaid') return s === 'finalized';
      if (status === 'partial') return s === 'partially_paid';
      if (status === 'paid') return s.startsWith('paid');
      if (status === 'draft') return s === 'draft';
      return true;
    };
    const out = invoices.filter((i) => match(i) && (!q || String(i.invoice_number || i.id).toLowerCase().includes(q)));
    if (sort === 'amount') return out.sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
    const dir = sort === 'oldest' ? 1 : -1;
    return out.sort((a, b) => dir * (new Date(a.finalized_at || a.created_at || 0) - new Date(b.finalized_at || b.created_at || 0)));
  }, [invoices, query, status, sort]);

  // The bill a reminder or a share is about, unless one is picked: the oldest
  // still owing, else the most recent.
  const focusInvoice = useMemo(() => {
    const owing = invoices.filter((i) => Number(i.due_amount || 0) > 0);
    if (owing.length) {
      return [...owing].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))[0];
    }
    return [...invoices].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null;
  }, [invoices]);

  const share = async (invoice) => {
    if (!invoice) { notify.problem('There is no invoice to send yet.'); return; }
    setSharing(true);
    try {
      const ok = await shareInvoiceManually(invoice, user);
      if (!ok) notify.problem("This patient has no phone number on file, so WhatsApp can't be opened.");
    } catch {
      notify.problem('Could not prepare that invoice.');
    } finally {
      setSharing(false);
    }
  };

  const closeEditor = () => {
    setOpenInvoiceId(null);
    refreshInvoices?.();
  };

  // New invoice is not here. It used to be ("Create estimate", which opened a
  // draft invoice), but a quick-actions list in the right column is the wrong
  // home for the commonest action on the screen — it is the last thing read and
  // it disappears entirely below lg. It sits on the invoice list header now, and
  // repeating it here would be the same button twice on one screen.
  const QUICK = [
    {
      key: 'send',
      label: 'Send invoice',
      icon: WhatsAppIcon,
      onClick: () => share(focusInvoice),
    },
    {
      key: 'print',
      label: 'Print statement',
      icon: Printer,
      onClick: () => printPatientFile({ patient, casePapers, invoices, prescriptions, user }),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 min-w-0">
          <FileFilterBar
            query={query}
            onQuery={setQuery}
            placeholder="Search by invoice number…"
            filters={[{ key: 'status', label: 'Status', value: status, onChange: setStatus, options: STATUS_FILTER }]}
            sort={sort}
            onSort={setSort}
            sortOptions={SORTS}
          />

          <div className="bg-white border border-gray-200 rounded-xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 tracking-tight">
                All invoices <span className="text-gray-400">{visible.length}</span>
              </h3>
              {/* Billing somebody is the commonest thing done on this screen, and
                  it used to live only in Quick actions — in the right column,
                  which drops out of view entirely below lg. The prominent button
                  was Record payment, which needs a bill to exist first. */}
              <button
                type="button"
                onClick={() => setOpenInvoiceId('new')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2a276e] text-white text-[12px] font-semibold hover:bg-[#1e1c4f] transition shrink-0"
              >
                <Plus size={13} /> New invoice
              </button>
            </div>

            {visible.length === 0 ? (
              <div className="px-4 py-10">
                <EmptyState
                  image={receipt}
                  title={invoices.length === 0 ? 'No invoices yet' : 'Nothing matches that'}
                  subtitle={invoices.length === 0
                    ? 'Bills raised for this patient will show up here.'
                    : 'Try a different status or clear the search.'}
                  // A patient with no bills yet is exactly who needs one raised,
                  // so the empty state offers it rather than just describing it.
                  action={invoices.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setOpenInvoiceId('new')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2a276e] text-white text-[13px] font-semibold hover:bg-[#1e1c4f] transition"
                    >
                      <Plus size={14} /> New invoice
                    </button>
                  ) : null}
                />
              </div>
            ) : (
              visible.map((inv) => (
                <InvoiceRow key={inv.id} invoice={inv} onOpen={(i) => setOpenInvoiceId(i.id)} />
              ))
            )}
          </div>

          <QuotationsPanel patientId={patientId} onConverted={refreshInvoices} />
        </div>

        <div className="space-y-4 min-w-0">
          <PaymentSummaryCard
            invoices={invoices}
            onRecordPayment={() => setOpenInvoiceId(focusInvoice?.id ?? 'new')}
          />

          <OutstandingCard invoices={invoices} onRemind={share} reminding={sharing} />

          <section className="bg-white border border-gray-200 rounded-xl">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 tracking-tight">Quick actions</h3>
            </div>
            <div className="p-2">
              {QUICK.map(({ key, label, icon: Icon, onClick }) => (
                <button
                  key={key}
                  type="button"
                  onClick={onClick}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <span className="w-8 h-8 rounded-lg bg-[#2a276e]/[0.07] text-[#2a276e] grid place-items-center flex-shrink-0">
                    <Icon size={15} />
                  </span>
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {openInvoiceId && (
        <InvoiceEditor
          invoiceId={openInvoiceId}
          prefill={openInvoiceId === 'new' ? { patientId: Number(patientId) } : null}
          onClose={closeEditor}
          onRefresh={refreshInvoices}
          onSave={closeEditor}
        />
      )}
    </>
  );
};

export default BillingTab;
