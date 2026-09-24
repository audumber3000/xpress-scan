import React, { useCallback, useEffect, useState } from 'react';
import { X, Star, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../utils/api';
import { notify } from '../../utils/notify';
import Spinner from '../../components/common/Spinner';
import InlineFeedback from '../../components/common/InlineFeedback';
import { CONSENT_LANGUAGES, categoryLabel } from '../../components/consents/consentContent';

/**
 * The ready-made consent forms, in every language we ship.
 *
 * English is already in every clinic's list; this is where a clinic that
 * treats Marathi or Tamil speakers picks those versions up. Adding one copies
 * it into the clinic's own forms, starred, so it sits at the top of the list
 * and of the patient's quick picks.
 */
const ConsentLibraryDrawer = ({ open, onClose, onAdded }) => {
  const [language, setLanguage] = useState('hi');
  const [forms, setForms] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState('');
  const [expanded, setExpanded] = useState('');

  const load = useCallback(async (lang) => {
    setForms(null);
    setError('');
    try {
      const res = await api.get('/consents/library', { params: { language: lang } });
      setForms(res?.forms || []);
    } catch (e) {
      setForms([]);
      setError(getFriendlyErrorMessage(e, 'Could not load the library.'));
    }
  }, []);

  useEffect(() => {
    if (open) load(language);
  }, [open, language, load]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const add = async (form) => {
    setAdding(form.key);
    try {
      await api.post('/consents/library/add', { language: form.language, key: form.key });
      setForms((prev) => prev.map((f) => (f.key === form.key ? { ...f, added: true } : f)));
      onAdded?.();
      notify.done(`${form.name} added to your forms`);
    } catch (e) {
      notify.problem(getFriendlyErrorMessage(e, 'Could not add that form.'));
    } finally {
      setAdding('');
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex justify-end ${open ? 'visible' : 'invisible'}`}>
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-library-title"
        className={`relative z-10 w-full max-w-lg bg-white h-full border-l border-gray-200 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <h2 id="consent-library-title" className="text-lg font-bold text-gray-900">Consent form library</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Ready forms in 7 languages. Add one and it lands in your list, starred.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-2" role="tablist" aria-label="Language">
          {CONSENT_LANGUAGES.map((l) => (
            <button
              key={l.code}
              role="tab"
              aria-selected={language === l.code}
              onClick={() => setLanguage(l.code)}
              title={l.label}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                language === l.code
                  ? 'border-[#2a276e] bg-[#2a276e]/5 text-[#2a276e] font-semibold'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {l.native}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && <div className="p-6"><InlineFeedback tone="error">{error}</InlineFeedback></div>}
          {forms === null ? (
            <div className="py-16 flex justify-center"><Spinner className="w-5 h-5" /></div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {forms.map((f) => {
                const isOpen = expanded === f.key;
                return (
                  <li key={f.key} className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">{f.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{categoryLabel(f.category)}</p>
                      </div>
                      {f.added ? (
                        <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 border border-green-200">
                          <Check size={13} /> In your forms
                        </span>
                      ) : (
                        <button
                          onClick={() => add(f)}
                          disabled={!!adding}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#2a276e] hover:bg-[#1a1548] disabled:opacity-60"
                        >
                          {adding === f.key ? <Spinner className="w-3 h-3" /> : <Star size={13} />}
                          Add
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setExpanded(isOpen ? '' : f.key)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#2a276e] hover:underline"
                      aria-expanded={isOpen}
                    >
                      {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      {isOpen ? 'Hide wording' : 'Read the wording'}
                    </button>
                    {isOpen && (
                      <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-[13px] leading-relaxed text-gray-700 space-y-2">
                        {f.content.split('\n').filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
};

export default ConsentLibraryDrawer;
