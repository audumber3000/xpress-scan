import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowRight, Check } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../utils/api';
import Spinner from '../common/Spinner';
import InlineFeedback from '../common/InlineFeedback';
import { formatDateTime } from '../../utils/datetime';

/**
 * What the patient answered, and what to do with it.
 *
 * The mapped fields come first and carry a decision, because they are the only
 * answers that can change the chart. Everything else is shown read-only — worth
 * reading, not worth a checkbox.
 *
 * Nothing is pre-accepted. An "accept all" default would make the review step
 * decorative, and the point of it is that a patient's typo cannot silently
 * replace an allergy.
 */
const FormReviewModal = ({ submissionId, onClose, onApplied }) => {
  const [data, setData] = useState(null);
  const [accepted, setAccepted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let off = false;
    api.get(`/forms/submissions/${submissionId}`)
      .then((d) => { if (!off) setData(d); })
      .catch((e) => { if (!off) setError(getFriendlyErrorMessage(e, 'Could not load this form.')); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [submissionId]);

  const mapped = data?.mapped || [];
  const changes = useMemo(() => mapped.filter((m) => !m.same && m.proposed), [mapped]);
  const applied = data?.status === 'applied';

  const unmapped = useMemo(() => {
    if (!data) return [];
    const mappedKeys = new Set(mapped.map((m) => m.key));
    return (data.schema || [])
      .filter((f) => !mappedKeys.has(f.key))
      .map((f) => {
        let v = data.answers?.[f.key];
        if (Array.isArray(v)) v = v.join(', ');
        if (v === true) v = 'Yes';
        if (f.type === 'signature') v = v ? 'Signed' : null;
        return { key: f.key, label: f.label, value: v };
      })
      .filter((x) => x.value !== undefined && x.value !== null && x.value !== '');
  }, [data, mapped]);

  const apply = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.post(`/forms/submissions/${submissionId}/apply`, { accept_keys: accepted });
      onApplied?.(res);
      onClose();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not save those changes.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-gray-900 truncate">
              {data?.form_name || 'Form'}
            </h2>
            <p className="text-[12px] text-gray-500 mt-0.5">
              {data?.patient_name}
              {data?.submitted_at ? ` · answered ${formatDateTime(data.submitted_at)}` : ''}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-gray-100 rounded-full">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="flex items-center gap-2 py-6 text-[13px] text-gray-500">
              <Spinner className="w-4 h-4" /> Loading
            </div>
          )}

          {error && <InlineFeedback tone="error">{error}</InlineFeedback>}

          {!loading && data && (
            <>
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2.5">
                  Changes to the patient record
                </h3>

                {changes.length === 0 ? (
                  <p className="text-[13px] text-gray-400">
                    Nothing here differs from what is already on file.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {changes.map((m) => {
                      const on = accepted.includes(m.key);
                      return (
                        <li key={m.key}>
                          <button
                            type="button"
                            disabled={applied}
                            onClick={() => setAccepted((p) =>
                              on ? p.filter((k) => k !== m.key) : [...p, m.key])}
                            className={`w-full text-left rounded-lg border p-3 transition disabled:opacity-60 ${
                              on ? 'border-[#2a276e] bg-indigo-50/50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                on ? 'border-[#2a276e] bg-[#2a276e] text-white' : 'border-gray-300'
                              }`}>
                                {on && <Check size={11} strokeWidth={3} />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                                  {m.maps_to_label}
                                </p>
                                <div className="mt-1 flex items-center gap-2 text-[13px] min-w-0">
                                  <span className="text-gray-400 line-through truncate max-w-[40%]">
                                    {m.current || 'nothing on file'}
                                  </span>
                                  <ArrowRight size={13} className="text-gray-400 flex-shrink-0" />
                                  <span className="font-semibold text-gray-900 truncate">{m.proposed}</span>
                                </div>
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {unmapped.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2.5">
                    Everything else they told you
                  </h3>
                  <dl className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                    {unmapped.map((u) => (
                      <div key={u.key} className="px-3.5 py-2.5">
                        <dt className="text-[12px] text-gray-500">{u.label}</dt>
                        <dd className="text-[13px] text-gray-900 mt-0.5 break-words">{u.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <p className="text-[12px] text-gray-500">
            {applied
              ? 'Already applied to the record.'
              : accepted.length
                ? `${accepted.length} change${accepted.length === 1 ? '' : 's'} will be saved`
                : 'Nothing selected — the record will not change.'}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-[13px] font-semibold hover:bg-gray-50">
              Close
            </button>
            {!applied && (
              <button onClick={apply} disabled={saving}
                className="px-3.5 py-2 rounded-lg bg-[#2a276e] text-white text-[13px] font-semibold hover:bg-[#1e1c4f] disabled:opacity-50 inline-flex items-center gap-2">
                {accepted.length ? `Apply ${accepted.length}` : 'Mark reviewed'}
                {saving && <Spinner className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormReviewModal;
