import React, { useState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { api, getFriendlyErrorMessage } from "../../utils/api";
import { notify } from "../../utils/notify";
import InlineFeedback from "../common/InlineFeedback";
import { getCurrencySymbol } from "../../utils/currency";
import { useAuth } from "../../contexts/AuthContext";
import { isManualWhatsApp, shareInvoiceManually } from "../../utils/whatsapp";
import GearLoader from "../GearLoader";
import Spinner from "../common/Spinner";
import InvoiceLineItems from "./InvoiceLineItems";
import InvoicePayments from "./InvoicePayments";
import InvoiceDiscounts from "./InvoiceDiscounts";
import InvoiceActions from "./InvoiceActions";
import InvoiceTitleBlock from "./invoice/InvoiceTitleBlock";
import InvoiceSummaryStrip from "./invoice/InvoiceSummaryStrip";
import InvoiceTotals from "./invoice/InvoiceTotals";
import PartlyPaidBanner from "./invoice/PartlyPaidBanner";
import InvoiceDrawerHeader from "./invoice/InvoiceDrawerHeader";
import PaymentTimeline from "./invoice/PaymentTimeline";
import InvoiceCollectionStats from "./invoice/InvoiceCollectionStats";
import MarkAsPaidModal from "./MarkAsPaidModal";
import ConfirmDialog from "../common/ConfirmDialog";
import MasterPasswordModal from "../common/MasterPasswordModal";
import { generatePatientPersona, generateInitialsAvatar } from "../../utils/avatar";

/**
 * `onSave` vs `onRefresh`
 *
 * Every parent wires onSave to a function that refreshes its list AND closes
 * this drawer, so calling it after a payment or a discount shut the drawer on
 * the user — and a drawer closing is exactly what Cancel does, so there was no
 * way to tell "recorded" from "abandoned". Worse, the numbers that were the
 * confirmation (Paid, Balance due, the ring) vanished with it.
 *
 * onRefresh updates the list behind without closing, so the result stays on
 * screen where the app's own feedback rule expects it — tier 1, the value
 * changed, say nothing. onSave now means what its name says: the task is
 * finished, close.
 *
 * It falls back to onSave when a parent has not been given one, so callers that
 * were never updated keep their old behaviour rather than silently not
 * refreshing.
 */
const InvoiceEditor = ({ invoiceId, onClose, onSave, onRefresh, prefill = null }) => {
  const refreshList = () => (onRefresh || onSave)?.();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState(null);
  // For "new", there's nothing to fetch — start in the form view immediately.
  // For an existing id, start in the spinner view until fetchInvoice resolves.
  const [loading, setLoading] = useState(invoiceId !== 'new');
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [drawerTab, setDrawerTab] = useState('invoice'); // 'invoice' | 'payments'
  const paymentCount = (invoice?.payments || []).length;
  // What the timeline refetches on. Derived rather than a counter we remember to
  // bump: any route that changes the money changes one of these three, and a
  // route that changes none of them has nothing new to show.
  const timelineKey = `${paymentCount}:${invoice?.paid_amount ?? ''}:${invoice?.status ?? ''}`;

  // A different invoice always opens on its own terms, never on the tab the
  // last one happened to be left on.
  useEffect(() => { setDrawerTab('invoice'); }, [invoiceId]);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLinePrompt, setDeleteLinePrompt] = useState(null); // line item pending stock-aware delete
  const [isCreating, setIsCreating] = useState(invoiceId === 'new');
  const [autoCreatingFromPrefill, setAutoCreatingFromPrefill] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [visits, setVisits] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  // Why the last action did not work, shown above the footer buttons that
  // triggered it. Tier 2 of the feedback rule (utils/notify.js): the user is
  // inside this drawer, so the reason belongs inside it too, not in a card
  // over the page behind. Cleared on the next attempt.
  const [actionError, setActionError] = useState('');
  const fail = (error, fallback) => setActionError(getFriendlyErrorMessage(error, fallback));

  const currentInvoiceId = invoice?.id || invoiceId;
  const creationStartedRef = useRef(false);
  // True once THIS editor session created a fresh draft — so we can clean it up
  // on close if it was left completely empty (avoids ₹0 orphan drafts).
  const createdHereRef = useRef(false);

  const createDraftInvoice = async ({ patientId, appointmentId = null, caseId = null, notes = "", lineItems = [] }) => {
    const newInvoice = await api.post('/invoices', {
      patient_id: parseInt(patientId),
      appointment_id: appointmentId ? parseInt(appointmentId) : null,
      case_paper_id: caseId ? parseInt(caseId) : null,
      notes
    });

    for (const item of lineItems) {
      if (!item?.description) continue;
      await api.post(`/invoices/${newInvoice.id}/line-items`, {
        description: item.description,
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
        amount: item.amount != null ? Number(item.amount) : undefined
      });
    }

    const enriched = await api.get(`/invoices/${newInvoice.id}`);
    setInvoice(enriched);
    createdHereRef.current = true;
    setIsCreating(false);
    setLoading(false);
    return enriched;
  };

  // Close handler that discards a draft we created this session if it was left
  // empty (no line items). Safe for case papers: invoices generated from a case
  // paper always carry line items, so they're never discarded.
  const handleClose = async () => {
    const itemCount = invoice?.line_items?.length ?? 0;
    if (createdHereRef.current && invoice?.id && invoice?.status === 'draft' && itemCount === 0) {
      try {
        await api.delete(`/invoices/${invoice.id}`);
        if (onSave) onSave(); // refresh the list so the now-deleted draft disappears
      } catch (error) {
        console.error('Failed to discard empty draft invoice:', error);
      }
    }
    onClose();
  };

  useEffect(() => {
    if (invoiceId === 'new' && !invoice) {
      if (creationStartedRef.current) return;
      creationStartedRef.current = true;
      setIsCreating(true);
      if (prefill?.patientId) {
        setLoading(false);
        setAutoCreatingFromPrefill(true);
        createDraftInvoice({
          patientId: prefill.patientId,
          appointmentId: prefill.appointmentId,
          caseId: prefill.caseId,
          notes: prefill.notes || "",
          lineItems: prefill.lineItems || []
        })
          .catch((error) => {
            console.error("Error creating prefilled draft invoice:", error);
            notify.problem(error, "Could not start that invoice");
            onClose();
          })
          .finally(() => {
            setAutoCreatingFromPrefill(false);
          });
      }
      // No fetchPatients() here — the debounced effect owns it and fires as
      // soon as isCreating flips true.
    } else if (invoiceId && invoiceId !== 'new') {
      setIsCreating(false);
      fetchInvoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  // Fetches all patients once via the proven /patients/ endpoint. We filter
  // client-side as the user types — no extra request per keystroke, no
  // dependence on /appointments/search-patients (which had a permission /
  // shape quirk that surfaced as an empty result on real accounts).
  // Searched on the server, not in the browser. This used to pull /patients/
  // with no limit and filter the result in JS — but the endpoint defaults to 100
  // rows, so on a clinic with more than that, everyone past the first hundred
  // was simply unfindable, and it failed silently as "no patient matches".
  const fetchPatients = async (term = '') => {
    try {
      setIsSearching(true);
      const q = term.trim();
      const data = await api.get('/patients/', {
        // The endpoint requires 2+ chars to search; below that it's the first
        // page, which is what an untouched dropdown should show anyway.
        params: { skip: 0, limit: 20, ...(q.length >= 2 ? { search: q } : {}) },
      });
      setPatients(data || []);
    } catch (error) {
      console.error("Error loading patients:", error);
      setPatients([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced so a five-letter name is one request, not five.
  useEffect(() => {
    if (!isCreating) return;
    const t = setTimeout(() => fetchPatients(patientSearch), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientSearch, isCreating]);

  const handleFinalize = async () => {
    try {
      setActionError("");
      setFinalizing(true);
      const updated = await api.post(`/invoices/${currentInvoiceId}/finalize`);
      setInvoice(updated);
    } catch (error) {
      console.error("Error finalizing invoice:", error);
      fail(error, "Could not generate the final invoice");
    } finally {
      setFinalizing(false);
    }
  };

  const fetchPatientVisits = async (patientId) => {
    try {
      const data = await api.get(`/appointments/patient-visits/${patientId}`);
      setVisits(data || []);
      // Auto-select latest visit if only one exists or just for convenience
      if (data && data.length > 0) {
        setSelectedAppointmentId(data[0].id.toString());
      }
    } catch (error) {
      // Silent on purpose. This only fills the "link a visit" dropdown, which is
      // optional — an empty list is a usable state, not a failure to report.
      console.error("Error fetching patient visits:", error);
    }
  };

  // Patients are filtered client-side now (see filteredPatients below).

  useEffect(() => {
    if (selectedPatientId) {
      fetchPatientVisits(selectedPatientId);
    } else {
      setVisits([]);
      setSelectedAppointmentId("");
    }
  }, [selectedPatientId]);

  const handleCreateNewInvoice = async () => {
    if (!selectedPatientId) {
      setActionError("Choose a patient first.");
      return;
    }
    try {
      setActionError("");
      setSaving(true);
      
      await createDraftInvoice({
        patientId: selectedPatientId,
        appointmentId: selectedAppointmentId ? parseInt(selectedAppointmentId) : null,
        notes: "",
        lineItems: []
      });

    } catch (error) {
      console.error("Error creating invoice:", error);
      fail(error, "Could not create the draft invoice");
    } finally {
      setSaving(false);
    }
  };

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/invoices/${invoiceId}`);
      setInvoice(data);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      notify.problem(error, "Could not open that invoice");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleAddLineItem = async (lineItemData) => {
    try {
      setActionError("");
      setSaving(true);
      const updated = await api.post(`/invoices/${currentInvoiceId}/line-items`, lineItemData);
      setInvoice(updated);
    } catch (error) {
      console.error("Error adding line item:", error);
      fail(error, "Could not add that item");
    } finally {
      setSaving(false);
    }
  };

  // handleAddPayment / handleDeletePayment lived here for the payments panel's
  // own form and row actions. Both are gone: recording goes through Mark as
  // Paid, and the endpoints they called are still there if either comes back.

  // Discounts granted after the invoice was issued. Errors are rethrown so the
  // discount form can show the server's reason (e.g. "more than the amount due")
  // inline next to the field, rather than only as a toast.
  const handleAddDiscount = async (payload) => {
    try {
      const updated = await api.post(`/invoices/${currentInvoiceId}/discounts`, payload);
      setInvoice(updated);
      refreshList();
    } catch (error) {
      console.error("Error applying discount:", error);
      throw error;
    }
  };

  const handleRemoveDiscount = async (discountId) => {
    try {
      const updated = await api.delete(`/invoices/${currentInvoiceId}/discounts/${discountId}`);
      setInvoice(updated);
      refreshList();
    } catch (error) {
      console.error("Error removing discount:", error);
      fail(error, "Could not remove that discount");
    }
  };

  const handleEditLineItem = async (lineItemId, lineItemData) => {
    try {
      setActionError("");
      setSaving(true);
      const updated = await api.put(`/invoices/${currentInvoiceId}/line-items/${lineItemId}`, lineItemData);
      setInvoice(updated);
    } catch (error) {
      console.error("Error updating line item:", error);
      fail(error, "Could not update that item");
    } finally {
      setSaving(false);
    }
  };

  // A line billed from case-paper stock usage gets the same choice the case
  // paper offers: drop it from the bill only, or remove it entirely and restock.
  // Plain lines delete after a simple confirm.
  const requestDeleteLineItem = (item) => {
    if (item?.linked_stock) {
      setDeleteLinePrompt(item);
      return;
    }
    if (!window.confirm("Are you sure you want to delete this line item?")) return;
    performDeleteLineItem(item.id, false);
  };

  const performDeleteLineItem = async (lineItemId, restock) => {
    try {
      setActionError("");
      setSaving(true);
      const updated = await api.delete(
        `/invoices/${currentInvoiceId}/line-items/${lineItemId}`,
        { params: { restock } }
      );
      setDeleteLinePrompt(null);
      if (updated?.deleted) {
        notify.done("That was the last item, so the invoice went too");
        if (onSave) onSave();
        onClose();
        return;
      }
      setInvoice(updated);
      if (restock) notify.done("Removed, and the stock went back on the shelf");
    } catch (error) {
      console.error("Error deleting line item:", error);
      fail(error, "Could not delete that item");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsPaid = async (paymentData) => {
    try {
      setActionError("");
      setSaving(true);
      const updated = await api.post(`/invoices/${currentInvoiceId}/mark-as-paid`, paymentData);
      setInvoice(updated);
      // No message either way, and now that is actually true: the drawer stays
      // open and Paid, Balance due and the ring all recalculate in front of the
      // user. This used to close on a full payment, which took those numbers
      // off screen before anyone could read them.
      refreshList();
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      fail(error, "Could not record that payment");
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateInvoiceStats = async (updateData) => {
    try {
      setActionError("");
      setSaving(true);
      const updated = await api.put(`/invoices/${currentInvoiceId}`, updateData);
      setInvoice(updated);
    } catch (error) {
      console.error("Error updating invoice:", error);
      fail(error, "Could not save those changes");
    } finally {
      setSaving(false);
    }
  };

  // Print opens the same PDF the download produces, in a tab, and asks the
  // browser to print it. Deliberately not a window.print() of the drawer: what
  // would come out is the app chrome, not the invoice the patient gets.
  const [printing, setPrinting] = useState(false);
  const handlePrintInvoice = async () => {
    try {
      setActionError("");
      setPrinting(true);
      const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${baseURL}/api/v1/invoices/${currentInvoiceId}/pdf`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (!response.ok) throw new Error('Failed to build the PDF');

      const url = window.URL.createObjectURL(await response.blob());
      const w = window.open(url);
      if (!w) {
        // Popup blocked. Revoking here would leave the user with nothing, so
        // say what happened rather than failing silently.
        window.URL.revokeObjectURL(url);
        setActionError('Your browser blocked the print window. Allow popups for this site, or use Download.');
        return;
      }
      w.addEventListener('load', () => { w.print(); }, { once: true });
    } catch (error) {
      console.error("Error printing invoice:", error);
      fail(error, "Could not build the PDF to print");
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setActionError("");
      setDownloadingPDF(true);
      const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const apiPath = '/api/v1';
      const response = await fetch(`${baseURL}${apiPath}/invoices/${currentInvoiceId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoice?.invoice_number || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      fail(error, "Could not build the PDF");
    } finally {
      setDownloadingPDF(false);
    }
  };

  // `masterToken` is present only for a bill that has money against it — the
  // master password prompt supplies it. Unpaid bills pass undefined and the
  // header is simply omitted.
  const handleDeleteInvoice = async (masterToken) => {
    try {
      setActionError("");
      setDeleting(true);
      await api.delete(
        `/invoices/${currentInvoiceId}`,
        masterToken ? { headers: { 'X-Master-Token': masterToken } } : {}
      );
      setShowDeleteConfirm(false);
      if (onSave) onSave();
      onClose();
    } catch (error) {
      console.error("Delete error:", error);
      if (masterToken) throw error;  // shown inside the prompt that is still open
      fail(error, "Could not delete this invoice");
    } finally {
      setDeleting(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!invoice?.patient_phone) {
      setActionError("This patient has no phone number on file.");
      return;
    }

    // Manual mode (desktop app): download the PDF and open WhatsApp with a
    // prefilled message, so the clinic sends it from their own number.
    if (isManualWhatsApp(user)) {
      try {
        setActionError("");
      setSendingWhatsApp(true);
        const opened = await shareInvoiceManually(invoice, user);
        if (opened) notify.sent('Invoice downloaded. Attach it in the WhatsApp chat that just opened');
        else setActionError("Could not open WhatsApp. Check the patient phone number.");
      } catch (error) {
        console.error('Manual WhatsApp failed:', error);
        fail(error, "Could not prepare the WhatsApp message");
      } finally {
        setSendingWhatsApp(false);
      }
      return;
    }

    // Automated mode: backend sends via the MolarPlus/Nexus number.
    try {
      setActionError("");
      setSendingWhatsApp(true);
      const response = await api.post(`/invoices/${currentInvoiceId}/send-whatsapp`);

      if (response.success) {
        notify.sent(`Invoice sent to ${invoice.patient_phone}`);
      } else {
        setActionError(response.message || "Could not send the invoice on WhatsApp");
      }
    } catch (error) {
      console.error("Error sending invoice via WhatsApp:", error);
      fail(error, "Could not send the invoice on WhatsApp");
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const canEdit = invoice?.status === 'draft';
  // Any invoice can be deleted now. One that carries money is the case a clinic
  // used to be stuck with, so it asks for the master password instead of
  // refusing outright; one that carries none has nothing to protect and deletes
  // on a plain confirm.
  const PAID_STATUSES = ['partially_paid', 'paid_verified', 'paid_unverified'];
  const canDelete = !!invoice;
  const carriesMoney = !!invoice
    && (PAID_STATUSES.includes(invoice.status) || Number(invoice.paid_amount || 0) > 0);
  const isLoadingDrawer = loading || autoCreatingFromPrefill;

  // The server already returned exactly this page, searched across the whole
  // clinic — filtering again here would only re-introduce the 100-row ceiling.
  const filteredPatients = patients;

  // One persistent drawer element. The slide-in animation runs exactly once on
  // mount; the inner content swaps between a loader and the full form when the
  // invoice fetch completes — so we no longer get the "drawer pops in, then
  // slides in again" double-mount jank.
  return (
    <>
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/30" onClick={handleClose} />

        <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
          {isLoadingDrawer ? (
            <div className="flex-1 flex items-center justify-center">
              <GearLoader size="w-8 h-8" />
            </div>
          ) : (
            <>
          <InvoiceDrawerHeader
            tabs={!isCreating && invoice ? [
              { id: 'invoice', label: 'Invoice' },
              { id: 'payments', label: `Part Payments${paymentCount ? ` (${paymentCount})` : ''}` },
              { id: 'activity', label: 'Activity' },
            ] : []}
            activeTab={drawerTab}
            onTabChange={setDrawerTab}
            title="New Invoice"
            showDocActions={!isCreating && !!invoice}
            onPrint={handlePrintInvoice}
            printing={printing}
            onDownload={handleDownloadPDF}
            downloading={downloadingPDF}
            onClose={handleClose}
          />

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {isCreating ? (
              <div className="max-w-md mx-auto mt-10">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create Invoice</h3>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Patient</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by name or phone..."
                      value={patientSearch}
                      onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatientId(""); }}
                      autoFocus
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-2.5">
                        <div className="animate-spin h-5 w-5 border-2 border-[#2a276e] border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>

                  {/* Inline autocomplete list — clickable patients show right below the input */}
                  {!isSearching && (
                    <div className="mt-2 border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-100 bg-white">
                      {filteredPatients.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-500">
                          {patients.length === 0
                            ? 'No patients yet. Register a patient before creating an invoice.'
                            : `No patient matches "${patientSearch}". Check the spelling.`}
                        </div>
                      ) : (
                        filteredPatients.map(p => {
                          const isSelected = String(selectedPatientId) === String(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => { setSelectedPatientId(p.id); setPatientSearch(p.name); }}
                              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                                isSelected ? 'bg-[#2a276e]/5' : 'hover:bg-gray-50'
                              }`}
                            >
                              <img 
                                src={generatePatientPersona(p, 80)} 
                                onError={(e) => { e.target.onerror = null; e.target.src = generateInitialsAvatar(p.name || 'Patient'); }}
                                alt={p.name} 
                                className={`w-9 h-9 rounded-full flex-shrink-0 object-cover border ${isSelected ? 'border-[#2a276e] border-2' : 'border-gray-100'}`}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                                <p className="text-xs text-gray-500 truncate">
                                  {p.phone || 'No phone'} · {p.visit_count ?? 0} visit{(p.visit_count ?? 0) === 1 ? '' : 's'}
                                </p>
                              </div>
                              {isSelected && (
                                <svg className="w-5 h-5 text-[#2a276e] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {selectedPatientId && visits.length > 0 && (
                  <div className="mb-6 animate-fade-in">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Link to Visit (Appointment)</label>
                    <select
                      value={selectedAppointmentId}
                      onChange={(e) => setSelectedAppointmentId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e] bg-blue-50/50"
                    >
                      <option value="">-- Generic Invoice (No visit link) --</option>
                      {visits.map(v => (
                        <option key={v.id} value={v.id}>
                          Visit #{v.visit_number} — {new Date(v.appointment_date).toLocaleDateString()} {v.start_time ? `at ${v.start_time}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500 italic">
                      Linking a visit helps track which appointment this invoice belongs to.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleCreateNewInvoice}
                  disabled={!selectedPatientId || saving}
                  className="w-full px-4 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1e1c4f] disabled:opacity-50 transition-colors shadow-md mt-4"
                >
                  {saving ? "Creating..." : "Create Draft Invoice"}
                </button>
              </div>
            ) : drawerTab === 'payments' ? (
              <InvoicePayments invoice={invoice} onChanged={setInvoice} />
            ) : drawerTab === 'activity' ? (
              <>
                {/* The band spans the drawer — capped, it loses the room the
                    three stat cards need and squeezes the invoice number.
                    The timeline is capped instead: stretched to full width it
                    puts the date a long way from the thing it dates. */}
                <InvoiceTitleBlock invoice={invoice} stats={<InvoiceCollectionStats invoice={invoice} />} />
                <div className="max-w-xl">
                  <PaymentTimeline invoiceId={invoice?.id} reloadKey={timelineKey} />
                </div>
              </>
            ) : (
              <>
                <InvoiceTitleBlock invoice={invoice} />

                <InvoiceSummaryStrip
                  invoice={invoice}
                  onRecordPayment={() => setShowMarkPaidModal(true)}
                  onSendReminder={handleSendWhatsApp}
                  sendingReminder={sendingWhatsApp}
                />

                <InvoiceLineItems
                  invoice={invoice}
                  lineItems={invoice?.line_items || []}
                  onAdd={handleAddLineItem}
                  onEdit={handleEditLineItem}
                  onDelete={requestDeleteLineItem}
                  onUpdateInvoice={handleUpdateInvoiceStats}
                  canEdit={canEdit}
                />

                {/* Concession control on the left, arithmetic on the right —
                    the way the foot of a paper invoice reads. */}
                <div className="mt-3 flex flex-col-reverse sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <InvoiceDiscounts
                      invoice={invoice}
                      onAdd={handleAddDiscount}
                      onRemove={handleRemoveDiscount}
                    />
                  </div>
                  <InvoiceTotals
                    invoice={invoice}
                    canEdit={canEdit}
                    onUpdateInvoice={handleUpdateInvoiceStats}
                  />
                </div>

                <PartlyPaidBanner invoice={invoice} />

                {invoice?.notes && (
                  <div className="mt-4 rounded-lg border border-gray-200 p-3.5">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Notes</h3>
                    <p className="text-[13px] text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!isCreating && invoice && (
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-t border-gray-200 bg-gray-50">
              {/* Sits directly above the buttons that caused it, so the reason
                  and the retry are the same glance. */}
              {actionError && (
                <InlineFeedback tone="error" className="mb-3">{actionError}</InlineFeedback>
              )}
              <InvoiceActions
                invoice={invoice}
                onFinalize={handleFinalize}
                onMarkAsPaid={() => setShowMarkPaidModal(true)}
                onDownloadPDF={handleDownloadPDF}
                onSendWhatsApp={handleSendWhatsApp}
                canEdit={canEdit}
                canDelete={canDelete}
                onDelete={() => setShowDeleteConfirm(true)}
                deleting={deleting}
                downloadingPDF={downloadingPDF}
                sendingWhatsApp={sendingWhatsApp}
                finalizing={finalizing}
              />
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {showMarkPaidModal && (
        <MarkAsPaidModal
          invoice={invoice}
          onClose={() => setShowMarkPaidModal(false)}
          onConfirm={handleMarkAsPaid}
        />
      )}

      {/* Stock-linked line: remove from bill only, or entirely (restock too). */}
      <ConfirmDialog
        open={!!deleteLinePrompt}
        onClose={() => !saving && setDeleteLinePrompt(null)}
        tone="danger"
        title="Remove this item?"
        message={
          <>
            <span className="font-semibold text-gray-700">{deleteLinePrompt?.description}</span> was recorded as stock used on the case paper. Remove it from this bill only, or remove it entirely and put the stock back.
          </>
        }
        actions={[
          { label: 'Remove from bill only', variant: 'secondary', onClick: () => performDeleteLineItem(deleteLinePrompt.id, false), disabled: saving },
          { label: 'Remove entirely & restock', variant: 'danger', onClick: () => performDeleteLineItem(deleteLinePrompt.id, true), disabled: saving },
        ]}
      />

      {/* Delete a bill with money against it: the master password is the confirm.
          Writing off collected cash is not something a plain "are you sure"
          should be able to do. */}
      <MasterPasswordModal
        open={showDeleteConfirm && carriesMoney}
        title="Delete this paid bill?"
        message={
          <>
            Invoice <span className="font-semibold text-gray-700">{invoice?.invoice_number || `#${currentInvoiceId}`}</span> has{" "}
            <span className="font-semibold text-gray-700">
              {getCurrencySymbol()}{Number(invoice?.paid_amount || 0).toLocaleString('en-IN')}
            </span>{" "}
            collected against it. Deleting the bill removes those payments and their receipts from your books.
            This <span className="font-semibold">cannot be undone</span>.
          </>
        }
        confirmLabel="Delete bill"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteInvoice}
      />

      {/* Delete invoice — on-brand confirm (soft backdrop, matches the app's dialogs). */}
      {showDeleteConfirm && !carriesMoney && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">Delete invoice?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Deleting invoice{" "}
                  <span className="font-semibold">{invoice?.invoice_number || `#${currentInvoiceId}`}</span>{" "}
                  removes the bill and all of the charges below. This{" "}
                  <span className="font-semibold">cannot be undone</span>.
                </p>
                {(invoice?.line_items?.length ?? 0) > 0 && (
                  <ul className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 divide-y divide-gray-100 text-sm">
                    {invoice.line_items.map((li) => (
                      <li key={li.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="text-gray-700 truncate">
                          {li.description}
                          {(li.quantity ?? 1) > 1 && (
                            <span className="text-gray-400"> × {li.quantity}</span>
                          )}
                        </span>
                        <span className="text-gray-500 flex-shrink-0">
                          ₹{Number(li.amount ?? 0).toLocaleString('en-IN')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Any medicines or materials recorded as used stay in your stock ledger. Only their billing here is removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteInvoice()}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <Spinner />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InvoiceEditor;

