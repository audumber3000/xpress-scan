import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Check, Plus, AlertCircle } from 'lucide-react';

/**
 * MedicalHistoryPicker - Professional multi-select for clinical history
 */
const MedicalHistoryPicker = ({ selectedConditions, onChange }) => {
    const [available, setAvailable] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newCondition, setNewCondition] = useState("");

    useEffect(() => {
        const fetchMedicalConditions = async () => {
            try {
                const response = await api.get('/clinical/settings/?category=medical-condition');
                setAvailable(response);
            } catch (err) {
                console.error("Failed to fetch medical conditions:", err);
            }
        };
        fetchMedicalConditions();
    }, []);

    const toggleCondition = (conditionName) => {
        const updated = selectedConditions.includes(conditionName)
            ? selectedConditions.filter(c => c !== conditionName)
            : [...selectedConditions, conditionName];
        onChange(updated);
    };

    const handleAddNew = async () => {
        if (!newCondition.trim()) return;
        
        try {
            const response = await api.post('/clinical/settings/', {
                category: 'medical-condition',
                name: newCondition.trim(),
                is_active: true
            });
            setAvailable([...available, response]);
            toggleCondition(response.name);
            setNewCondition("");
            setIsAdding(false);
        } catch (err) {
            console.error("Failed to add medical condition:", err);
        }
    };

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-2 px-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                    Medical History & Conditions
                </label>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="text-[11px] font-bold text-[#20b2aa] flex items-center gap-1 hover:underline"
                >
                    <Plus size={10} strokeWidth={3} />
                    New Condition
                </button>
            </div>

            {/* Quick-Pick Tags */}
            <div className="flex flex-wrap gap-2 mb-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm min-h-[100px] content-start">
                {available.map((c) => {
                    const isSelected = selectedConditions.includes(c.name);
                    return (
                        <button
                            key={c.id}
                            onClick={() => toggleCondition(c.name)}
                            className={`
                                text-xs font-bold px-3.5 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 border shadow-sm
                                ${isSelected 
                                    ? 'bg-[#20b2aa] text-white border-[#20b2aa] scale-[1.05] shadow-[#20b2aa]/20' 
                                    : 'bg-white text-gray-600 border-gray-100 hover:border-gray-300 hover:bg-gray-50 hover:-translate-y-0.5'}
                            `}
                        >
                            {isSelected && <Check size={12} strokeWidth={4} />}
                            {c.name}
                        </button>
                    );
                })}
                
                {available.length === 0 && (
                    <div className="w-full flex flex-col items-center justify-center py-6 text-gray-300 gap-2">
                        <AlertCircle size={24} strokeWidth={1.5} />
                        <span className="text-[11px] font-semibold">No conditions seeded yet</span>
                    </div>
                )}
            </div>

            {/* Add New Input Inline */}
            {isAdding && (
                <div className="flex gap-2 animate-in slide-in-from-right-4 duration-300">
                    <input
                        type="text"
                        value={newCondition}
                        onChange={(e) => setNewCondition(e.target.value)}
                        placeholder="Type condition (e.g. Hypertension)"
                        className="flex-1 px-4 py-2 bg-gray-50 border border-[#20b2aa]/30 rounded-xl outline-none focus:border-[#20b2aa] transition-colors text-xs font-semibold"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddNew()}
                        autoFocus
                    />
                    <button
                        onClick={handleAddNew}
                        className="px-4 py-2 bg-[#20b2aa] text-white text-xs font-bold rounded-xl hover:bg-[#1a9a92] transition-colors"
                    >
                        Save
                    </button>
                    <button
                        onClick={() => setIsAdding(false)}
                        className="px-4 py-2 bg-gray-100 text-gray-500 text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
};

export default MedicalHistoryPicker;
