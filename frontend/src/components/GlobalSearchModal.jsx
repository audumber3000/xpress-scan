import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, MapPin, CornerDownLeft, ArrowUp, ArrowDown, X } from 'lucide-react';
import { api } from '../utils/api';

/**
 * GlobalSearchModal — a centered command-palette style patient search.
 *
 * Opens from the header search icon (or ⌘/Ctrl+K). Matches the app's indigo
 * theme (#2a276e). Keyboard: ↑/↓ navigate, ↵ open, esc close.
 */
const BRAND = '#2a276e';

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';

const GlobalSearchModal = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Reset + focus on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Debounced patient search
  useEffect(() => {
    if (!open) return;
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await api.get(`/patients?search=${encodeURIComponent(query)}&limit=12`);
        const list = Array.isArray(data) ? data : (data?.patients || []);
        setResults(list);
        setActive(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  const openPatient = useCallback((p) => {
    if (!p) return;
    navigate(`/patient-profile/${p.id}`);
    onClose();
  }, [navigate, onClose]);

  // Keyboard navigation
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + results.length) % results.length); }
    else if (e.key === 'Enter') { e.preventDefault(); openPatient(results[active]); }
  };

  // Keep the active row in view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[10vh] bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onMouseDown={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100">
          <Search size={22} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search patients by name or phone…"
            className="flex-1 text-lg outline-none text-gray-900 placeholder-gray-300 bg-transparent"
          />
          <button
            className="p-2 rounded-lg text-gray-400 hover:text-[#2a276e] hover:bg-gray-50 transition-colors flex-shrink-0"
            title="Filters"
            tabIndex={-1}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto">
          {/* Empty / prompt states */}
          {!query.trim() && (
            <div className="px-5 py-12 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#2a276e]/5 flex items-center justify-center mb-3">
                <Search size={22} className="text-[#2a276e]/40" />
              </div>
              <p className="text-sm text-gray-400">Start typing to search your patients</p>
            </div>
          )}

          {query.trim() && loading && (
            <div className="px-5 py-12 flex items-center justify-center gap-3 text-gray-400">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-[#2a276e] rounded-full animate-spin" />
              <span className="text-sm">Searching…</span>
            </div>
          )}

          {query.trim() && !loading && results.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-gray-500">No patients found</p>
              <p className="text-xs text-gray-400 mt-1">Try a different name or phone number</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-2">
              <p className="px-5 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Patients ({results.length})
              </p>
              {results.map((p, i) => {
                const name = p.name || p.full_name || 'Unnamed';
                const role = p.treatment_type || p.category || '';
                const contact = p.email || p.phone || p.mobile || '';
                const location = p.village || p.city || p.location || '';
                const isActive = i === active;
                return (
                  <button
                    key={p.id ?? i}
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => openPatient(p)}
                    className={`w-full text-left px-5 py-3 flex items-center gap-4 transition-colors ${
                      isActive ? 'bg-[#2a276e]/[0.06]' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Avatar */}
                    {p.photo_url || p.avatar_url ? (
                      <img src={p.photo_url || p.avatar_url} alt="" className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                        style={{ backgroundColor: BRAND }}>
                        {initials(name)}
                      </div>
                    )}
                    {/* Name + meta */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-gray-900 truncate">{name}</p>
                      <p className="text-sm text-gray-400 truncate">
                        {contact}{contact && role ? '  |  ' : ''}{role}
                      </p>
                    </div>
                    {/* Location */}
                    {location && (
                      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 text-gray-600">
                        <MapPin size={15} className="text-[#2a276e]" />
                        <span className="text-sm font-medium">{location}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint bar */}
        <div className="flex items-center gap-5 px-5 h-12 border-t border-gray-100 bg-gray-50/60 text-[11px] font-semibold text-gray-400">
          <span className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center w-5 h-5 rounded border border-gray-200 bg-white"><ArrowUp size={11} /></kbd>
            <kbd className="inline-flex items-center justify-center w-5 h-5 rounded border border-gray-200 bg-white"><ArrowDown size={11} /></kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center w-5 h-5 rounded border border-gray-200 bg-white"><CornerDownLeft size={11} /></kbd>
            Open
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center px-1.5 h-5 rounded border border-gray-200 bg-white text-[10px]">esc</kbd>
            Close
          </span>
          <button onClick={onClose} className="ml-auto flex items-center gap-1 hover:text-gray-600 transition-colors">
            <X size={13} /> Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchModal;
