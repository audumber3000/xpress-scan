import React, { useState, useEffect } from 'react';
import { X, Beaker, Calendar, Search, Trash2, Plus, Info, User } from 'lucide-react';
import { api } from '../../utils/api';
import { toast } from 'react-toastify';
import { getCurrencySymbol } from '../../utils/currency';

const LabOrderDrawer = ({ isOpen, onClose, patientId, casePaperId, onSave, order = null }) => {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [patients, setPatients] = useState([]);
    const [patientSearch, setPatientSearch] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState(null);
    const [selectedPatientName, setSelectedPatientName] = useState('');
    const [showPatientDropdown, setShowPatientDropdown] = useState(false);
    const [formData, setFormData] = useState({
        vendor_id: '',
        work_type: '',
        tooth_number: '',
        shade: '',
        instructions: '',
        due_date: '',
        cost: '',
        status: 'Sent'
    });

    const isStandalone = !patientId;

    useEffect(() => {
        if (isOpen) {
            fetchVendors();
            if (isStandalone) {
                fetchPatients();
                setSelectedPatientId(null);
                setSelectedPatientName('');
                setPatientSearch('');
            }
            if (order) {
                setFormData({
                    vendor_id: order.vendor_id,
                    work_type: order.work_type,
                    tooth_number: order.tooth_number || '',
                    shade: order.shade || '',
                    instructions: order.instructions || '',
                    due_date: order.due_date ? new Date(order.due_date).toISOString().split('T')[0] : '',
                    cost: order.cost || '',
                    status: order.status
                });
            } else {
                setFormData({
                    vendor_id: '',
                    work_type: '',
                    tooth_number: '',
                    shade: '',
                    instructions: '',
                    due_date: '',
                    cost: '',
                    status: 'Sent'
                });
            }
        }
    }, [isOpen, order]);

    const fetchVendors = async () => {
        try {
            const response = await api.get('/vendors?category=lab');
            setVendors(response);
        } catch (err) {
            console.error("Failed to fetch lab vendors:", err);
            toast.error("Could not load lab vendors");
        }
    };

    const fetchPatients = async () => {
        try {
            const response = await api.get('/patients');
            setPatients(Array.isArray(response) ? response : []);
        } catch (err) {
            console.error("Failed to fetch patients:", err);
        }
    };

    const filteredPatients = patients.filter(p =>
        patientSearch.length > 0 &&
        (p.name?.toLowerCase().includes(patientSearch.toLowerCase()) ||
         p.phone?.includes(patientSearch))
    );

    const handleSelectPatient = (patient) => {
        setSelectedPatientId(patient.id);
        setSelectedPatientName(patient.name);
        setPatientSearch('');
        setShowPatientDropdown(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const resolvedPatientId = patientId || selectedPatientId;
        if (!resolvedPatientId) {
            toast.error("Please select a patient");
            return;
        }
        setLoading(true);
        try {
            const payload = {
                ...formData,
                patient_id: resolvedPatientId,
                case_paper_id: casePaperId || null
            };

            if (order) {
                await api.put(`/clinical/lab-orders/${order.id}`, payload);
                toast.success("Lab order updated");
            } else {
                await api.post('/clinical/lab-orders/', payload);
                toast.success("Lab order created");
            }
            onSave();
            onClose();
        } catch (err) {
            console.error("Failed to save lab order:", err);
            toast.error("Failed to save lab order");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />
            
            <div className="absolute inset-y-0 right-0 max-w-full flex">
                <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#2a276e]/5 rounded-lg flex items-center justify-center text-[#2a276e]">
                                <Beaker size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{order ? 'Edit Lab Order' : 'New Lab Order'}</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Fill in the lab work details below</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

                        {/* Patient Search (standalone mode only) */}
                        {isStandalone && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</label>
                                {selectedPatientId ? (
                                    <div className="flex items-center justify-between px-4 py-2.5 bg-[#2a276e]/5 border border-[#2a276e]/20 rounded-lg">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-[#2a276e]">
                                            <User size={15} />
                                            {selectedPatientName}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedPatientId(null); setSelectedPatientName(''); }}
                                            className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium"
                                        >
                                            Change
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                                        <input
                                            type="text"
                                            placeholder="Search patient by name or phone..."
                                            value={patientSearch}
                                            onChange={(e) => { setPatientSearch(e.target.value); setShowPatientDropdown(true); }}
                                            onFocus={() => setShowPatientDropdown(true)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 transition-all text-sm font-medium outline-none"
                                        />
                                        {showPatientDropdown && filteredPatients.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                                                {filteredPatients.map(p => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => handleSelectPatient(p)}
                                                        className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-0"
                                                    >
                                                        <div className="w-7 h-7 bg-[#2a276e]/5 rounded-full flex items-center justify-center text-[#2a276e] shrink-0">
                                                            <User size={13} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                                                            <p className="text-xs text-gray-500">{p.phone}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Lab Vendor */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lab Vendor</label>
                            <select
                                required
                                value={formData.vendor_id}
                                onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 transition-all text-sm font-medium outline-none"
                            >
                                <option value="">Select a laboratory...</option>
                                {vendors.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                            {vendors.length === 0 && (
                                <p className="text-xs text-orange-500 font-semibold mt-1 flex items-center gap-1">
                                    <Info size={12} /> No lab vendors found. Add one in Lab Hub.
                                </p>
                            )}
                        </div>

                        {/* Work Type */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Work Type</label>
                            <input
                                required
                                type="text"
                                placeholder="e.g. Zirconia Crown, Bridge, Denture"
                                value={formData.work_type}
                                onChange={(e) => setFormData({ ...formData, work_type: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 transition-all text-sm font-medium outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Tooth Number */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tooth No.</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 46, 21"
                                    value={formData.tooth_number}
                                    onChange={(e) => setFormData({ ...formData, tooth_number: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 transition-all text-sm font-medium outline-none"
                                />
                            </div>

                            {/* Shade */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Shade</label>
                                <input
                                    type="text"
                                    placeholder="e.g. A1, B2"
                                    value={formData.shade}
                                    onChange={(e) => setFormData({ ...formData, shade: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 transition-all text-sm font-medium outline-none"
                                />
                            </div>
                        </div>

                        {/* Due Date */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                                <input
                                    type="date"
                                    value={formData.due_date}
                                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 transition-all text-sm font-medium outline-none"
                                />
                            </div>
                        </div>

                        {/* Cost */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lab Cost ({getCurrencySymbol()})</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="e.g. 2500"
                                value={formData.cost}
                                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 transition-all text-sm font-medium outline-none"
                            />
                        </div>

                        {/* Instructions */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Instructions</label>
                            <textarea
                                rows={3}
                                placeholder="Specific details for the lab technician..."
                                value={formData.instructions}
                                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 transition-all text-sm font-medium outline-none resize-none"
                            />
                        </div>

                        {/* Status */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                            <div className="flex flex-wrap gap-2">
                                {['Draft', 'Sent', 'Received', 'Cancelled'].map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, status: s })}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                            formData.status === s 
                                                ? 'bg-[#2a276e] text-white border-[#2a276e]' 
                                                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </form>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 bg-white sticky bottom-0 z-10 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !formData.vendor_id || !formData.work_type || (isStandalone && !selectedPatientId)}
                            className="flex-[2] py-2.5 px-4 rounded-lg bg-[#2a276e] text-white text-sm font-semibold hover:bg-[#1a1548] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Saving...</span>
                                </div>
                            ) : (
                                order ? 'Update Order' : 'Create Order'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LabOrderDrawer;
