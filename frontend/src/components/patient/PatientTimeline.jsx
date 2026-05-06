import React, { useState, useMemo, useRef, useEffect } from 'react';
import ToothSurfaceMap from './ToothSurfaceMap';
import { getCurrencySymbol } from '../../utils/currency';

/**
 * PatientTimeline - Flush Kanban Board, edge-to-edge buttons, Tooth Diagram integration
 */
const PatientTimeline = ({
    upcomingAppointments = [],
    treatmentHistory = [],
    treatmentPlan = [],
    onUpdatePlan,
    onToothSelect,
    teethData = {}
}) => {
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});

    const columns = useMemo(() => {
        const planItems = treatmentPlan.filter(item => !item.status || item.status === 'planned');
        const inProgressItems = treatmentPlan.filter(item => item.status === 'in-progress');
        const completedItems = [
            ...treatmentPlan.filter(item => item.status === 'completed'),
            ...treatmentHistory.map(h => ({ ...h, status: 'completed' }))
        ].sort((a, b) => new Date(b.date || b.appointment_date) - new Date(a.date || a.appointment_date));

        return {
            planned: planItems.sort((a, b) => (a.visit_number || 0) - (b.visit_number || 0)),
            inProgress: inProgressItems.sort((a, b) => (a.visit_number || 0) - (b.visit_number || 0)),
            completed: completedItems
        };
    }, [treatmentPlan, treatmentHistory]);

    const handleStatusChange = (item, newStatus) => {
        const updated = treatmentPlan.map(p => 
            p.id === item.id ? { ...p, status: newStatus } : p
        );
        onUpdatePlan(updated);
    };

    const handleDrop = (e, newStatus) => {
        e.preventDefault();
        const itemId = e.dataTransfer.getData('itemId');
        if (!itemId) return;
        
        const item = treatmentPlan.find(p => p.id.toString() === itemId.toString());
        if (item && item.status !== newStatus) {
            handleStatusChange(item, newStatus);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault(); 
    };

    const handleQtyChange = (item, direction) => {
        const currentQty = item.qty || 1;
        const newQty = direction === 'inc' ? currentQty + 1 : Math.max(1, currentQty - 1);
        const updated = treatmentPlan.map(p => 
            p.id === item.id ? { ...p, qty: newQty } : p
        );
        onUpdatePlan(updated);
    };

    const startEditing = (item) => {
        setEditingId(item.id);
        setEditData({ ...item });
        // Also open the right drawer if there relies on a tooth
        if (onToothSelect) {
            onToothSelect(item.tooth ? Number(item.tooth) : 'GENERAL', item);
        }
    };

    const saveEdit = () => {
        const updated = treatmentPlan.map(item =>
            item.id === editingId ? editData : item
        );
        onUpdatePlan(updated);
        setEditingId(null);
    };

    const deleteItem = (id) => {
        if (window.confirm("Remove from plan?")) {
            onUpdatePlan(treatmentPlan.filter(item => item.id !== id));
        }
    };

    const TreatmentCard = ({ item, isHistory = false }) => {
        const [showMenu, setShowMenu] = useState(false);
        const menuRef = useRef();

        // Close menu on click outside
        useEffect(() => {
            const handleClickOutside = (event) => {
                if (menuRef.current && !menuRef.current.contains(event.target)) {
                    setShowMenu(false);
                }
            };
            if (showMenu) document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }, [showMenu]);

        const isEditing = editingId === item.id;
        const displayDate = new Date(item.date || item.appointment_date || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        
        const qty = item.qty || 1;
        const itemPrice = item.cost || 600;
        const total = qty * itemPrice;
        const doctorName = item.doctor || "Audumber Ramdas Chaudhari";

        if (isEditing) {
            return (
                <div className="bg-white p-4 shadow-md border-2 border-[#2a276e] rounded-xl space-y-3 relative mb-3">
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={editData.procedure}
                            onChange={e => setEditData({ ...editData, procedure: e.target.value })}
                            className="w-full text-sm font-medium border border-gray-300 p-2 rounded-lg focus:border-[#2a276e] focus:ring-1 focus:ring-[#2a276e] outline-none text-gray-900"
                            placeholder="Procedure title"
                        />
                         <input
                            type="text"
                            placeholder="Diagnosis"
                            value={editData.diagnosis || ''}
                            onChange={e => setEditData({ ...editData, diagnosis: e.target.value })}
                            className="w-full text-sm font-medium border border-gray-300 p-2 rounded-lg focus:border-[#2a276e] focus:ring-1 focus:ring-[#2a276e] outline-none text-gray-900"
                        />
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Tooth"
                                value={editData.tooth}
                                onChange={e => setEditData({ ...editData, tooth: e.target.value })}
                                className="w-1/2 text-sm font-medium border border-gray-300 p-2 rounded-lg focus:border-[#2a276e] focus:ring-1 focus:ring-[#2a276e] outline-none text-gray-900"
                            />
                            <input
                                type="number"
                                placeholder="Price"
                                value={editData.cost || ''}
                                onChange={e => setEditData({ ...editData, cost: Number(e.target.value) })}
                                className="w-1/2 text-sm font-medium border border-gray-300 p-2 rounded-lg focus:border-[#2a276e] focus:ring-1 focus:ring-[#2a276e] outline-none text-gray-900"
                            />
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
                        <button onClick={() => deleteItem(item.id)} className="text-red-600 text-xs font-medium px-2 hover:bg-red-50 rounded-lg py-1.5 transition">Delete</button>
                        <div className="flex gap-2">
                            <button onClick={() => setEditingId(null)} className="px-4 py-1.5 text-xs font-medium hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg">Cancel</button>
                            <button onClick={saveEdit} className="px-4 py-1.5 bg-[#2a276e] text-white text-xs font-medium hover:bg-[#1a1548] rounded-lg shadow-sm">Save</button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div 
                draggable={!isHistory}
                onDragStart={(e) => {
                    e.dataTransfer.setData('itemId', item.id);
                    e.dataTransfer.effectAllowed = 'move';
                }}
                className={`bg-white p-4 shadow-sm border border-gray-200 rounded-xl hover:shadow-md transition-shadow group relative flex flex-col gap-3 mb-3 pb-0 ${!isHistory ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
                {/* Header Row: Date & Doctor & Menu */}
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 relative">
                    <span className="text-[11px] font-medium text-gray-500">{displayDate}</span>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-gray-700">
                            <div className="w-4 h-4 shrink-0 rounded-full bg-[#2a276e] flex items-center justify-center">
                                <span className="text-white font-bold" style={{ fontSize: '7px', lineHeight: 1 }}>
                                    {doctorName ? doctorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'DR'}
                                </span>
                            </div>
                            <span className="text-[11px] font-medium truncate max-w-[100px]">{doctorName}</span>
                        </div>
                        
                        {/* 3 Dots Menu Trigger */}
                        {!isHistory && (
                            <div className="relative" ref={menuRef}>
                                <button 
                                    onClick={() => setShowMenu(!showMenu)} 
                                    className="p-1 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/></svg>
                                </button>

                                {/* Dropdown Popover */}
                                {showMenu && (
                                    <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden z-20 py-1">
                                        <button 
                                            onClick={() => { setShowMenu(false); startEditing(item); }} 
                                            className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth="2.5"/></svg>
                                            Edit Procedure
                                        </button>
                                        <button 
                                            onClick={() => { setShowMenu(false); deleteItem(item.id); }} 
                                            className="w-full text-left px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2.5"/></svg>
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Body Grid */}
                <div>
                    <div className="flex gap-4">
                        {/* Tooth Map Rendering */}
                        <div className="flex flex-col items-center">
                            <p className="text-[11px] text-gray-500 mb-1 font-medium text-center w-full border-b border-gray-50 pb-1">Tooth</p>
                            {item.tooth ? (
                                <>
                                    <div className="w-14 h-16 pointer-events-none">
                                        <ToothSurfaceMap 
                                            surfaces={teethData[item.tooth]?.surfaces || {}} 
                                            onSurfaceSelect={() => {}} // Disabled interaction on card preview
                                        />
                                    </div>
                                    <p className="font-black text-gray-900 text-lg mt-0.5" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.05)' }}>#{item.tooth}</p>
                                </>
                            ) : (
                                <div className="h-16 flex items-center justify-center">
                                    <p className="font-bold text-gray-400 text-xs tracking-wider bg-gray-50 px-2 py-1 rounded">GENERAL</p>
                                </div>
                            )}
                        </div>

                        {/* Title & Diagnosis */}
                        <div className="flex flex-col flex-1 border-l border-gray-100 pl-4 py-1">
                            <div className="mb-3">
                                <p className="text-[11px] text-gray-500 mb-0.5 font-medium">Diagnosis</p>
                                <p className="font-medium text-gray-900 text-[13px] leading-tight pr-2 line-clamp-2">{item.diagnosis || 'Reversible pulpitis'}</p>
                            </div>
                            <div className="mt-auto pb-1">
                                <p className="text-[11px] text-gray-500 mb-0.5 font-medium">Treatment Name</p>
                                <p className="font-black text-[#2a276e] text-[15px] leading-tight pr-4">{item.procedure || 'COMPOSITE- PEDO'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pricing / Qty Footer Block */}
                <div className="bg-[#f8f9fc] rounded-lg p-3 grid grid-cols-3 gap-2 items-end mt-1 border border-gray-100/50">
                    <div>
                        <p className="text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wider">Qty</p>
                        <div className="flex items-center gap-1 bg-white border border-gray-200 p-0.5 w-max rounded shadow-sm">
                            <button onClick={() => handleQtyChange(item, 'dec')} className="text-gray-400 hover:text-black font-medium h-5 w-5 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded text-sm">-</button>
                            <span className="text-[13px] font-black w-5 text-center text-gray-900">{qty}</span>
                            <button onClick={() => handleQtyChange(item, 'inc')} className="text-gray-400 hover:text-black font-medium h-5 w-5 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded text-sm">+</button>
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wider">Price</p>
                        <p className="font-bold text-gray-600 text-sm">{getCurrencySymbol()}{itemPrice.toLocaleString('en-US')}</p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <p className="text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wider text-[rgb(0,190,129)]">Total</p>
                        <p className="font-black text-[rgb(0,210,143)] text-[16px] leading-none drop-shadow-sm">{getCurrencySymbol()}{total.toLocaleString('en-US')}</p>
                    </div>
                </div>

                {/* Status Advancement Buttons (Edge-to-Edge Footer) */}
                {!isHistory ? (
                    <div className="flex mt-2 border-t border-gray-100 -mx-4 overflow-hidden rounded-b-xl divide-x divide-gray-100">
                        {item.status !== 'planned' && (
                            <button 
                                onClick={() => handleStatusChange(item, 'planned')} 
                                className="flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider bg-gray-50/80 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                            >
                                Planned
                            </button>
                        )}
                        {item.status !== 'in-progress' && (
                            <button 
                                onClick={() => handleStatusChange(item, 'in-progress')} 
                                className="flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider bg-[#f8f9ff] text-[#2a276e] hover:bg-[#e6eaff] transition-colors"
                            >
                                In Progress
                            </button>
                        )}
                        {item.status !== 'completed' && (
                            <button 
                                onClick={() => handleStatusChange(item, 'completed')} 
                                className="flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider bg-[#f0fdf9] text-[rgb(0,190,129)] hover:bg-[#d1faeb] transition-colors"
                            >
                                Complete
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="pb-4"></div> /* Padding bottom restored for historical cards that don't have the footer buttons */
                )}
            </div>
        );
    };

    return (
        <div className="w-full">
            {/* Seamless 3-Column Solid Grid Structure */}
            <div className="flex flex-col lg:flex-row w-full bg-white border-t-0">
                
                {/* PLANNED Column */}
                <div 
                    className="flex-1 flex flex-col min-h-[400px] border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50/50"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'planned')}
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shadow-sm z-10">
                        <h4 className="text-sm font-medium text-gray-800">
                            Planned
                        </h4>
                        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded shadow-sm border border-gray-200">{columns.planned.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {columns.planned.map(item => <TreatmentCard key={item.id} item={item} />)}
                    </div>
                </div>

                {/* IN PROGRESS Column */}
                <div 
                    className="flex-1 flex flex-col min-h-[400px] border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50/50"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'in-progress')}
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shadow-sm z-10">
                        <h4 className="text-sm font-medium text-[#2a276e]">
                            In Progress
                        </h4>
                        <span className="text-xs font-medium bg-[#f0f4ff] text-[#2a276e] px-2 py-0.5 rounded shadow-sm border border-[#e0e7ff]">{columns.inProgress.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {columns.inProgress.map(item => <TreatmentCard key={item.id} item={item} />)}
                    </div>
                </div>

                {/* COMPLETED Column */}
                <div 
                    className="flex-1 flex flex-col min-h-[400px] bg-gray-50/50"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'completed')}
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shadow-sm z-10">
                        <h4 className="text-sm font-medium text-[rgb(0,190,129)]">
                            Completed
                        </h4>
                        <span className="text-xs font-medium bg-[#e6fcf5] text-[rgb(0,190,129)] px-2 py-0.5 rounded shadow-sm border border-[#cbf7e6]">{columns.completed.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {columns.completed.map((item, idx) => <TreatmentCard key={item.id || idx} item={item} isHistory={!item.status || item.status === 'completed'} />)}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PatientTimeline;
