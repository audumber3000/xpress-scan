import React, { useState } from 'react';

/**
 * PatientTimeline - Renders the patient's appointment and treatment history
 */
const PatientTimeline = ({
    upcomingAppointments = [],
    treatmentHistory = [],
    treatmentPlan = [],
    onUpdatePlan,
    onGeneratePlan
}) => {
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});

    // Format time from HH:MM to HH:MM AM/PM
    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const startEditing = (item) => {
        setEditingId(item.id);
        setEditData({ ...item });
    };

    const saveEdit = () => {
        const updated = treatmentPlan.map(item =>
            item.id === editingId ? editData : item
        );
        onUpdatePlan(updated);
        setEditingId(null);
    };

    const deleteItem = (id) => {
        if (window.confirm("Are you sure you want to remove this treatment from the plan?")) {
            onUpdatePlan(treatmentPlan.filter(item => item.id !== id));
        }
    };

    const addNewItem = () => {
        const newItem = {
            id: Date.now(),
            procedure: 'New Procedure',
            date: new Date().toISOString().split('T')[0],
            time: '10:00',
            status: 'planned',
            cost: 0,
            notes: '',
            visit_number: treatmentPlan.length + 1
        };
        onUpdatePlan([...treatmentPlan, newItem]);
        startEditing(newItem);
    };

    return (
        <div className="space-y-12 pb-20">
            {/* 1. Proposed Treatment Plan & Journey Architect */}
            <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#2a276e] to-[#4c449c] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-900/20">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2M9 5a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">Treatment Plan</h3>
                            <p className="text-sm text-gray-400 font-semibold uppercase">Journey Architect</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={onGeneratePlan}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#9B8CFF]/10 text-[#2a276e] rounded-xl text-xs font-bold uppercase hover:bg-[#9B8CFF]/20 transition-all border border-[#9B8CFF]/20"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Generate from Chart
                        </button>
                        <button
                            onClick={addNewItem}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#2a276e] text-white rounded-xl text-xs font-bold uppercase hover:bg-[#1a1548] transition-all shadow-lg shadow-blue-900/10"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                            Add Manual Step
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase">Visit #</th>
                                <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase">Procedure / Treatment</th>
                                <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase">Planned Date & Time</th>
                                <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Estimate Cost</th>
                                <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {treatmentPlan.length > 0 ? treatmentPlan.map((item, index) => (
                                <tr key={item.id} className={`group transition-all ${editingId === item.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                                    <td className="py-5 px-4">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#2a276e] to-[#4c449c] text-white font-bold text-sm shadow-md">
                                            {item.visit_number || index + 1}
                                        </div>
                                    </td>
                                    <td className="py-5 px-4">
                                        {editingId === item.id ? (
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    value={editData.procedure}
                                                    onChange={e => setEditData({ ...editData, procedure: e.target.value })}
                                                    className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-[#2a276e]"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Notes..."
                                                    value={editData.notes}
                                                    onChange={e => setEditData({ ...editData, notes: e.target.value })}
                                                    className="w-full p-2 bg-white border border-gray-200 rounded-lg text-[10px]"
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="font-bold text-[#2a276e] text-base group-hover:translate-x-1 transition-transform">
                                                    {item.procedure} {item.tooth && <span className="text-gray-400 font-bold ml-1">(Tooth #{item.tooth})</span>}
                                                </p>
                                                <p className="text-xs text-gray-500 font-medium italic truncate max-w-xs">{item.notes || 'No specific clinical notes.'}</p>
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-5 px-4">
                                        {editingId === item.id ? (
                                            <div className="space-y-2">
                                                <input
                                                    type="date"
                                                    value={editData.date}
                                                    onChange={e => setEditData({ ...editData, date: e.target.value })}
                                                    className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                                                />
                                                <input
                                                    type="time"
                                                    value={editData.time || '10:00'}
                                                    onChange={e => setEditData({ ...editData, time: e.target.value })}
                                                    className="w-full p-2 border border-gray-200 rounded-lg text-xs"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-700">{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                <span className="text-xs text-[#2a276e] font-bold mt-1">{formatTime(item.time || '10:00')}</span>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Visit #{item.visit_number || index + 1}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-5 px-4 text-right font-bold text-[#2a276e]">
                                        {editingId === item.id ? (
                                            <input
                                                type="number"
                                                value={editData.cost}
                                                onChange={e => setEditData({ ...editData, cost: parseInt(e.target.value) })}
                                                className="w-24 text-right p-2 border border-gray-200 rounded-lg text-xs"
                                            />
                                        ) : (
                                            <span>₹{item.cost?.toLocaleString('en-IN')}</span>
                                        )}
                                    </td>
                                    <td className="py-5 px-4">
                                        <div className="flex justify-center gap-2">
                                            {editingId === item.id ? (
                                                <button onClick={saveEdit} className="p-2 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                                </button>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEditing(item)} className="p-2 bg-[#9B8CFF]/10 text-[#2a276e] rounded-lg hover:bg-[#9B8CFF]/20">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                    <button onClick={() => deleteItem(item.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16" /></svg>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="py-10 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <p className="text-gray-400 font-bold italic">No treatments in the architect yet. Click "Generate" to begin.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {treatmentPlan.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Plan Summary</p>
                            <p className="text-sm font-bold text-gray-600">{treatmentPlan.length} Total Procedures Planned</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Estimated Total</p>
                            <p className="text-2xl font-bold text-[#2a276e]">
                                ₹{treatmentPlan.reduce((acc, curr) => acc + (curr.cost || 0), 0).toLocaleString('en-IN')}
                            </p>
                        </div>
                    </div>
                )}
            </section>

            {/* 2. Integrated Treatment Journey (Unified Timeline) */}
            <section>
                <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#9B8CFF] to-[#2a276e] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-purple-900/20">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900">Clinical Roadmap</h3>
                        <p className="text-sm text-gray-400 font-semibold uppercase text-left">Full Treatment Chronicle</p>
                    </div>
                </div>

                <div className="relative pl-4 sm:pl-10">
                    {/* Continuous Vertical Backbone */}
                    <div className="absolute left-4 sm:left-[39px] top-0 bottom-0 w-1 bg-gradient-to-b from-[#2a276e] via-[#9B8CFF] to-gray-100 rounded-full"></div>

                    <div className="space-y-12">
                        {/* PLANNED STEPS (Future) */}
                        {treatmentPlan.sort((a, b) => new Date(a.date) - new Date(b.date)).map((item, index) => (
                            <div key={item.id} className="relative group">
                                {/* Dot Indicator */}
                                <div className="absolute left-[-15px] sm:left-[-1.5px] top-2 z-10">
                                    <div className="w-8 h-8 rounded-xl bg-white border-4 border-[#9B8CFF] flex items-center justify-center shadow-lg group-hover:scale-125 transition-transform">
                                        <div className="w-2 h-2 bg-[#9B8CFF] rounded-full animate-pulse"></div>
                                    </div>
                                    {/* Connection Line to Content */}
                                    <div className="absolute left-8 top-1/2 w-4 h-[2px] bg-[#9B8CFF]/30"></div>
                                </div>

                                <div className="ml-12 bg-white rounded-3xl p-6 border border-[#9B8CFF]/20 shadow-sm hover:shadow-xl hover:border-[#9B8CFF]/40 transition-all duration-500 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-4">
                                            <span className="flex items-center justify-center w-8 h-8 bg-[#9B8CFF]/10 text-[#2a276e] rounded-lg text-xs font-black">
                                                STEP
                                            </span>
                                            <div>
                                                <h4 className="text-lg font-black text-[#2a276e]">{item.procedure}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Planned for</span>
                                                    <span className="text-xs font-black text-[#9B8CFF] bg-[#9B8CFF]/5 px-2 py-0.5 rounded-full border border-[#9B8CFF]/10">
                                                        {new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100 font-bold text-lg text-gray-400 italic">
                                            EST. ₹{item.cost?.toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                    {item.notes && (
                                        <div className="bg-gradient-to-r from-gray-50 to-white rounded-2xl p-4 border-l-4 border-[#9B8CFF] text-sm text-gray-600 font-medium italic">
                                            "{item.notes}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* COMPLETED STEPS (Past) */}
                        {treatmentHistory.map((treatment) => (
                            <div key={treatment.id} className="relative group grayscale-[0.5] hover:grayscale-0 transition-all">
                                {/* Steel Dot Indicator */}
                                <div className="absolute left-[-15px] sm:left-[-1.5px] top-2 z-10">
                                    <div className="w-8 h-8 rounded-xl bg-gray-50 border-4 border-gray-200 flex items-center justify-center shadow-md">
                                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>

                                <div className="ml-12 bg-white/60 rounded-3xl p-6 border border-gray-100 shadow-sm transition-all duration-300">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h4 className="font-bold text-gray-600 text-lg line-through opacity-50">{treatment.procedure}</h4>
                                                <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold uppercase rounded border border-green-100">
                                                    Completed
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-gray-400 mt-1 uppercase">
                                                {new Date(treatment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <div className="text-sm font-bold text-gray-400">
                                            PAID ₹{treatment.cost?.toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Final Terminal Node */}
                    <div className="relative mt-12 mb-20">
                        <div className="absolute left-[-15px] sm:left-[-1.5px] top-0">
                            <div className="w-8 h-8 rounded-2xl bg-gray-50 border-4 border-dashed border-gray-200 flex items-center justify-center">
                                <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
                            </div>
                        </div>
                        <div className="ml-12 py-1">
                            <p className="text-xs font-bold text-gray-300 uppercase tracking-[0.2em] italic">Timeline Beginning / End</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default PatientTimeline;
