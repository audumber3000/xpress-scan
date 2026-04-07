import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';
import { Search, Plus } from 'lucide-react';

/**
 * ClinicalAutocomplete - Smart search-and-select component with self-learning
 */
const ClinicalAutocomplete = ({ category, value, onChange, onSelectFull, placeholder, label }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const wrapperRef = useRef(null);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        const fetchSuggestions = async () => {
            try {
                let endpoint = `/clinical/settings/?category=${category}`;
                if (category === 'procedure') {
                    endpoint = '/treatment-types/';
                }
                const response = await api.get(endpoint);
                setSuggestions(response);
            } catch (err) {
                console.error("Failed to fetch clinical suggestions:", err);
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
                s.name.toLowerCase().includes(val.toLowerCase())
            );
            setFiltered(matches);
            setShowSuggestions(true);
        } else {
            setFiltered([]);
            setShowSuggestions(false);
        }
        
        // Update parent with current typed value (even if not from suggestion)
        onChange(val);
    };

    const handleSelect = (suggestion) => {
        setInputValue(suggestion.name);
        onChange(suggestion.name);
        if (onSelectFull) onSelectFull(suggestion);
        setShowSuggestions(false);
    };

    const handleAddNew = async () => {
        if (!inputValue.trim()) return;
        
        try {
            const response = await api.post('/clinical/settings/', {
                category,
                name: inputValue.trim(),
                is_active: true
            });
            // Update local suggestions list
            setSuggestions([...suggestions, response]);
            onChange(inputValue.trim());
            setShowSuggestions(false);
        } catch (err) {
            console.error("Failed to auto-save new clinical setting:", err);
            setShowSuggestions(false);
        }
    };

    const isExactMatch = suggestions.some(s => s.name.toLowerCase() === inputValue.toLowerCase());

    return (
        <div className="relative w-full" ref={wrapperRef}>
            {label && (
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
                    {label}
                </label>
            )}
            <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#2a276e] transition-colors">
                    <Search size={16} />
                </div>
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => inputValue.trim() && setShowSuggestions(true)}
                    placeholder={placeholder}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#2a276e] focus:ring-4 focus:ring-[#2a276e]/5 outline-none text-sm transition-all shadow-sm group-hover:border-gray-300"
                />
            </div>

            {showSuggestions && (
                <div className="absolute z-[60] mt-2 w-full bg-white rounded-2xl border border-gray-100 shadow-2xl py-2 animate-in fade-in slide-in-from-top-2 duration-200 max-h-64 overflow-y-auto scrollbar-hide">
                    {/* Add New Option (if not exact match) */}
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
                                <p className="text-[11px] text-gray-400">Save to Practice Settings for future use</p>
                            </div>
                        </button>
                    )}

                    {filtered.length > 0 ? (
                        filtered.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => handleSelect(s)}
                                className="w-full text-left px-5 py-2.5 hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors flex items-center justify-between group"
                            >
                                <span>{s.name}</span>
                                <span className="text-[10px] uppercase tracking-wider text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">Select suggestion</span>
                            </button>
                        ))
                    ) : (
                        !isExactMatch && !inputValue.trim() && (
                            <div className="px-5 py-6 text-center text-gray-400">
                                <p className="text-sm">Start typing to see suggestions...</p>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default ClinicalAutocomplete;
