import React, { useState, useEffect, useRef } from 'react';
import Spinner from "../common/Spinner";
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
    const [saving, setSaving] = useState(false);
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
        if (saving) return;
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

        // Only from here on is there a round trip to wait for. Flipping it any
        // earlier would strand the button spinning on the three paths above,
        // every one of which returns without touching the network.
        setSaving(true);
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
        setSaving(false);
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
                {/* min-h keeps the four boxes level when one has pills and its
                    neighbour is empty, instead of the row jumping as you type.
                    Border-only: the shadow went with the rest of the app's. */}
                <div className="flex flex-wrap content-start gap-2 p-2.5 min-h-[86px] bg-white border border-gray-200 rounded-lg focus-within:border-[#2a276e] focus-within:ring-2 focus-within:ring-[#2a276e]/15 transition-[border-color,box-shadow] duration-150 ease-out group-hover:border-gray-300">
                    {selectedValues.map((val, idx) => (
                        <div 
                            key={idx}
                            /* A small radius, not a capsule. `rounded-full` on a
                               text pill reads as a tag on a consumer app; a clinical
                               record wants the squarer, quieter shape. 6px against
                               the box's 8px also keeps the two concentric instead of
                               a round pill sitting inside a squared-off container. */
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#2a276e]/5 text-[#2a276e] border border-[#2a276e]/10 rounded-md text-sm font-semibold"
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
                    <div className="absolute z-[60] mt-1.5 w-full bg-white rounded-xl border border-gray-200 shadow-lg py-1.5 max-h-64 overflow-y-auto scrollbar-hide">
                        {!isExactMatch && inputValue.trim() && (
                            <button
                                onClick={handleAddNew}
                                disabled={saving}
                                className="w-full text-left px-4 py-3 hover:bg-[#2a276e]/5 flex items-center gap-3 group transition-colors border-b border-gray-50 mb-1"
                            >
                                <div className="w-8 h-8 bg-[#2a276e]/10 rounded-lg flex items-center justify-center text-[#2a276e]">
                                    {saving ? <Spinner className="w-4 h-4" /> : <Plus size={16} />}
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
