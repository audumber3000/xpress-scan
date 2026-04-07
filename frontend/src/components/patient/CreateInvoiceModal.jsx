import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { toast } from 'react-toastify';

const CreateInvoiceModal = ({ isOpen, onClose, patientId, appointments = [], onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [appointmentId, setAppointmentId] = useState('');
    const [notes, setNotes] = useState('');
    const [lineItems, setLineItems] = useState([
        { description: '', quantity: 1, unit_price: 0 }
    ]);

    if (!isOpen) return null;

    const handleAddLineItem = () => {
        setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0 }]);
    };

    const handleRemoveLineItem = (index) => {
        if (lineItems.length === 1) {
            toast.warn("At least one line item is required");
            return;
        }
        setLineItems(lineItems.filter((_, i) => i !== index));
    };

    const handleLineItemChange = (index, field, value) => {
        const newLineItems = [...lineItems];
        newLineItems[index][field] = value;
        setLineItems(newLineItems);
    };

    const calculateTotal = () => {
        return lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        if (lineItems.some(item => !item.description || item.unit_price <= 0)) {
            toast.error("Please fill in all line item descriptions and valid prices");
            return;
        }

        setLoading(true);
        try {
            // 1. Create the invoice
            const invoiceData = {
                patient_id: parseInt(patientId),
                appointment_id: appointmentId ? parseInt(appointmentId) : null,
                notes: notes
            };
            
            const invoice = await api.post('/invoices/', invoiceData);
            
            // 2. Add line items to the invoice
            for (const item of lineItems) {
                await api.post(`/invoices/${invoice.id}/line-items`, {
                    description: item.description,
                    quantity: parseFloat(item.quantity),
                    unit_price: parseFloat(item.unit_price)
                });
            }

            // 3. Optional: Mark as paid if needed? 
            // For now let's just create it as draft as per backend logic.
            // The user said "this billing will be reflected in payments".
            // In this system, marking as paid creates a payment or updates status.
            
            toast.success("Billing created successfully!");
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to create billing:", error);
            toast.error(error.message || "Failed to create billing");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Create New Billing</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Add services and items for this patient</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Appointment Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Linked Visit (Optional)</label>
                            <select
                                value={appointmentId}
                                onChange={(e) => setAppointmentId(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#2a276e] focus:border-transparent outline-none text-sm transition-all"
                            >
                                <option value="">Select a visit</option>
                                {appointments.map((apt) => (
                                    <option key={apt.id} value={apt.id}>
                                        {new Date(apt.date).toLocaleDateString()} - {apt.procedure} ({apt.doctor})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Date</label>
                            <input
                                type="text"
                                value={new Date().toLocaleDateString()}
                                disabled
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-sm outline-none"
                            />
                        </div>
                    </div>

                    {/* Line Items */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-bold text-gray-700">Services & Items</label>
                            <button
                                type="button"
                                onClick={handleAddLineItem}
                                className="text-xs font-bold text-[#2a276e] hover:underline flex items-center gap-1"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                                </svg>
                                Add Item
                            </button>
                        </div>
                        
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {lineItems.map((item, index) => (
                                <div key={index} className="flex gap-3 items-start animate-in slide-in-from-left-2 duration-200">
                                    <div className="flex-1">
                                        <input
                                            placeholder="Description (e.g. Cleaning, Filling)"
                                            value={item.description}
                                            onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#2a276e] outline-none text-sm"
                                            required
                                        />
                                    </div>
                                    <div className="w-20">
                                        <input
                                            type="number"
                                            placeholder="Qty"
                                            value={item.quantity}
                                            min="0.1"
                                            step="0.1"
                                            onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#2a276e] outline-none text-sm"
                                            required
                                        />
                                    </div>
                                    <div className="w-32">
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                                            <input
                                                type="number"
                                                placeholder="Price"
                                                value={item.unit_price}
                                                min="0"
                                                onChange={(e) => handleLineItemChange(index, 'unit_price', e.target.value)}
                                                className="w-full pl-7 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#2a276e] outline-none text-sm"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveLineItem(index)}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Notes</label>
                        <textarea
                            placeholder="Additional notes for this billing..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows="2"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#2a276e] outline-none text-sm transition-all resize-none"
                        ></textarea>
                    </div>

                    {/* Total & Submit */}
                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="text-gray-500">
                            <span className="text-sm">Total Amount:</span>
                            <span className="ml-2 text-2xl font-black text-gray-900">₹{calculateTotal().toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-2.5 rounded-xl bg-[#2a276e] text-white font-bold hover:bg-[#1a1548] transition-all shadow-lg shadow-blue-900/10 disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Creating...
                                    </>
                                ) : (
                                    'Create Billing'
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateInvoiceModal;
