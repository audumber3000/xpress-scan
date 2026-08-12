import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck, Loader2, Search, PenLine, ChevronRight } from 'lucide-react';
import { api } from '../../utils/api';
import { generatePatientPersona, generateInitialsAvatar } from '../../utils/avatar';

/**
 * The consents that have actually been signed.
 *
 * The page listed templates and live links and stopped there, so the one thing
 * a consent system exists to produce, the signed record, could not be seen
 * anywhere in the app. If somebody asks whether a patient consented to an
 * extraction in March, this is the screen that answers it.
 */
const SignedConsents = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await api.get('/consents/signed'));
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (rows === null) {
    return <div className="py-20 grid place-items-center text-gray-400"><Loader2 size={20} className="animate-spin" /></div>;
  }

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter((r) =>
        (r.patient_name || '').toLowerCase().includes(needle) ||
        (r.template_name || '').toLowerCase().includes(needle))
    : rows;

  if (rows.length === 0) {
    return (
      <div className="py-20 text-center">
        <FileCheck size={30} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm font-semibold text-gray-700">Nothing signed yet</p>
        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
          Send a form to a patient from the Forms tab. Once they sign it, the record appears
          here and on their file.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by patient or form"
          className="w-full h-10 pl-9 pr-3 border border-gray-200 rounded-lg text-sm focus:border-[#2a276e] outline-none"
        />
      </div>

      <p className="text-xs text-gray-400 mb-2">
        {shown.length} of {rows.length} signed {rows.length === 1 ? 'form' : 'forms'}
      </p>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {shown.map((r) => (
          <button
            key={r.id}
            onClick={() => r.patient_id && navigate(`/patient-profile/${r.patient_id}?tab=documents`)}
            className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors group"
          >
            <img
              src={generatePatientPersona({ name: r.patient_name }, 64)}
              onError={(e) => { e.target.onerror = null; e.target.src = generateInitialsAvatar(r.patient_name || 'Patient'); }}
              alt=""
              className="w-8 h-8 rounded-full object-cover border border-gray-100 flex-shrink-0"
            />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-gray-900 truncate">{r.patient_name}</span>
              <span className="block text-[11px] text-gray-500 truncate">{r.template_name}</span>
            </span>
            <span className="text-right flex-shrink-0">
              <span className="block text-[11px] text-gray-600">
                {r.signed_at
                  ? new Date(r.signed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Date not recorded'}
              </span>
              {/* A consent without a captured signature is materially weaker
                  evidence, so it is called out rather than shown as equal. */}
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                r.has_signature ? 'text-green-700' : 'text-amber-700'
              }`}>
                <PenLine size={9} />
                {r.has_signature ? 'Signed' : 'No signature on file'}
              </span>
            </span>
            <ChevronRight size={15} className="text-gray-300 group-hover:text-[#2a276e] flex-shrink-0 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default SignedConsents;
