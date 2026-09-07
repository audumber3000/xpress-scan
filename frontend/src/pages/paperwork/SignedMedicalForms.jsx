import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck, Loader2, Search, ChevronRight, FileText, ShieldCheck } from 'lucide-react';
import { api } from '../../utils/api';
import { notify } from '../../utils/notify';
import { generatePatientPersona, generateInitialsAvatar } from '../../utils/avatar';
import { formatDate } from '../../utils/datetime';

/**
 * The histories patients have actually signed.
 *
 * The counterpart to SignedConsents, and for the same reason: the signed record
 * is the thing the feature exists to produce, and until this list existed the
 * only way to answer "did we ever take a history from this patient?" was to
 * open files one at a time.
 *
 * The row opens the PDF, not the patient's file. Somebody looking here wants
 * the document — the file is one click further on, from the row's own link.
 */
const SignedMedicalForms = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [opening, setOpening] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.get('/forms/signed'));
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPdf = async (row) => {
    setOpening(row.id);
    try {
      const res = await api.get(`/forms/submissions/${row.id}/pdf`);
      // Opened rather than downloaded: the presigned link is short-lived and a
      // saved copy would go stale, and staff want to read it, not keep it.
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch {
      notify.problem('That signed copy could not be opened. The answers are still on the patient file.');
    } finally { setOpening(null); }
  };

  if (rows === null) {
    return <div className="py-12 grid place-items-center text-gray-400"><Loader2 size={18} className="animate-spin" /></div>;
  }

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center">
        <FileCheck size={26} className="mx-auto text-gray-300 mb-2.5" />
        <p className="text-[13px] font-semibold text-gray-700">Nothing signed yet</p>
        <p className="text-[12px] text-gray-500 mt-1 max-w-sm mx-auto">
          Send the medical form from a patient's file, from their appointment, or
          right after you register them. Once they sign it, it appears here and on their file.
        </p>
      </div>
    );
  }

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter((r) => (r.patient_name || '').toLowerCase().includes(needle))
    : rows;

  return (
    <div>
      {rows.length > 6 && (
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by patient"
            className="w-full h-9 pl-9 pr-3 border border-gray-200 rounded-lg text-[13px] focus:border-[#2a276e] outline-none"
          />
        </div>
      )}

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {shown.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50/70 transition-colors min-w-0">
            <img
              src={generatePatientPersona({ name: r.patient_name }, 64)}
              onError={(e) => { e.target.onerror = null; e.target.src = generateInitialsAvatar(r.patient_name || 'Patient'); }}
              alt=""
              className="w-8 h-8 rounded-full shrink-0 bg-gray-100"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-gray-900 truncate">{r.patient_name || 'Patient'}</p>
              <p className="text-[11.5px] text-gray-500 truncate">
                {r.submitted_at ? formatDate(r.submitted_at) : 'Date not recorded'}
                {r.reviewed ? ' · answers accepted onto the chart' : ' · not reviewed yet'}
              </p>
            </div>

            {r.has_pdf ? (
              <button onClick={() => openPdf(r)} disabled={opening === r.id}
                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-[12px] font-semibold hover:border-[#2a276e] hover:text-[#2a276e] disabled:opacity-50">
                {opening === r.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                Signed copy
              </button>
            ) : (
              // Storage was unreachable when they submitted. The answers survived,
              // so say which half is missing rather than showing a dead button.
              <span className="shrink-0 text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                Answers only
              </span>
            )}

            <button
              onClick={() => r.patient_id && navigate(`/patient-profile/${r.patient_id}?tab=files`)}
              title="Open the patient's file"
              className="shrink-0 p-1.5 text-gray-400 hover:text-[#2a276e]"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-[11.5px] text-gray-400 flex items-center gap-1.5">
        <ShieldCheck size={12} />
        Each signed copy records when it was submitted, from where, and a checksum of the document.
      </p>
    </div>
  );
};

export default SignedMedicalForms;
