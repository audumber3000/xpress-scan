import React, { useState, useEffect, useRef } from 'react';
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

    const downloadPrescriptionPdf = () => {
        const validItems = items.filter(i => i.medicine_name.trim());
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Prescription - ${patientData?.name || 'Patient'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a1a; padding: 40px 48px; max-width: 720px; margin: 0 auto; }
    .header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 12px; padding-bottom: 16px; border-bottom: 2px solid #29828a; }
    .brand-icon { width: 52px; height: 52px; background: #29828a; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .brand-icon svg { width: 30px; height: 30px; }
    .doctor-info h1 { font-size: 20px; font-weight: 800; color: #1a1a1a; }
    .doctor-info p { font-size: 12px; color: #555; margin-top: 2px; }
    .rx-bar { display: flex; align-items: center; gap: 16px; background: #29828a; color: white; padding: 10px 20px; margin: 0 -48px; margin-bottom: 20px; }
    .rx-bar .rx-symbol { font-size: 28px; font-weight: 900; font-style: italic; }
    .patient-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; border-bottom: 1px solid #eee; padding-bottom: 16px; }
    .patient-field { font-size: 12px; color: #888; }
    .patient-field strong { display: block; color: #1a1a1a; font-size: 13px; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: #f0fafa; }
    th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #29828a; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 2px solid #29828a; }
    td { padding: 11px 12px; font-size: 13px; color: #333; border-bottom: 1px solid #f0f0f0; }
    .instructions-box { background: #f9fafb; border-left: 3px solid #29828a; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 32px; }
    .instructions-box p { font-size: 12px; color: #555; line-height: 1.7; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 2px solid #29828a; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer-left { font-size: 11px; color: #888; }
    .signature-block { text-align: right; }
    .signature-block p { font-size: 13px; font-weight: 700; color: #1a1a1a; }
    .signature-block .sig-line { border-top: 1px solid #333; width: 180px; margin: 32px 0 6px auto; }
    .watermark { position: fixed; bottom: 30%; left: 50%; transform: translateX(-50%) rotate(-30deg); font-size: 48px; font-weight: 900; color: rgba(41,130,138,0.05); white-space: nowrap; pointer-events: none; }
    @media print { body { padding: 32px 40px; } .watermark { display: block; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand-icon">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9z" fill="white" opacity="0.3"/>
        <path d="M12 5c-2.5 0-5 1.5-5 4 0 1.2.5 2.2 1.3 3L12 19l3.7-7c.8-.8 1.3-1.8 1.3-3 0-2.5-2.5-4-5-4z" fill="white"/>
      </svg>
    </div>
    <div class="doctor-info">
      <h1>Dr. ${doctorName}</h1>
      <p>${clinicName}</p>
    </div>
  </div>

  <div class="rx-bar">
    <span class="rx-symbol">&#x211E;</span>
    <span style="font-size:13px;font-weight:600;letter-spacing:2px;">PRESCRIPTION</span>
  </div>

  <div class="patient-row">
    <div class="patient-field">Name <strong>${patientData?.name || '—'}</strong></div>
    <div class="patient-field">Age <strong>${patientData?.age || patientData?.dob ? (new Date().getFullYear() - new Date(patientData?.dob).getFullYear()) + ' yrs' : '—'}</strong></div>
    <div class="patient-field">Gender <strong>${patientData?.gender || '—'}</strong></div>
    <div class="patient-field">Date <strong>${today}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Medicine</th>
        <th>Dosage</th>
        <th>Duration</th>
        <th>Instructions</th>
      </tr>
    </thead>
    <tbody>
      ${validItems.map((it, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${it.medicine_name}</strong></td>
        <td>${it.dosage}</td>
        <td>${it.duration}</td>
        <td>${it.instructions || it.notes || '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  ${notes ? `<div class="instructions-box"><p><strong>General Instructions:</strong> ${notes}</p></div>` : ''}

  <div class="footer">
    <div class="footer-left">
      ${clinicPhone ? `<p>&#9742; ${clinicPhone}</p>` : ''}
      ${clinicAddress ? `<p>&#9679; ${clinicAddress}</p>` : ''}
    </div>
    <div class="signature-block">
      <div class="sig-line"></div>
      <p>Dr. ${doctorName}</p>
      <p style="font-size:11px;color:#888;">${clinicName}</p>
    </div>
  </div>

  <div class="watermark">MolarPlus</div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) win.onafterprint = () => URL.revokeObjectURL(url);
    };

    const sendOnWhatsApp = () => {
        const validItems = items.filter(i => i.medicine_name.trim());
        const phone = patientData?.phone?.replace(/\D/g, '') || '';
        const medLines = validItems.map((it, i) =>
            `${i + 1}. *${it.medicine_name}* — ${it.dosage} for ${it.duration}${it.instructions ? ` (${it.instructions})` : ''}`
        ).join('\n');
        const text = `*Prescription from Dr. ${doctorName}*\n${clinicName}\nDate: ${today}\n\n*Patient:* ${patientData?.name || ''}\n\n*Medications:*\n${medLines}${notes ? `\n\n*Instructions:* ${notes}` : ''}\n\n_This is a computer-generated prescription._`;
        const waUrl = phone
            ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
            : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
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
                        <div className="flex-1 overflow-y-auto bg-gray-50">
                            {/* Prescription Preview */}
                            <div className="m-4 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                {/* Header */}
                                <div className="p-5 border-b-2 border-[#29828a] flex items-start gap-3">
                                    <div className="w-12 h-12 bg-[#29828a] rounded-xl flex items-center justify-center flex-shrink-0">
                                        <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7">
                                            <path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9z" fill="white" opacity="0.3"/>
                                            <path d="M12 5c-2.5 0-5 1.5-5 4 0 1.2.5 2.2 1.3 3L12 19l3.7-7c.8-.8 1.3-1.8 1.3-3 0-2.5-2.5-4-5-4z" fill="white"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-black text-gray-900 text-base">Dr. {doctorName}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{clinicName}</p>
                                        {clinicPhone && <p className="text-xs text-gray-400 mt-0.5">☎ {clinicPhone}</p>}
                                    </div>
                                </div>
                                {/* Rx bar */}
                                <div className="bg-[#29828a] text-white flex items-center gap-3 px-5 py-2">
                                    <span className="text-2xl font-black italic">℞</span>
                                    <span className="text-xs font-bold tracking-[3px] uppercase">Prescription</span>
                                </div>
                                {/* Patient row */}
                                <div className="grid grid-cols-4 gap-3 px-5 py-3 border-b border-gray-100">
                                    {[
                                        ['Name', patientData?.name || '—'],
                                        ['Age', patientAge ? `${patientAge} yrs` : '—'],
                                        ['Gender', patientData?.gender || '—'],
                                        ['Date', today],
                                    ].map(([label, val]) => (
                                        <div key={label}>
                                            <p className="text-[10px] text-gray-400 font-semibold">{label}</p>
                                            <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{val}</p>
                                        </div>
                                    ))}
                                </div>
                                {/* Medications table */}
                                <div className="px-5 py-3">
                                    <table className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-[#f0fafa]">
                                                <th className="text-left px-2 py-2 text-[10px] font-black text-[#29828a] uppercase tracking-wider border-b-2 border-[#29828a] w-6">#</th>
                                                <th className="text-left px-2 py-2 text-[10px] font-black text-[#29828a] uppercase tracking-wider border-b-2 border-[#29828a]">Medicine</th>
                                                <th className="text-left px-2 py-2 text-[10px] font-black text-[#29828a] uppercase tracking-wider border-b-2 border-[#29828a]">Dosage</th>
                                                <th className="text-left px-2 py-2 text-[10px] font-black text-[#29828a] uppercase tracking-wider border-b-2 border-[#29828a]">Duration</th>
                                                <th className="text-left px-2 py-2 text-[10px] font-black text-[#29828a] uppercase tracking-wider border-b-2 border-[#29828a]">Instructions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {validItems.length > 0 ? validItems.map((it, idx) => (
                                                <tr key={idx} className="border-b border-gray-50">
                                                    <td className="px-2 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                                                    <td className="px-2 py-2.5 font-semibold text-gray-900">{it.medicine_name}</td>
                                                    <td className="px-2 py-2.5 text-gray-600">{it.dosage}</td>
                                                    <td className="px-2 py-2.5 text-gray-600">{it.duration}</td>
                                                    <td className="px-2 py-2.5 text-gray-500 text-xs">{it.instructions || it.notes || '—'}</td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan="5" className="px-2 py-6 text-center text-gray-400 text-xs">No medications added yet. Switch to Edit tab to add.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {notes && (
                                    <div className="mx-5 mb-4 bg-gray-50 border-l-4 border-[#29828a] rounded-r-lg px-4 py-3">
                                        <p className="text-xs font-bold text-gray-500 mb-0.5">General Instructions</p>
                                        <p className="text-sm text-gray-700">{notes}</p>
                                    </div>
                                )}
                                {/* Footer */}
                                <div className="px-5 py-4 border-t-2 border-[#29828a] flex justify-between items-end">
                                    <div className="text-xs text-gray-400">
                                        {clinicAddress && <p>{clinicAddress}</p>}
                                    </div>
                                    <div className="text-right">
                                        {doctorSignature ? (
                                            <img src={doctorSignature} alt="Signature" className="h-12 max-w-[140px] object-contain ml-auto mb-1" />
                                        ) : (
                                            <div className="w-32 border-t border-gray-400 mb-1 ml-auto"></div>
                                        )}
                                        <p className="text-xs font-bold text-gray-900">Dr. {doctorName}</p>
                                        <p className="text-[10px] text-gray-400">{clinicName}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Preview Actions */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                            <button
                                onClick={downloadPrescriptionPdf}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#29828a] hover:bg-[#1f6b72] text-white font-bold text-sm transition-all shadow-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                Download PDF
                            </button>
                            <button
                                onClick={sendOnWhatsApp}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5a] text-white font-bold text-sm transition-all shadow-sm"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                Send WhatsApp
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
