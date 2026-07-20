import React, { useState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { api } from "../../utils/api";
import { toast } from "react-toastify";
import { getCurrencySymbol } from "../../utils/currency";
import GearLoader from "../GearLoader";
import InvoiceHeader from "./InvoiceHeader";
import InvoiceLineItems from "./InvoiceLineItems";
import InvoicePayments from "./InvoicePayments";
import InvoiceActions from "./InvoiceActions";
import MarkAsPaidModal from "./MarkAsPaidModal";
import { generatePatientPersona, generateInitialsAvatar } from "../../utils/avatar";

const InvoiceEditor = ({ invoiceId, onClose, onSave, prefill = null }) => {
  const [invoice, setInvoice] = useState(null);
  // For "new", there's nothing to fetch — start in the form view immediately.
  // For an existing id, start in the spinner view until fetchInvoice resolves.
  const [loading, setLoading] = useState(invoiceId !== 'new');
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isCreating, setIsCreating] = useState(invoiceId === 'new');
  const [autoCreatingFromPrefill, setAutoCreatingFromPrefill] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [visits, setVisits] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [isSearching, setIsSearching] = useState(false);

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
          .then(() => {
            toast.success("Draft invoice created");
          })
          .catch((error) => {
            console.error("Error creating prefilled draft invoice:", error);
            toast.error("Failed to create draft invoice");
            onClose();
          })
          .finally(() => {
            setAutoCreatingFromPrefill(false);
          });
      } else {
        fetchPatients();
      }
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
  const fetchPatients = async () => {
    try {
      setIsSearching(true);
      const data = await api.get('/patients/');
      setPatients(data || []);
    } catch (error) {
      console.error("Error loading patients:", error);
      setPatients([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFinalize = async () => {
    try {
      setFinalizing(true);
      const updated = await api.post(`/invoices/${currentInvoiceId}/finalize`);
      setInvoice(updated);
      toast.success("Final invoice generated — ready to send or mark as paid");
    } catch (error) {
      console.error("Error finalizing invoice:", error);
      toast.error(error?.response?.data?.detail || "Failed to finalize invoice");
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
      console.error("Error fetching patient visits:", error);
      toast.error("Failed to load patient visits");
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
      toast.error("Please select a patient");
      return;
    }
    try {
      setSaving(true);
      
      await createDraftInvoice({
        patientId: selectedPatientId,
        appointmentId: selectedAppointmentId ? parseInt(selectedAppointmentId) : null,
        notes: "",
        lineItems: []
      });

      toast.success("Draft invoice created");
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error("Failed to create draft invoice");
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
      toast.error("Failed to load invoice");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleAddLineItem = async (lineItemData) => {
    try {
      setSaving(true);
      const updated = await api.post(`/invoices/${currentInvoiceId}/line-items`, lineItemData);
      setInvoice(updated);
      toast.success("Line item added successfully");
    } catch (error) {
      console.error("Error adding line item:", error);
      toast.error("Failed to add line item");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async (payload) => {
    try {
      const updated = await api.post(`/invoices/${currentInvoiceId}/payments`, payload);
      setInvoice(updated);
      toast.success("Payment recorded");
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error(error?.message || "Failed to record payment");
    }
  };

  const handleDeletePayment = async (paymentId) => {
    try {
      const updated = await api.delete(`/invoices/${currentInvoiceId}/payments/${paymentId}`);
      setInvoice(updated);
      toast.success("Payment removed");
    } catch (error) {
      console.error("Error removing payment:", error);
      toast.error("Failed to remove payment");
    }
  };

  const handleEditLineItem = async (lineItemId, lineItemData) => {
    try {
      setSaving(true);
      const updated = await api.put(`/invoices/${currentInvoiceId}/line-items/${lineItemId}`, lineItemData);
      setInvoice(updated);
      toast.success("Line item updated successfully");
    } catch (error) {
      console.error("Error updating line item:", error);
      toast.error("Failed to update line item");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLineItem = async (lineItemId) => {
    if (!window.confirm("Are you sure you want to delete this line item?")) {
      return;
    }

    try {
      setSaving(true);
      const updated = await api.delete(`/invoices/${currentInvoiceId}/line-items/${lineItemId}`);
      if (updated?.deleted) {
        toast.success("Invoice deleted — no items remaining");
        if (onSave) onSave();
        onClose();
        return;
      }
      setInvoice(updated);
      toast.success("Line item deleted successfully");
    } catch (error) {
      console.error("Error deleting line item:", error);
      toast.error("Failed to delete line item");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsPaid = async (paymentData) => {
    try {
      setSaving(true);
      const updated = await api.post(`/invoices/${currentInvoiceId}/mark-as-paid`, paymentData);
      setInvoice(updated);
      if (updated.status === 'partially_paid') {
        const due = Number(updated.due_amount || 0);
        toast.success(`Partial payment recorded. ${getCurrencySymbol()}${due.toLocaleString('en-US', { minimumFractionDigits: 2 })} still due.`);
      } else {
        toast.success("Invoice marked as paid successfully");
        if (onSave) onSave();
      }
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      toast.error("Failed to mark invoice as paid");
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateInvoiceStats = async (updateData) => {
    try {
      setSaving(true);
      const updated = await api.put(`/invoices/${currentInvoiceId}`, updateData);
      setInvoice(updated);
      toast.success("Invoice updated successfully");
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast.error("Failed to update invoice");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
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
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to download PDF");
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleDeleteInvoice = async () => {
    try {
      setDeleting(true);
      await api.delete(`/invoices/${currentInvoiceId}`);
      toast.success("Invoice deleted successfully");
      setShowDeleteConfirm(false);
      if (onSave) onSave();
      onClose();
    } catch (error) {
      console.error("Delete error:", error);
      // Surface the backend's reason (e.g. a paid invoice can't be deleted).
      toast.error(error?.response?.data?.detail || error?.message || "Failed to delete invoice");
    } finally {
      setDeleting(false);
    }
  };

  const handleSendWhatsApp = async () => {
    try {
      if (!invoice?.patient_phone) {
        toast.error("Patient phone number is required");
        return;
      }

      setSendingWhatsApp(true);
      const response = await api.post(`/invoices/${currentInvoiceId}/send-whatsapp`);
      
      if (response.success) {
        toast.success(`Invoice sent successfully to ${invoice.patient_phone}`);
      } else {
        toast.error(response.message || "Failed to send invoice via WhatsApp");
      }
    } catch (error) {
      console.error("Error sending invoice via WhatsApp:", error);
      const errorMessage = error.response?.data?.detail || error.message || "Failed to send invoice via WhatsApp";
      toast.error(errorMessage);
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const canEdit = invoice?.status === 'draft';
  // An invoice can be deleted only while it carries no money: no payments and a
  // non-paid status. Paid / partially-paid invoices are kept (the backend also
  // refuses to delete them). Managing money on those happens per-payment instead.
  const PAID_STATUSES = ['partially_paid', 'paid_verified', 'paid_unverified'];
  const canDelete = !!invoice && !PAID_STATUSES.includes(invoice.status) && Number(invoice.paid_amount || 0) === 0;
  const isLoadingDrawer = loading || autoCreatingFromPrefill;

  // Client-side patient filter — searches name or phone, case-insensitive.
  // Limit to first 20 matches so the dropdown stays scrollable.
  const filteredPatients = (() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return patients.slice(0, 20);
    return patients.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q)
    ).slice(0, 20);
  })();

  // One persistent drawer element. The slide-in animation runs exactly once on
  // mount; the inner content swaps between a loader and the full form when the
  // invoice fetch completes — so we no longer get the "drawer pops in, then
  // slides in again" double-mount jank.
  return (
    <>
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/30" onClick={handleClose} />

        <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
          {isLoadingDrawer ? (
            <div className="flex-1 flex items-center justify-center">
              <GearLoader size="w-8 h-8" />
            </div>
          ) : (
            <>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">{isCreating ? "Invoice" : "Invoice Details"}</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
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
            ) : (
              <>
                <InvoiceHeader invoice={invoice} />
                
                <InvoiceLineItems
                  invoice={invoice}
                  lineItems={invoice?.line_items || []}
                  onAdd={handleAddLineItem}
                  onEdit={handleEditLineItem}
                  onDelete={handleDeleteLineItem}
                  onUpdateInvoice={handleUpdateInvoiceStats}
                  canEdit={canEdit}
                />

            {/* Partial-payment schedule — visible once the invoice is finalized */}
            <InvoicePayments
              invoice={invoice}
              onAdd={handleAddPayment}
              onDelete={handleDeletePayment}
              canEdit={canEdit}
            />

            {invoice?.notes && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Notes:</h3>
                <p className="text-sm text-gray-600">{invoice.notes}</p>
              </div>
            )}
              </>
            )}
          </div>

          {/* Footer */}
          {!isCreating && invoice && (
            <div className="p-6 border-t border-gray-200 bg-gray-50">
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

      {/* Delete invoice — on-brand confirm (soft backdrop, matches the app's dialogs). */}
      {showDeleteConfirm && (
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
                onClick={handleDeleteInvoice}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <GearLoader size="w-4 h-4" />}
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

