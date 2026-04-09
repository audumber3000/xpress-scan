import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { toast } from 'react-toastify';

/**
 * GenerateInvoiceDrawer - Literally copied from InvoiceEditor.jsx style
 * Handles draft invoice generation from Case Paper session state
 */
const GenerateInvoiceDrawer = ({ isOpen, onClose, patientId, draftItems = [], onSuccess, patientPhone, patientName }) => {
    const [loading, setLoading] = useState(false);
    const [lineItems, setLineItems] = useState([]);
    const [discount, setDiscount] = useState(0);
    const [notes, setNotes] = useState('');
    const [sendWhatsApp, setSendWhatsApp] = useState(true);

    useEffect(() => {
        if (isOpen) {
            if (draftItems && draftItems.length > 0) {
                setLineItems(draftItems.map(item => ({
                    description: item.description || '',
                    quantity: item.quantity || 1,
                    unit_price: item.unit_price || 0
                })));
            }
        }
    }, [isOpen, draftItems]);

    const calculateSubtotal = () => lineItems.reduce((sum, item) => sum + (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)), 0);
    const calculateTotal = () => Math.max(0, calculateSubtotal() - parseFloat(discount || 0));

    const handleSubmit = async () => {
        const validItems = lineItems.filter(item => item.description.trim() && parseFloat(item.unit_price) > 0);
        if (validItems.length === 0) {
            toast.error("Please add at least one valid line item");
            return;
        }

        setLoading(true);
        try {
            const invoice = await api.post('/invoices/', {
                patient_id: parseInt(patientId),
                notes,
                discount: parseFloat(discount || 0)
            });
            for (const item of validItems) {
                await api.post(`/invoices/${invoice.id}/line-items`, { ...item });
            }
            toast.success("Invoice generated successfully!");
            if (sendWhatsApp && patientPhone) {
                const total = calculateTotal();
                const msg = `Hello! A new invoice has been generated for your recent visit. Total: ₹${total.toLocaleString('en-IN')}. Thank you!`;
                window.open(`https://wa.me/${patientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
            }
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast.error(error.message || "Failed to generate invoice");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const todayStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="fixed inset-0 z-50">
            {/* Backdrop copied from InvoiceEditor */}
            <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={onClose} />

            {/* Main Drawer Panel copied from InvoiceEditor */}
            <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
                
                {/* Header Section (p-6 border-b border-gray-200) */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Invoice Details</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content Section (flex-1 overflow-y-auto p-6) */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    
                    {/* Invoice Header Style Clone */}
                    <div className="border-b border-gray-200 pb-6 mb-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Invoice #NEW</h2>
                                <p className="text-sm text-gray-600 mt-1">Created on {todayStr}</p>
                            </div>
                            <div>
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border bg-gray-100 text-gray-800 border-gray-200">
                                    <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                                    Draft
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-sm font-medium text-gray-700 mb-2">Bill To:</h3>
                                <div className="text-sm text-gray-900">
                                    <div className="font-semibold">{patientName || 'Patient'}</div>
                                    {patientPhone && <div className="text-gray-600">Phone: {patientPhone}</div>}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-gray-700 mb-2">Invoice Details:</h3>
                                <div className="text-sm text-gray-900 space-y-1">
                                    <div>Invoice #: NEW-INV</div>
                                    <div>Date: {todayStr}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Line Items Style Clone */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
                            <button
                                onClick={() => setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0 }])}
                                className="px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition text-sm font-medium"
                            >
                                + Add Item
                            </button>
                        </div>

                        {lineItems.length > 0 ? (
                            <div className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-300">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                            <th className="px-4 py-3 text-right w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {lineItems.map((item, index) => (
                                            <tr key={index} className="group hover:bg-gray-50/50">
                                                <td className="px-4 py-3">
                                                    <input 
                                                        className="w-full text-sm border-none focus:ring-0 p-0 font-medium text-gray-900 bg-transparent"
                                                        value={item.description}
                                                        onChange={(e) => {
                                                            const next = [...lineItems];
                                                            next[index].description = e.target.value;
                                                            setLineItems(next);
                                                        }}
                                                        placeholder="Service Name..."
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center w-16">
                                                    <input 
                                                        type="number"
                                                        className="w-full text-sm text-center border-none focus:ring-0 p-0 text-gray-600 bg-transparent"
                                                        value={item.quantity}
                                                        onChange={(e) => {
                                                            const next = [...lineItems];
                                                            next[index].quantity = e.target.value;
                                                            setLineItems(next);
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right w-24">
                                                    <input 
                                                        type="number"
                                                        className="w-full text-sm text-right border-none focus:ring-0 p-0 font-medium text-gray-600 bg-transparent"
                                                        value={item.unit_price}
                                                        onChange={(e) => {
                                                            const next = [...lineItems];
                                                            next[index].unit_price = e.target.value;
                                                            setLineItems(next);
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 w-24">
                                                    ₹{(parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)).toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={() => setLineItems(lineItems.filter((_, i) => i !== index))} className="text-gray-300 hover:text-red-500 transition-colors">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
                                <p>No line items found. Click 'Add Item' to start building this invoice.</p>
                            </div>
                        )}

                        {/* Totals Section Style Clone */}
                        <div className="border-t border-gray-200 pt-4 mt-6">
                            <div className="flex justify-end pr-4">
                                <div className="w-[300px] flex flex-col gap-2">
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Subtotal:</span>
                                        <span className="font-medium text-gray-900">₹{calculateSubtotal().toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Discount:</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-red-500">- ₹</span>
                                            <input 
                                                className="w-16 border-none focus:ring-0 p-0 text-right text-red-500 font-medium"
                                                type="number"
                                                value={discount}
                                                onChange={(e) => setDiscount(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2 mt-1">
                                        <span className="text-gray-900">Total:</span>
                                        <span className="text-[#25D366]">₹{calculateTotal().toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notes Section */}
                    <div className="mt-8">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Invoice Notes (Optional)</label>
                        <textarea 
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2a276e]/20 outline-none text-sm h-24 resize-none"
                            placeholder="Add notes for the patient..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                {/* Footer Section (p-6 border-t border-gray-200 bg-gray-50) */}
                <div className="p-6 border-t border-gray-200 bg-gray-50 flex flex-col gap-4">
                    <div className="flex justify-start">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 rounded-lg transition-colors text-sm font-medium"
                        >
                            Discard
                        </button>
                    </div>
                    
                    <button
                        onClick={handleSubmit}
                        disabled={loading || lineItems.length === 0}
                        className="w-full py-3 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition font-medium text-base shadow-sm flex items-center justify-center gap-2"
                    >
                        {loading ? 'Generating...' : 'Mark as Paid'}
                    </button>

                    <div className="flex items-center justify-center gap-2 mt-1">
                        <input 
                            type="checkbox" 
                            id="wa_check" 
                            checked={sendWhatsApp} 
                            onChange={(e) => setSendWhatsApp(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-[#25D366] focus:ring-[#25D366]"
                        />
                        <label htmlFor="wa_check" className="text-xs text-gray-600 font-medium">Send invoice copy to patient via WhatsApp</label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GenerateInvoiceDrawer;
