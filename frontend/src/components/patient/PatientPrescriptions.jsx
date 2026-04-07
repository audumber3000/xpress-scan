import React, { useState, useEffect, useRef } from 'react';
import { api } from "../../utils/api";
import { toast } from 'react-toastify';

/**
 * PatientPrescriptions - Multi-visit prescription manager with right-side detail drawer
 * Fetches from the new /reports/{patientId}/prescriptions endpoint (per-visit table)
 */
const PatientPrescriptions = ({ patientId, patientPhone, visits = [], hideHeader = false }) => {
    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isBuilding, setIsBuilding] = useState(false);
    const [selectedRx, setSelectedRx] = useState(null); // for detail drawer
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState('');

    // New prescription form state
    const [items, setItems] = useState([
        { medicine_name: '', dosage: '1-0-1', duration: '5 days', quantity: '15', notes: '' }
    ]);
    const [generalNotes, setGeneralNotes] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Medication autocomplete
    const [masterMedications, setMasterMedications] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(null);
    const [filteredMeds, setFilteredMeds] = useState([]);
    const suggestionRef = useRef(null);

    // Edit drawer state
    const [editItems, setEditItems] = useState([]);
    const [editNotes, setEditNotes] = useState('');
    const [editSaving, setEditSaving] = useState(false);

    useEffect(() => {
        fetchPrescriptions();
        fetchMasterMedications();
        const handleClickOutside = (e) => {
            if (suggestionRef.current && !suggestionRef.current.contains(e.target))
                setShowSuggestions(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [patientId]);

    const fetchPrescriptions = async () => {
        setLoading(true);
        try {
            const data = await api.get(`/reports/${patientId}/prescriptions`);
            setPrescriptions(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching prescriptions:', err);
            setPrescriptions([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchMasterMedications = async () => {
        try {
            const data = await api.get('/medications/');
            setMasterMedications(data || []);
        } catch { /* silent — autocomplete is optional */ }
    };

    // ─── New prescription helpers ────────────────────────────────────────────
    const addItem = () => setItems([...items, { medicine_name: '', dosage: '1-0-1', duration: '5 days', quantity: '15', notes: '' }]);
    const removeItem = (i) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };
    const updateItem = (i, field, value) => {
        const next = [...items];
        next[i][field] = value;
        setItems(next);
        if (field === 'medicine_name') {
            if (value.length > 1) {
                setFilteredMeds(masterMedications.filter(m => m.name.toLowerCase().includes(value.toLowerCase())));
                setShowSuggestions(i);
            } else {
                setShowSuggestions(null);
            }
        }
    };
    const selectMedication = (i, med) => {
        const next = [...items];
        next[i] = { medicine_name: med.name, dosage: med.dosage || '1-0-1', duration: med.duration || '5 days', quantity: med.quantity || '15', notes: med.notes || '' };
        setItems(next);
        setShowSuggestions(null);
    };

    const resetNewForm = () => {
        setItems([{ medicine_name: '', dosage: '1-0-1', duration: '5 days', quantity: '15', notes: '' }]);
        setGeneralNotes('');
        setSelectedAppointmentId('');
        setIsBuilding(false);
    };

    const handleSaveOnly = async () => {
        const validItems = items.filter(i => i.medicine_name.trim());
        if (!validItems.length) { toast.error('Add at least one medicine'); return; }
        setIsGenerating(true);
        try {
            const url = selectedAppointmentId
                ? `/reports/${patientId}/prescriptions/save?appointment_id=${selectedAppointmentId}`
                : `/reports/${patientId}/prescriptions/save`;
            await api.post(url, { items: validItems, notes: generalNotes });
            toast.success('Prescription saved!');
            resetNewForm();
            fetchPrescriptions();
        } catch (err) {
            toast.error(err.message || 'Failed to save prescription');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveAndGenerate = async () => {
        const validItems = items.filter(i => i.medicine_name.trim());
        if (!validItems.length) { toast.error('Add at least one medicine'); return; }
        setIsGenerating(true);
        try {
            const url = selectedAppointmentId
                ? `/reports/${patientId}/prescriptions/generate-pdf?appointment_id=${selectedAppointmentId}`
                : `/reports/${patientId}/prescriptions/generate-pdf`;
            const response = await api.post(url, { items: validItems, notes: generalNotes });
            toast.success('Prescription PDF generated!');
            if (window.confirm('View PDF?')) window.open(response.pdf_url, '_blank');
            resetNewForm();
            fetchPrescriptions();
        } catch (err) {
            toast.error(err.message || 'Failed to generate prescription');
        } finally {
            setIsGenerating(false);
        }
    };

    // ─── Drawer helpers ──────────────────────────────────────────────────────
    const openDrawer = (rx) => {
        setSelectedRx(rx);
        setEditItems(JSON.parse(JSON.stringify(rx.items || [])));
        setEditNotes(rx.notes || '');
        setDrawerOpen(true);
    };
    const closeDrawer = () => { setDrawerOpen(false); setSelectedRx(null); };

    const handleDrawerSave = async () => {
        setEditSaving(true);
        try {
            await api.put(`/reports/prescriptions/${selectedRx.id}`, { items: editItems, notes: editNotes });
            toast.success('Prescription updated!');
            closeDrawer();
            fetchPrescriptions();
        } catch (err) {
            toast.error(err.message || 'Failed to update');
        } finally { setEditSaving(false); }
    };

    const handleDrawerGeneratePdf = async () => {
        setEditSaving(true);
        try {
            // Save edits first, then generate PDF
            await api.put(`/reports/prescriptions/${selectedRx.id}`, { items: editItems, notes: editNotes });
            const url = selectedRx.appointment_id
                ? `/reports/${patientId}/prescriptions/generate-pdf?appointment_id=${selectedRx.appointment_id}`
                : `/reports/${patientId}/prescriptions/generate-pdf`;
            const res = await api.post(url, { items: editItems, notes: editNotes });
            toast.success('PDF generated!');
            window.open(res.pdf_url, '_blank');
            closeDrawer();
            fetchPrescriptions();
        } catch (err) {
            toast.error(err.message || 'Failed to generate PDF');
        } finally { setEditSaving(false); }
    };

    const handleDrawerDelete = async () => {
        if (!window.confirm('Delete this prescription? This cannot be undone.')) return;
        try {
            await api.delete(`/reports/prescriptions/${selectedRx.id}`);
            toast.success('Prescription deleted');
            closeDrawer();
            fetchPrescriptions();
        } catch (err) {
            toast.error(err.message || 'Failed to delete');
        }
    };

    const handleDrawerWhatsApp = () => {
        if (!patientPhone) { toast.error('Patient phone number not available'); return; }
        if (!selectedRx?.pdf_url) { toast.error('Generate a PDF first to share via WhatsApp'); return; }
        const msg = `Hello, here is your prescription: ${selectedRx.pdf_url}`;
        window.open(`https://wa.me/${patientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">

            {/* Header */}
            {!hideHeader && (
                <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-[#2a276e]">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-2-2H6.572a2 2 0 00-2 2v2a2 2 0 002 2h10.856a2 2 0 002-2v-2zM15 11V5a2 2 0 00-2-2H9a2 2 0 00-2 2v6" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Medical Prescriptions</h3>
                            <p className="text-xs text-gray-400">{prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''} across all visits</p>
                        </div>
                    </div>
                    {!isBuilding ? (
                        <button onClick={() => setIsBuilding(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#2a276e] text-white rounded-xl font-bold text-sm hover:bg-[#1a1548] transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            New Prescription
                        </button>
                    ) : (
                        <button onClick={resetNewForm}
                            className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all">
                            Cancel
                        </button>
                    )}
                </div>
            )}

            {/* New Prescription Form */}
            {!hideHeader && isBuilding && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-[#2a276e]/5 border-b border-gray-100">
                        <h4 className="font-semibold text-[#2a276e]">New Prescription</h4>
                        {/* Optional visit link */}
                        {visits.length > 0 && (
                            <div className="mt-2">
                                <label className="text-xs text-gray-500 font-medium">Link to visit (optional)</label>
                                <select value={selectedAppointmentId} onChange={e => setSelectedAppointmentId(e.target.value)}
                                    className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20">
                                    <option value="">-- Not linked to visit --</option>
                                    {visits.map(v => (
                                        <option key={v.id} value={v.id}>
                                            Visit {v.visit_number} — {v.appointment_date} {v.treatment ? `(${v.treatment})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="p-6">
                        <div className="overflow-visible border border-gray-200 rounded-2xl overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-[#2a276e]/5 border-b border-[#2a276e]/10">
                                    <tr className="text-left text-xs font-bold text-[#2a276e] uppercase tracking-wider">
                                        <th className="py-3 px-4">Medicine Name</th>
                                        <th className="py-3 px-4 w-32">Dosage</th>
                                        <th className="py-3 px-4 w-32">Duration</th>
                                        <th className="py-3 px-4 w-24">Qty</th>
                                        <th className="py-3 px-4">Instructions</th>
                                        <th className="py-3 px-4 w-12 text-center">Act</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50" ref={suggestionRef}>
                                    {items.map((item, i) => (
                                        <tr key={i} className="relative">
                                            <td className="py-2 px-2">
                                                <div className="relative">
                                                    <input value={item.medicine_name} onChange={e => updateItem(i, 'medicine_name', e.target.value)}
                                                        placeholder="Search medicine..."
                                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20" />
                                                    {showSuggestions === i && filteredMeds.length > 0 && (
                                                        <div className="absolute top-full left-0 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-40 overflow-y-auto">
                                                            {filteredMeds.map((med, mi) => (
                                                                <button key={mi} onClick={() => selectMedication(i, med)}
                                                                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#2a276e]/5 flex items-center gap-2">
                                                                    <span className="font-medium text-gray-800">{med.name}</span>
                                                                    <span className="text-xs text-gray-400">{med.dosage}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-2 px-2">
                                                <select value={item.dosage} onChange={e => updateItem(i, 'dosage', e.target.value)}
                                                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20">
                                                    {['1-0-1','1-1-1','0-0-1','1-0-0','0-1-0','SOS','1-1-0','0-1-1'].map(d => <option key={d}>{d}</option>)}
                                                </select>
                                            </td>
                                            <td className="py-2 px-2">
                                                <select value={item.duration} onChange={e => updateItem(i, 'duration', e.target.value)}
                                                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20">
                                                    {['3 days','5 days','7 days','10 days','14 days','21 days','1 month','2 months','3 months','Ongoing'].map(d => <option key={d}>{d}</option>)}
                                                </select>
                                            </td>
                                            <td className="py-2 px-2">
                                                <input type="number" value={item.quantity} min="1"
                                                    onChange={e => updateItem(i, 'quantity', e.target.value)}
                                                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20" />
                                            </td>
                                            <td className="py-2 px-2">
                                                <input value={item.notes} onChange={e => updateItem(i, 'notes', e.target.value)}
                                                    placeholder="Food, timing notes..."
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20" />
                                            </td>
                                            <td className="py-2 px-2">
                                                <button onClick={() => removeItem(i)}
                                                    className="w-8 h-8 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-colors">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="hover:bg-gray-50/50 transition-colors">
                                        <td colSpan="6" className="py-3 px-4">
                                            <button onClick={addItem}
                                                className="flex items-center gap-2 text-sm text-[#2a276e] font-bold hover:text-[#1a1548] transition-colors">
                                                <div className="w-6 h-6 rounded-full bg-[#2a276e]/10 flex items-center justify-center">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                                                </div>
                                                Add Medication
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4">
                            <label className="text-xs font-medium text-gray-500">General Instructions</label>
                            <textarea value={generalNotes} onChange={e => setGeneralNotes(e.target.value)}
                                rows={2} placeholder="e.g. Take after meals, drink plenty of water..."
                                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20" />
                        </div>

                        <div className="mt-5 flex gap-3 pt-4 border-t border-gray-100">
                            <button onClick={handleSaveOnly} disabled={isGenerating}
                                className="flex-1 py-2.5 border-2 border-[#2a276e] text-[#2a276e] rounded-xl font-semibold text-sm hover:bg-[#2a276e]/5 transition-all disabled:opacity-50">
                                {isGenerating ? 'Saving...' : 'Save Only'}
                            </button>
                            <button onClick={handleSaveAndGenerate} disabled={isGenerating}
                                className="flex-1 py-2.5 bg-[#2a276e] text-white rounded-xl font-semibold text-sm hover:bg-[#1a1548] transition-all disabled:opacity-50">
                                {isGenerating ? 'Generating...' : 'Save & Generate PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prescriptions list */}
            {loading ? (
                <div className="flex items-center justify-center h-32 text-gray-400">
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-[#2a276e] rounded-full animate-spin mr-3"></div>
                    <span className="text-sm font-medium">Loading prescriptions...</span>
                </div>
            ) : prescriptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400">
                    <FileText size={40} className="mb-2 opacity-20" />
                    <p className="text-sm font-medium">No prescriptions found for this patient.</p>
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visit</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medicines</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {prescriptions.map(rx => (
                                <tr key={rx.id} className="hover:bg-gray-50 transition-colors cursor-pointer group" onClick={() => openDrawer(rx)}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                        {formatDate(rx.created_at)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {rx.visit_number ? `Visit #${rx.visit_number}` : '—'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            {rx.items?.map((m, mi) => (
                                                <span key={mi} className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10px] font-bold border border-gray-200">
                                                    {m.medicine_name}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); openDrawer(rx); }}
                                            className="text-[#2a276e] hover:text-[#1a1548] font-bold"
                                        >
                                            View / Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}


            {/* Right Drawer — Prescription Detail & Edit */}
            <div className={`fixed inset-0 z-50 ${drawerOpen ? 'visible' : 'invisible'}`}>
                {/* Backdrop */}
                <div className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
                    onClick={closeDrawer} />

                {/* Drawer panel */}
                <div className={`absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                    {/* Drawer header */}
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Prescription</h2>
                            {selectedRx && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {formatDate(selectedRx.created_at)}
                                    {selectedRx.visit_number ? ` · Visit ${selectedRx.visit_number}` : ''}
                                </p>
                            )}
                        </div>
                        <button onClick={closeDrawer} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {/* Drawer body */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                        {/* Medicines table (editable) */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-gray-700">Medicines</h4>
                                <button onClick={() => setEditItems([...editItems, { medicine_name: '', dosage: '1-0-1', duration: '5 days', quantity: '15', notes: '' }])}
                                    className="text-xs text-[#2a276e] font-medium hover:underline">+ Add Row</button>
                            </div>
                            <div className="space-y-2">
                                {editItems.map((item, i) => (
                                    <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center">
                                        <input value={item.medicine_name} onChange={e => { const n=[...editItems];n[i].medicine_name=e.target.value;setEditItems(n); }}
                                            placeholder="Medicine name"
                                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20" />
                                        <select value={item.dosage} onChange={e => { const n=[...editItems];n[i].dosage=e.target.value;setEditItems(n); }}
                                            className="px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20">
                                            {['1-0-1','1-1-1','0-0-1','1-0-0','0-1-0','SOS','1-1-0','0-1-1'].map(d=><option key={d}>{d}</option>)}
                                        </select>
                                        <select value={item.duration} onChange={e => { const n=[...editItems];n[i].duration=e.target.value;setEditItems(n); }}
                                            className="px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20">
                                            {['3 days','5 days','7 days','10 days','14 days','21 days','1 month','Ongoing'].map(d=><option key={d}>{d}</option>)}
                                        </select>
                                        <input type="number" min="1" value={item.quantity} onChange={e => { const n=[...editItems];n[i].quantity=e.target.value;setEditItems(n); }}
                                            className="px-2 py-2 text-xs border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20" />
                                        <button onClick={() => setEditItems(editItems.filter((_,idx)=>idx!==i))}
                                            className="w-7 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">General Instructions</label>
                            <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                                rows={3} placeholder="Instructions, dietary notes..."
                                className="mt-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20" />
                        </div>

                        {/* PDF link if available */}
                        {selectedRx?.has_pdf && selectedRx?.pdf_url && (
                            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                <span className="text-sm text-green-700 font-medium flex-1">PDF has been generated for this prescription</span>
                                <a href={selectedRx.pdf_url} target="_blank" rel="noopener noreferrer"
                                    className="text-sm text-green-600 font-bold hover:underline">View PDF →</a>
                            </div>
                        )}
                    </div>

                    {/* Drawer actions */}
                    <div className="px-6 py-4 border-t border-gray-100 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleDrawerSave} disabled={editSaving}
                                className="py-2.5 border-2 border-[#2a276e] text-[#2a276e] rounded-xl font-semibold text-sm hover:bg-[#2a276e]/5 transition-all disabled:opacity-50">
                                {editSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button onClick={handleDrawerGeneratePdf} disabled={editSaving}
                                className="py-2.5 bg-[#2a276e] text-white rounded-xl font-semibold text-sm hover:bg-[#1a1548] transition-all disabled:opacity-50">
                                Generate PDF
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleDrawerWhatsApp}
                                className="py-2.5 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-600 transition-all flex items-center justify-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/></svg>
                                WhatsApp
                            </button>
                            <button onClick={handleDrawerDelete}
                                className="py-2.5 bg-red-50 text-red-500 rounded-xl font-semibold text-sm hover:bg-red-100 transition-all border border-red-100">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PatientPrescriptions;
