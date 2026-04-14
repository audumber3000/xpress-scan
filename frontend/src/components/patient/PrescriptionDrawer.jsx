import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { api } from "../../utils/api";
import { useAuth } from '../../contexts/AuthContext';

const PrescriptionDrawer = ({ isOpen, onClose, onSave, patientId, patientData, initialData }) => {
    const { user } = useAuth();
    const [mode, setMode] = useState('edit');
    const [items, setItems] = useState([
        { medicine_name: '', dosage: '1-0-1', duration: '5 days', quantity: '15', notes: '' }
    ]);
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [doctorSignature, setDoctorSignature] = useState(null);
    
    // Autocomplete state
    const [masterMedications, setMasterMedications] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(null);
    const [filteredMeds, setFilteredMeds] = useState([]);
    const suggestionRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setMode(initialData ? 'preview' : 'edit');
            if (initialData) {
                setItems(JSON.parse(JSON.stringify(initialData.items || [])));
                setNotes(initialData.notes || '');
            } else {
                setItems([{ medicine_name: '', dosage: '1-0-1', duration: '5 days', quantity: '15', notes: '' }]);
                setNotes('');
            }
            fetchMasterMedications();
            fetchDoctorSignature();
        }
    }, [isOpen, initialData]);

    const fetchMasterMedications = async () => {
        try {
            const data = await api.get('/medications/');
            setMasterMedications(data || []);
        } catch { /* silent */ }
    };

    const fetchDoctorSignature = async () => {
        try {
            const data = await api.get('/auth/me');
            if (data?.signature_url) setDoctorSignature(data.signature_url);
        } catch { /* silent */ }
    };

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
        next[i] = { 
            medicine_name: med.name, 
            dosage: med.dosage || '1-0-1', 
            duration: med.duration || '5 days', 
            quantity: med.quantity || '15', 
            notes: med.notes || '' 
        };
        setItems(next);
        setShowSuggestions(null);
    };

    const handleSave = async () => {
        const validItems = items.filter(i => i.medicine_name.trim());
        if (!validItems.length) return;
        
        setIsLoading(true);
        try {
            await onSave({ items: validItems, notes });
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    const doctorName = user?.name || user?.email?.split('@')[0] || 'Doctor';
    const clinicName = user?.clinic?.name || 'MolarPlus Dental Clinic';
    const clinicPhone = user?.clinic?.phone || '';
    const clinicAddress = user?.clinic?.address || '';
    const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const primaryColor = user?.clinic?.primary_color || '#1a2a6c';

    const downloadPrescriptionPdf = () => {
        const validItems = items.filter(i => i.medicine_name.trim());
        const logoUrl = user?.clinic?.logo_url;
        const clinicTagline = user?.clinic?.tagline || 'Comprehensive Clinical Care';
        const doctorReg = user?.clinic?.reg_number || '';
        const patientData_local = patientData;

        // Parse structured notes (mirrors backend engine logic)
        let ccText = '', dxText = '', nextVisit = '', adviceLines = [];
        notes.split('\n').forEach(line => {
            const l = line.trim();
            const ll = l.toLowerCase();
            if (!l) return;
            if (ll.startsWith('cc:') || ll.startsWith('chief complaint:')) ccText = l.replace(/^[^:]+:\s*/, '');
            else if (ll.startsWith('dx:') || ll.startsWith('diagnosis:')) dxText = l.replace(/^[^:]+:\s*/, '');
            else if (ll.startsWith('next visit:') || ll.startsWith('follow up:') || ll.startsWith('next appointment:')) nextVisit = l.replace(/^[^:]+:\s*/, '');
            else if (ll.startsWith('advice:') || ll.startsWith('instructions:')) adviceLines.push(l.replace(/^[^:]+:\s*/, ''));
            else adviceLines.push(l);
        });

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Prescription - ${patientData?.name || 'Patient'}</title>
    <style>
        :root { --primary-color: ${primaryColor}; --text-main: #333; --text-muted: #555; --border-light: #ddd; --table-header-bg: #f8fafc; --highlight-bg: #f0f4f8; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: var(--text-main); line-height: 1.3; background: #fff; margin: 0; padding: 0; font-size: 13px; }
        .prescription-container { width: 100%; background: #fff; }
        .color-strip { height: 10px; background-color: var(--primary-color); }
        .prescription-body { padding: 40px 50px 200px 50px; }
        .footer-wrapper { position: fixed; bottom: 0; left: 0; right: 0; background: white; padding: 0 50px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--border-light); padding-bottom: 15px; margin-bottom: 15px; }
        .header-left { display: flex; align-items: center; }
        .clinic-info-left h1 { margin: 0; color: var(--primary-color); text-transform: uppercase; letter-spacing: 1px; font-size: 24px; line-height: 1.1; }
        .clinic-info-left .tagline { margin: 3px 0; font-size: 16px; color: var(--primary-color); font-weight: bold; }
        .clinic-info-right { text-align: right; }
        .clinic-info-right .doc-name { font-size: 14px; font-weight: bold; color: var(--primary-color); margin: 0 0 4px 0; }
        .clinic-info-right p { margin: 2px 0; font-size: 11px; color: var(--text-muted); font-weight: 500; }
        .prescription-title { text-align: center; font-size: 18px; font-weight: bold; margin: 10px 0 15px 0; color: var(--text-main); text-decoration: underline; letter-spacing: 2px; }
        .patient-box { background: var(--highlight-bg); padding: 10px 12px; border-radius: 5px; border: 1px solid var(--border-light); margin-bottom: 15px; }
        .info-table { width: 100%; border-collapse: collapse; }
        .info-table td { vertical-align: top; width: 33%; padding: 2px 4px; }
        .info-table p { margin: 3px 0; font-size: 12px; }
        .info-table strong { display: inline-block; min-width: 90px; color: var(--primary-color); }
        .clinical-notes { margin-bottom: 12px; }
        .clinical-notes h4 { margin: 0 0 3px 0; color: var(--primary-color); font-size: 13px; }
        .clinical-notes p { margin: 0 0 8px 0; font-size: 13px; }
        .rx-symbol { font-size: 32px; font-weight: bold; color: var(--primary-color); margin-bottom: 8px; line-height: 1; font-family: serif; }
        .med-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .med-table th, .med-table td { border: 1px solid var(--border-light); padding: 7px 9px; text-align: center; }
        .med-table th { background-color: var(--table-header-bg); color: var(--primary-color); font-weight: bold; font-size: 11px; }
        .med-table .text-left { text-align: left; }
        .med-name { font-weight: bold; font-size: 13px; color: var(--text-main); }
        .med-composition { font-size: 10px; color: var(--text-muted); display: block; margin-top: 2px; font-style: italic; }
        .advice-section { margin-bottom: 10px; }
        .advice-section h4 { color: var(--primary-color); margin: 0 0 5px 0; text-transform: uppercase; font-size: 12px; }
        .advice-section ul { margin: 0; padding-left: 20px; }
        .advice-section li { margin-bottom: 4px; font-size: 12px; }
        .footer { font-size: 11px; color: #666; margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid var(--border-light); padding-top: 15px; }
        .terms { width: 65%; }
        .terms h4 { margin-bottom: 4px; color: var(--primary-color); text-transform: uppercase; }
        .terms ul { padding-left: 15px; margin: 0 0 8px 0; }
        .terms li { margin-bottom: 2px; }
        .follow-up { font-size: 13px; font-weight: bold; color: #d32f2f; margin-top: 8px; }
        .signature-box { width: 30%; text-align: center; }
        .signature-line { border-top: 1px solid var(--text-main); margin-top: 40px; padding-top: 5px; font-weight: bold; color: var(--primary-color); font-size: 12px; }
    </style>
</head>
<body>
<div class="prescription-container">
    <div class="color-strip"></div>
    <div class="prescription-body">
        <div class="header">
            <div class="header-left">
                <div style="margin-right:20px;flex-shrink:0;">
                    ${logoUrl ? `<img src="${logoUrl}" style="width:75px;height:75px;object-fit:contain;">` : `<div style="width:75px;height:75px;background:#f0f4f8;border:2px dashed ${primaryColor};display:flex;justify-content:center;align-items:center;color:${primaryColor};font-weight:bold;font-size:12px;text-align:center;">${clinicName.slice(0,2).toUpperCase()}</div>`}
                </div>
                <div class="clinic-info-left">
                    <h1>${clinicName}</h1>
                    ${clinicTagline ? `<div class="tagline">${clinicTagline}</div>` : ''}
                </div>
            </div>
            <div class="clinic-info-right">
                <div class="doc-name">${doctorName}</div>
                ${clinicAddress ? `<p>${clinicAddress}</p>` : ''}
                ${clinicPhone ? `<p>📞 ${clinicPhone}</p>` : ''}
                ${user?.email ? `<p>✉️ ${user.email}</p>` : ''}
                ${doctorReg ? `<p>Reg No: ${doctorReg}</p>` : ''}
            </div>
        </div>

        <div class="prescription-title">PRESCRIPTION</div>

        <div class="patient-box">
            <table class="info-table">
                <tr>
                    <td>
                        <p><strong>Patient Name:</strong> ${patientData_local?.name || '—'}</p>
                        <p><strong>Patient ID:</strong> ${patientData_local?.display_id || patientData_local?.id || '—'}</p>
                    </td>
                    <td>
                        <p><strong>Age / Sex:</strong> ${patientAge || '—'} / ${patientData_local?.gender || '—'}</p>
                        <p><strong>Date:</strong> ${today}</p>
                    </td>
                    <td>
                        <p><strong>Contact:</strong> ${patientData_local?.phone || '—'}</p>
                    </td>
                </tr>
            </table>
        </div>

        ${ccText ? `<div class="clinical-notes"><h4>Chief Complaint (C/O):</h4><p>${ccText}</p></div>` : ''}
        ${dxText ? `<div class="clinical-notes"><h4>Diagnosis:</h4><p>${dxText}</p></div>` : ''}

        <div class="rx-symbol">&#8478;</div>
        <table class="med-table">
            <thead>
                <tr>
                    <th style="width:30px;">S.No.</th>
                    <th class="text-left" style="width:40%;">Medicine Name</th>
                    <th style="width:80px;">Dosage<br><small>(M-A-N)</small></th>
                    <th style="width:70px;">Duration</th>
                    <th>Instructions</th>
                </tr>
            </thead>
            <tbody>
                ${validItems.map((it, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td class="text-left">
                        <span class="med-name">${it.medicine_name}</span>
                        ${it.notes ? `<span class="med-composition">(${it.notes})</span>` : ''}
                    </td>
                    <td>${it.dosage}</td>
                    <td>${it.duration}</td>
                    <td>${it.instructions || it.quantity || '—'}</td>
                </tr>`).join('')}
            </tbody>
        </table>

        ${adviceLines.length ? `<div class="advice-section"><h4>Instructions / Advice:</h4><ul>${adviceLines.map(l => `<li>${l}</li>`).join('')}</ul></div>` : ''}

    </div>

    <div class="footer-wrapper">
        <div class="footer">
            <div class="terms">
                <h4>Terms &amp; Conditions</h4>
                <ul>
                    <li>This prescription is valid for 7 days from the date of issue.</li>
                    <li>Medicines must be taken strictly as directed. Do not alter the dosage without consulting the doctor.</li>
                    <li>Complete the full course of antibiotics even if symptoms subside early.</li>
                    <li>In case of any allergic reaction or adverse effects, stop medication and contact the clinic immediately.</li>
                    <li>This prescription is issued for the named patient only and is non-transferable.</li>
                    <li>This is a computer-generated prescription and does not require a physical signature.</li>
                </ul>
                ${nextVisit ? `<p class="follow-up">Next Appointment: ${nextVisit}</p>` : ''}
            </div>
            <div class="signature-box">
                <div class="signature-line">${doctorName} / Signature</div>
                <p style="margin:5px 0 0 0;color:var(--text-muted);font-weight:bold;">${clinicName}</p>
            </div>
        </div>
        <div class="color-strip"></div>
    </div>
</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) win.onafterprint = () => URL.revokeObjectURL(url);
    };

    const sendOnWhatsApp = async () => {
        if (!initialData?.id) {
            alert("Please save the prescription before sharing via WhatsApp.");
            return;
        }
        
        setIsLoading(true);
        try {
            await api.post(`/clinical/prescriptions/${initialData.id}/send-whatsapp`);
            alert("Prescription sharing initiated via WhatsApp! Please check the recipient's phone.");
        } catch (error) {
            console.error("WhatsApp error:", error);
            alert(error.detail || error.message || "Failed to share prescription via WhatsApp.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const validItems = items.filter(i => i.medicine_name.trim());
    const patientAge = patientData?.dob
        ? new Date().getFullYear() - new Date(patientData.dob).getFullYear()
        : patientData?.age || null;

    return (
        <>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] transition-opacity" onClick={onClose}></div>
            <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-[70] transform transition-transform duration-300 flex flex-col translate-x-0">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">{initialData ? 'Edit Prescription' : 'New Prescription'}</h2>
                    <div className="flex items-center gap-3">
                        {/* Mode tabs */}
                        <div className="flex bg-gray-100 rounded-xl p-1 text-sm font-semibold">
                            <button onClick={() => setMode('edit')} className={`px-4 py-1.5 rounded-lg transition-all ${mode === 'edit' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                                Edit
                            </button>
                            <button onClick={() => setMode('preview')} className={`px-4 py-1.5 rounded-lg transition-all ${mode === 'preview' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                                Preview
                            </button>
                        </div>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Preview Mode */}
                {mode === 'preview' && (
                    <>
                        <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
                            <div className="bg-white shadow-lg min-h-[700px] flex flex-col">
                                <div style={{ height: '8px', backgroundColor: primaryColor }}></div>
                                <div className="p-8 flex-1 flex flex-col">
                                    {/* Letterhead Preview */}
                                    <div className="flex justify-between items-start border-b-2 border-gray-100 pb-4 mb-4">
                                        <div className="flex items-center gap-4">
                                            {user?.clinic?.logo_url ? (
                                                <img src={user.clinic.logo_url} className="w-16 h-16 object-contain" />
                                            ) : (
                                                <div className="w-16 h-16 bg-gray-50 border-2 border-dashed rounded-lg flex items-center justify-center text-xs font-bold text-gray-400" style={{ borderColor: primaryColor, color: primaryColor }}>{clinicName.slice(0,2).toUpperCase()}</div>
                                            )}
                                            <div>
                                                <h1 className="text-xl font-black uppercase tracking-tight" style={{ color: primaryColor }}>{clinicName}</h1>
                                                <p className="text-xs font-bold opacity-70" style={{ color: primaryColor }}>{user?.clinic?.tagline || 'Comprehensive Clinical Care'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold" style={{ color: primaryColor }}>Dr. {doctorName}</p>
                                            <p className="text-[10px] text-gray-500 max-w-[180px] ml-auto">{clinicAddress}</p>
                                            <p className="text-[10px] text-gray-600 font-medium whitespace-pre-wrap">☎ {clinicPhone}\n✉ {user?.email || ''}\n{user?.clinic?.reg_number ? `Reg No: ${user.clinic.reg_number}` : ''}</p>
                                        </div>
                                    </div>

                                    <div className="text-center mb-6">
                                        <span className="text-sm font-black tracking-[4px] uppercase border-b-2 border-gray-900 pb-1">Prescription</span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-100 mb-6">
                                        <div>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase">Patient</p>
                                            <p className="text-xs font-bold text-gray-900">{patientData?.name || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase">Age / Sex</p>
                                            <p className="text-xs font-bold text-gray-900">{patientAge || '—'} / {patientData?.gender || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase">Date</p>
                                            <p className="text-xs font-bold text-gray-900">{today}</p>
                                        </div>
                                    </div>

                                    <div className="mb-2 text-2xl font-serif font-black" style={{ color: primaryColor }}>&#8478;</div>

                                    <table className="w-full text-xs mb-6 border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="border border-gray-200 p-2 text-left w-6">#</th>
                                                <th className="border border-gray-200 p-2 text-left">Medicine</th>
                                                <th className="border border-gray-200 p-2">Dosage</th>
                                                <th className="border border-gray-200 p-2">Duration</th>
                                                <th className="border border-gray-200 p-2">Instructions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {validItems.length > 0 ? validItems.map((it, idx) => (
                                                <tr key={idx}>
                                                    <td className="border border-gray-100 p-2 text-gray-400 text-[10px] text-center">{idx + 1}</td>
                                                    <td className="border border-gray-100 p-2">
                                                        <span className="font-bold block">{it.medicine_name}</span>
                                                        {it.notes && <span className="text-[10px] text-gray-400 italic">({it.notes})</span>}
                                                    </td>
                                                    <td className="border border-gray-100 p-2 text-center font-medium">{it.dosage}</td>
                                                    <td className="border border-gray-100 p-2 text-center">{it.duration}</td>
                                                    <td className="border border-gray-100 p-2 text-[10px] text-gray-500">{it.instructions || it.quantity || '—'}</td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan="5" className="p-8 text-center text-gray-400 italic">No medications added</td></tr>
                                            )}
                                        </tbody>
                                    </table>

                                    <div className="flex-1">
                                        {notes && (
                                            <div className="border-t border-gray-100 pt-3">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Advice / Instructions</p>
                                                <p className="text-xs text-gray-600 whitespace-pre-wrap">{notes}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-6 flex justify-between items-end border-t border-gray-100 pt-4">
                                        <div></div>
                                        <div className="text-right">
                                            <div className="w-32 border-t border-gray-400 ml-auto mb-1"></div>
                                            <p className="text-[10px] font-bold text-gray-900">{doctorName}</p>
                                            <p className="text-[9px] text-gray-400 font-bold uppercase">{clinicName}</p>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ height: '8px', backgroundColor: primaryColor }}></div>
                            </div>
                        </div>
                        {/* Preview Actions */}
                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3">
                            <button
                                onClick={downloadPrescriptionPdf}
                                disabled={isLoading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#2a276e] hover:bg-[#1a1548] text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                Download PDF
                            </button>
                            <button
                                onClick={sendOnWhatsApp}
                                disabled={isLoading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#00ba7c] hover:bg-[#009e6a] text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                            >
                                <MessageCircle className="w-4 h-4" />
                                {isLoading ? 'Sending...' : 'WhatsApp Share'}
                            </button>
                        </div>
                    </>
                )}

                {/* Edit Mode */}
                {mode === 'edit' && (
                <>
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Medications</h3>
                            <button onClick={addItem} className="text-xs font-bold text-[#2a276e] hover:underline">+ Add Medicine</button>
                        </div>
                        
                        <div className="space-y-3" ref={suggestionRef}>
                            {items.map((item, i) => (
                                <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group">
                                    <button onClick={() => removeItem(i)} className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-gray-100 shadow-sm rounded-full flex items-center justify-center text-red-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                    
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Medicine Name</label>
                                            <input 
                                                value={item.medicine_name} 
                                                onChange={e => updateItem(i, 'medicine_name', e.target.value)}
                                                placeholder="Search or type medicine name..."
                                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/10 shadow-sm"
                                            />
                                            {showSuggestions === i && filteredMeds.length > 0 && (
                                                <div className="absolute top-full left-0 z-[80] w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-40 overflow-y-auto">
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
                                        
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Dosage</label>
                                                <select 
                                                    value={item.dosage} 
                                                    onChange={e => updateItem(i, 'dosage', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#2a276e]/10 shadow-sm"
                                                >
                                                    <option value="1-0-1">1-0-1 (Morning & Night)</option>
                                                    <option value="1-1-1">1-1-1 (Thrice Daily)</option>
                                                    <option value="0-0-1">0-0-1 (Night Only)</option>
                                                    <option value="1-0-0">1-0-0 (Morning Only)</option>
                                                    <option value="0-1-0">0-1-0 (Afternoon Only)</option>
                                                    <option value="1-1-0">1-1-0 (Morning & Noon)</option>
                                                    <option value="SOS">SOS (As Needed)</option>
                                                    <option value="STAT">STAT (Immediate)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Duration</label>
                                                <select 
                                                    value={item.duration} 
                                                    onChange={e => updateItem(i, 'duration', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#2a276e]/10 shadow-sm"
                                                >
                                                    <option value="3 days">3 days</option>
                                                    <option value="5 days">5 days</option>
                                                    <option value="7 days">7 days</option>
                                                    <option value="10 days">10 days</option>
                                                    <option value="14 days">14 days</option>
                                                    <option value="1 month">1 month</option>
                                                    <option value="Ongoing">Ongoing</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Instructions</label>
                                                <select 
                                                    value={item.instructions || 'After Food'} 
                                                    onChange={e => updateItem(i, 'instructions', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#2a276e]/10 shadow-sm"
                                                >
                                                    <option value="After Food">After Food</option>
                                                    <option value="Before Food">Before Food</option>
                                                    <option value="Empty Stomach">Empty Stomach</option>
                                                    <option value="At Bedtime">At Bedtime</option>
                                                </select>
                                            </div>
                                        </div>

                                        
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Specific Notes</label>
                                            <input value={item.notes} onChange={e => updateItem(i, 'notes', e.target.value)}
                                                placeholder="e.g. Empty stomach, after food"
                                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/10 shadow-sm" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2">General Instructions</label>
                        <textarea 
                            value={notes} 
                            onChange={(e) => setNotes(e.target.value)}
                            rows={4} 
                            placeholder="Provide any overall instructions for the patient..."
                            className="w-full bg-gray-50 border border-transparent hover:border-gray-200 focus:border-[#2a276e] focus:bg-white focus:ring-4 focus:ring-[#2a276e]/10 rounded-2xl px-4 py-3 text-sm transition-all text-gray-900 resize-none"
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50">
                    <button 
                        onClick={handleSave}
                        disabled={isLoading || !items.some(i => i.medicine_name.trim())}
                        className={`w-full py-3.5 rounded-xl font-bold transition-all shadow-md ${
                            !isLoading && items.some(i => i.medicine_name.trim())
                            ? 'bg-[#2a276e] hover:bg-[#1a1548] text-white hover:shadow-lg' 
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                        }`}
                    >
                        {isLoading ? 'Saving...' : initialData ? 'Update Prescription' : 'Save Prescription'}
                    </button>
                </div>
                </>
                )}
            </div>
        </>
    );
};

export default PrescriptionDrawer;
