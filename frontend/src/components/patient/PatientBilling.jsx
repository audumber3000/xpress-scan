import React, { useState } from 'react';
import { api } from "../../utils/api";
import { toast } from 'react-toastify';
import { getCurrencySymbol } from '../../utils/currency';
import { Eye, MessageCircle } from 'lucide-react';
import InvoiceEditor from '../payments/InvoiceEditor';

/**
 * PatientBilling - Simplified billing tab following standard app table styling
 */
const PatientBilling = ({ 
    invoices = [], 
    payments = [], 
    patientId, 
    appointments = [], 
    refreshInvoices,
    refreshPayments 
}) => {
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
    const [sendingWhatsApp, setSendingWhatsApp] = useState(null);

    const handleSendWhatsApp = async (invoiceId) => {
        setSendingWhatsApp(invoiceId);
        try {
            await api.post(`/invoices/${invoiceId}/send-whatsapp`);
            toast.success("Invoice sent successfully via WhatsApp");
        } catch (error) {
            console.error("WhatsApp error:", error);
            toast.error(error.response?.data?.detail || "Failed to send invoice via WhatsApp");
        } finally {
            setSendingWhatsApp(null);
        }
    };

    const getStatusStyle = (status) => {
        switch (status?.toLowerCase()) {
            case 'finalized':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'partially_paid':
                return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'paid_verified':
            case 'paid':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'paid_unverified':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'draft':
                return 'bg-gray-100 text-gray-700 border-gray-200';
            default:
                return 'bg-gray-50 text-gray-600 border-gray-100';
        }
    };

    return (
        <div className="space-y-8">
            {/* Main Billing Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Billing History</h3>
                        <p className="text-sm text-gray-500 mt-0.5">View and manage finalized patient invoices</p>
                    </div>
                    <button 
                        onClick={() => setSelectedInvoiceId('new')}
                        className="bg-[#2a276e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm"
                    >
                        + Add Billing
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {invoices.length > 0 ? (
                                invoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                            {inv.invoice_number}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 font-medium">
                                                {inv.line_items?.[0]?.description || 'Dental Services'}
                                                {inv.line_items?.length > 1 && <span className="text-gray-400 ml-1">(+{inv.line_items.length - 1})</span>}
                                            </div>
                                            {inv.appointment_id && (
                                                <div className="text-[10px] text-gray-400 italic">Linked to Visit #{inv.appointment_id}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(inv.created_at).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusStyle(inv.status)}`}>
                                                {inv.status?.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                                            {getCurrencySymbol()}{parseFloat(inv.total || 0).toLocaleString('en-US')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-3 text-gray-400">
                                                <button onClick={() => setSelectedInvoiceId(inv.id)} title="Open" className="hover:text-[#2a276e] transition-colors"><Eye size={18} /></button>
                                                {inv.status !== 'draft' && (
                                                    <button 
                                                        onClick={() => handleSendWhatsApp(inv.id)} 
                                                        disabled={sendingWhatsApp === inv.id}
                                                        title="WhatsApp" 
                                                        className={`hover:text-[#25D366] transition-colors ${sendingWhatsApp === inv.id ? 'animate-pulse' : ''}`}
                                                    >
                                                        <MessageCircle size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-400 italic">
                                        No invoices found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Manual Payment Log (Simple Table) */}
            {payments.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <div className="w-1 h-3 bg-gray-300 rounded-full"></div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Manual Payment Log</h4>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {payments.map(p => (
                                    <tr key={p.id}>
                                        <td className="px-6 py-3 text-sm text-gray-600">{p.procedure}</td>
                                        <td className="px-6 py-3 text-xs text-gray-400">{p.date}</td>
                                        <td className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{getCurrencySymbol()}{p.amount.toLocaleString('en-US')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedInvoiceId && (
                <InvoiceEditor
                    invoiceId={selectedInvoiceId}
                    onClose={() => setSelectedInvoiceId(null)}
                    onSave={() => {
                        setSelectedInvoiceId(null);
                        if (refreshInvoices) refreshInvoices();
                        if (refreshPayments) refreshPayments();
                    }}
                    prefill={selectedInvoiceId === 'new' ? { patientId } : null}
                />
            )}

            {/* preserve existing refresh callback behavior */}
            <div className="hidden" onClick={() => {
                    if (refreshInvoices) refreshInvoices();
                    if (refreshPayments) refreshPayments();
                }} />
        </div>
    );
};

export default PatientBilling;
