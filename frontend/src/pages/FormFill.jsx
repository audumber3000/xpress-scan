import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import FormField from '../components/forms/FormField';

/**
 * The patient's form, opened from a WhatsApp link on their phone.
 *
 * Public: the token in the URL is the only credential, so this page never asks
 * anyone to sign in — a medical history that needs an account is a medical
 * history that stays unanswered.
 *
 * Deliberately no clinic chrome. It renders a single column at phone width and
 * says who is asking, because that is the first thing somebody checks before
 * typing their medical history into a link they were sent.
 */
const API = `${import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:8000`}/api/v1`;

const Screen = ({ icon, title, children }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
    <div className="max-w-sm w-full text-center">
      {icon}
      <h1 className="mt-4 text-lg font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-[15px] text-gray-600 leading-relaxed">{children}</p>
    </div>
  </div>
);

const FormFill = () => {
  const { token } = useParams();
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [invalidKeys, setInvalidKeys] = useState([]);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API}/public/forms/${token}`)
      .then((r) => { if (!cancelled) setForm(r.data); })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.response?.data?.detail || 'This link could not be opened.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const schema = form?.schema || [];

  // Answered against required, so the button can say what is left rather than
  // failing on submit. Empty string, empty list and an unticked box all count
  // as unanswered — the server applies the same rule.
  const missing = useMemo(() => schema.filter((f) => {
    if (!f.required) return false;
    const v = answers[f.key];
    return v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || v === false;
  }), [schema, answers]);

  const submit = async () => {
    if (missing.length) {
      setInvalidKeys(missing.map((f) => f.key));
      const el = document.getElementById(missing[0].key);
      (el || document.querySelector('fieldset'))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await axios.post(`${API}/public/forms/${token}/submit`, { answers });
      setDone(true);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not send your answers. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Screen icon={<Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto" />} title="Opening your form">
      One moment.
    </Screen>;
  }

  if (error && !form) {
    return <Screen icon={<AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />} title="This link is not available">
      {error} Please ask the clinic to send you a new one.
    </Screen>;
  }

  if (done) {
    return <Screen icon={<CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />} title="Thank you">
      Your answers have been sent to {form.clinic_name || 'the clinic'}. You can close this page.
    </Screen>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-xl mx-auto px-5 py-4">
          <p className="text-[13px] font-semibold text-[#2a276e]">{form.clinic_name}</p>
          <h1 className="mt-0.5 text-lg font-bold text-gray-900 leading-tight">{form.form_name}</h1>
          <p className="mt-1 text-[14px] text-gray-600">
            {form.patient_first_name ? `Hello ${form.patient_first_name}. ` : ''}
            Please answer these before your visit. It takes a couple of minutes.
          </p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 py-5 space-y-3">
        {schema.map((f) => (
          <FormField
            key={f.key}
            field={f}
            value={answers[f.key]}
            invalid={invalidKeys.includes(f.key)}
            onChange={(v) => {
              setAnswers((prev) => ({ ...prev, [f.key]: v }));
              setInvalidKeys((prev) => prev.filter((k) => k !== f.key));
            }}
          />
        ))}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">
            {error}
          </p>
        )}
      </main>

      {/* Sticky so the action is reachable without scrolling back down a long
          form, which on a phone is most of them. */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200">
        <div className="max-w-xl mx-auto px-5 py-3.5">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="w-full rounded-xl bg-[#2a276e] px-4 py-3.5 text-[15px] font-semibold text-white hover:bg-[#1e1c4f] transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Sending</> : 'Send to the clinic'}
          </button>
          <p className="mt-2 text-center text-[12px] text-gray-500">
            {missing.length
              ? `${missing.length} question${missing.length === 1 ? '' : 's'} still to answer`
              : 'Your answers go only to this clinic.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FormFill;
