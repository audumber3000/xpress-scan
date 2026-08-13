import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, BookOpen, AlertTriangle } from 'lucide-react';
import { notify } from '../../utils/notify';
import { api } from '../../utils/api';

/**
 * Ready-made consent wording a clinic can adopt.
 *
 * The section previously opened to an empty table and an "Add New Template"
 * button, which asks a dentist to write medico-legal wording from scratch.
 * Most will not, so consent goes unrecorded. This turns the starting point
 * into "pick these and edit" instead.
 *
 * Templates are copied on adopt, not referenced, so a clinic owns its wording
 * from that moment and nothing we change later alters a form they have already
 * reviewed and put their name to.
 */
const StarterLibrary = ({ open, onClose, onAdopted }) => {
  const [lib, setLib] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get('/consents/starter-library')
      .then((d) => {
        setLib(d);
        // Everything pre-ticked: the common case is a new clinic wanting the
        // lot, and unticking two is less work than ticking six.
        setPicked(new Set((d.templates || []).map((t) => t.name)));
      })
      .catch(() => setLib({ categories: [], templates: [] }));
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (name) => setPicked((p) => {
    const next = new Set(p);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const adopt = async () => {
    setSaving(true);
    try {
      const res = await api.post('/consents/templates/adopt', { names: [...picked] });
      const n = res.created?.length || 0;
      notify.done(n ? `${n} form${n === 1 ? '' : 's'} added` : 'Those were already in your list');
      onAdopted?.();
      onClose();
    } catch (e) {
      notify.problem(e, 'Could not add those');
    } finally {
      setSaving(false);
    }
  };

  const label = (key) =>
    lib?.categories?.find((c) => c.key === key)?.label || 'Other';

  const grouped = (lib?.templates || []).reduce((acc, t) => {
    (acc[t.category] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-[#2a276e]/10 text-[#2a276e] grid place-items-center flex-shrink-0">
              <BookOpen size={16} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 leading-tight">Start from a ready-made form</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Common dental consents, written plainly. Add them and edit to suit your practice.
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-gray-400 hover:text-gray-700 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!lib ? (
            <div className="py-12 grid place-items-center text-gray-400"><Loader2 size={20} className="animate-spin" /></div>
          ) : (
            <>
              {/* Said plainly and up front. These are a starting point, not
                  vetted legal advice, and a clinic needs to know that before
                  it puts its name on one. */}
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 mb-4">
                <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  These are a starting point, not legal advice. Read each one and adapt it to how
                  you actually work before you send it to a patient.
                </p>
              </div>

              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} className="mb-4 last:mb-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    {label(cat)}
                  </p>
                  <div className="space-y-1.5">
                    {items.map((t) => {
                      const on = picked.has(t.name);
                      return (
                        <button
                          key={t.name}
                          onClick={() => toggle(t.name)}
                          className={`w-full text-left flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                            on ? 'border-[#2a276e]/40 bg-[#2a276e]/5' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded grid place-items-center flex-shrink-0 mt-0.5 border ${
                            on ? 'bg-[#2a276e] border-[#2a276e] text-white' : 'border-gray-300'
                          }`}>
                            {on && <Check size={11} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-gray-900">{t.name}</span>
                            <span className="block text-[11px] text-gray-500 line-clamp-2 mt-0.5">
                              {String(t.preview || '').replace(/<[^>]+>/g, ' ').trim()}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-200 flex-shrink-0">
          <span className="text-xs text-gray-500">{picked.size} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:border-gray-300">
              Cancel
            </button>
            <button
              onClick={adopt}
              disabled={saving || picked.size === 0}
              className="px-5 h-10 rounded-lg bg-[#2a276e] hover:bg-[#1a1548] text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Add {picked.size || ''} to my forms
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StarterLibrary;
