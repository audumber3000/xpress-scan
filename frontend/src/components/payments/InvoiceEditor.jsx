import React, { useState, useEffect, useRef } from "react";
import { api } from "../../utils/api";
import { toast } from "react-toastify";
import GearLoader from "../GearLoader";
import InvoiceHeader from "./InvoiceHeader";
import InvoiceLineItems from "./InvoiceLineItems";
import InvoiceActions from "./InvoiceActions";
import MarkAsPaidModal from "./MarkAsPaidModal";

const InvoiceEditor = ({ invoiceId, onClose, onSave, prefill = null }) => {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const createDraftInvoice = async ({ patientId, appointmentId = null, notes = "", lineItems = [] }) => {
    const newInvoice = await api.post('/invoices', {
      patient_id: parseInt(patientId),
      appointment_id: appointmentId ? parseInt(appointmentId) : null,
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
    setIsCreating(false);
    setLoading(false);
    return enriched;
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

  const fetchPatients = async (query = "") => {
    try {
      setIsSearching(true);
      const data = await api.get('/appointments/search-patients', { params: { query, limit: 10 } });
      setPatients(data || []);
    } catch (error) {
      console.error("Error searching patients:", error);
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

  useEffect(() => {
    if (isCreating && patientSearch.length >= 2) {
      const timer = setTimeout(() => fetchPatients(patientSearch), 300);
      return () => clearTimeout(timer);
    } else if (isCreating && patientSearch.length === 0) {
      fetchPatients("");
    }
  }, [patientSearch, isCreating]);

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
        toast.success(`Partial payment recorded. ₹${due.toLocaleString('en-IN', { minimumFractionDigits: 2 })} still due.`);
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
    if (!window.confirm("Are you sure you want to completely delete this invoice? This action cannot be undone.")) return;
    try {
      setDeleting(true);
      await api.delete(`/invoices/${currentInvoiceId}`);
      toast.success("Invoice deleted successfully");
      if (onSave) onSave();
      onClose();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete invoice");
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

  if (loading || autoCreatingFromPrefill) {
    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={onClose} />
        <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <GearLoader size="w-8 h-8" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={onClose} />

        <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">{isCreating ? "Invoice" : "Invoice Details"}</h2>
            <button
              onClick={onClose}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Patient</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Name or Phone..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-2.5">
                        <div className="animate-spin h-5 w-5 border-2 border-[#2a276e] border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>

                {patients.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
                    <select
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                    >
                      <option value="">-- Select Patient --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.phone || 'No phone'}) - {p.visits_count || 0} visits
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex flex-col gap-4">
              <div className="flex justify-start">
                {canEdit && (
                  <button
                    onClick={handleDeleteInvoice}
                    disabled={deleting || saving}
                    className="px-4 py-2 border border-red-300 text-red-700 bg-white hover:bg-red-50 rounded-lg transition-colors text-sm font-medium flex items-center"
                  >
                    {deleting ? 'Deleting...' : 'Delete Invoice'}
                  </button>
                )}
              </div>
              <InvoiceActions
                invoice={invoice}
                onFinalize={handleFinalize}
                onMarkAsPaid={() => setShowMarkPaidModal(true)}
                onDownloadPDF={handleDownloadPDF}
                onSendWhatsApp={handleSendWhatsApp}
                canEdit={canEdit}
                downloadingPDF={downloadingPDF}
                sendingWhatsApp={sendingWhatsApp}
                finalizing={finalizing}
              />
            </div>
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
    </>
  );
};

export default InvoiceEditor;

