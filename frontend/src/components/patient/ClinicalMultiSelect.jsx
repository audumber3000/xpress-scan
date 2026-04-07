import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';
import { Search, Plus, X, Tag } from 'lucide-react';

/**
 * ClinicalMultiSelect - Pill-based multi-select with clinical self-learning suggestions
 */
const ClinicalMultiSelect = ({ category, selectedValues = [], onChange, placeholder, label }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        const fetchSuggestions = async () => {
            try {
                const response = await api.get(`/clinical/settings/?category=${category}`);
                setSuggestions(response);
            } catch (err) {
                console.error("Failed to fetch clinical settings:", err);
            }
        };
        fetchSuggestions();
    }, [category]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        
        if (val.trim()) {
            const matches = suggestions.filter(s => 
                s.name.toLowerCase().includes(val.toLowerCase()) && 
                !selectedValues.includes(s.name)
            );
            setFiltered(matches);
            setShowSuggestions(true);
        } else {
            setFiltered([]);
            setShowSuggestions(false);
        }
    };

    const handleSelect = (name) => {
        if (!selectedValues.includes(name)) {
            onChange([...selectedValues, name]);
        }
        setInputValue('');
        setShowSuggestions(false);
    };

    const handleRemove = (name) => {
        onChange(selectedValues.filter(val => val !== name));
    };

    const handleAddNew = async () => {
        const trimmed = inputValue.trim();
        if (!trimmed) return;
        
        if (selectedValues.includes(trimmed)) {
            setInputValue('');
            setShowSuggestions(false);
            return;
        }

        const exactMatch = suggestions.find(s => s.name.toLowerCase() === trimmed.toLowerCase());
        if (exactMatch) {
            handleSelect(exactMatch.name);
            return;
        }

        try {
            const response = await api.post('/clinical/settings/', {
                category,
                name: trimmed,
                is_active: true
            });
            setSuggestions([...suggestions, response]);
            handleSelect(trimmed);
        } catch (err) {
            console.error("Failed to auto-save new clinical setting:", err);
            // Fallback: just add it to the list without saving
            handleSelect(trimmed);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            handleAddNew();
        }
    };

    const isExactMatch = suggestions.some(s => s.name.toLowerCase() === inputValue.toLowerCase());

    return (
        <div className="space-y-2 w-full" ref={wrapperRef}>
            {label && (
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">
                    {label}
                </label>
            )}
            
            <div className="relative group">
                <div className="flex flex-wrap gap-2 p-2.5 bg-white border border-gray-200 rounded-2xl focus-within:border-[#2a276e] focus-within:ring-4 focus-within:ring-[#2a276e]/5 transition-all shadow-sm group-hover:border-gray-300">
                    {selectedValues.map((val, idx) => (
                        <div 
                            key={idx}
                            className="flex items-center gap-1.5 px-3 py-1 bg-[#2a276e]/5 text-[#2a276e] border border-[#2a276e]/10 rounded-full text-sm font-semibold animate-in zoom-in-95 duration-200"
                        >
                            <span>{val}</span>
                            <button 
                                onClick={() => handleRemove(val)}
                                className="hover:text-red-500 transition-colors"
                            >
                                <X size={14} strokeWidth={2.5} />
                            </button>
                        </div>
                    ))}
                    
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={selectedValues.length === 0 ? placeholder : "Add more..."}
                        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm font-medium py-1 placeholder:text-gray-400"
                    />
                </div>

                {showSuggestions && (
                    <div className="absolute z-[60] mt-2 w-full bg-white rounded-2xl border border-gray-100 shadow-2xl py-2 animate-in fade-in slide-in-from-top-2 duration-200 max-h-64 overflow-y-auto scrollbar-hide">
                        {!isExactMatch && inputValue.trim() && (
                            <button
                                onClick={handleAddNew}
                                className="w-full text-left px-4 py-3 hover:bg-[#2a276e]/5 flex items-center gap-3 group transition-colors border-b border-gray-50 mb-1"
                            >
                                <div className="w-8 h-8 bg-[#2a276e]/10 rounded-lg flex items-center justify-center text-[#2a276e]">
                                    <Plus size={16} />
                                </div>
                                <div>
                                    <span className="text-[13px] font-bold text-[#2a276e]">Add "{inputValue}"</span>
                                    <p className="text-[11px] text-gray-400">Save to Practice Settings</p>
                                </div>
                            </button>
                        )}

                        {filtered.length > 0 ? (
                            filtered.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => handleSelect(s.name)}
                                    className="w-full text-left px-5 py-3 hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Tag size={14} className="text-gray-300 group-hover:text-[#2a276e]" />
                                        <span>{s.name}</span>
                                    </div>
                                    <span className="text-[10px] uppercase tracking-wider text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Press Enter</span>
                                </button>
                            ))
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClinicalMultiSelect;
