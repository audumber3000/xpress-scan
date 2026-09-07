import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  CheckCircle2, AlertCircle, Loader2, ArrowLeft, ArrowRight,
  FileText, ExternalLink,
} from 'lucide-react';
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
 *
 * Two shapes, decided by the form's own `kind`:
 *
 *   questionnaire     one scroll, one button. Twelve questions, unchanged.
 *   medical_history   a step per section, then the finished document with the
 *                     patient's signature on it, then submit. Forty questions
 *                     in one scroll is where people give up, and a legal record
 *                     signed without being seen is not one worth having.
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

/** Whether a value counts as no answer. Mirrors the server's rule exactly, so
 *  the button never lets somebody submit into a 400 they cannot act on. */
const unanswered = (field, v) => {
  if (field.type === 'yes_no_explain') return !(v && typeof v === 'object' && (v.answer || '').trim());
  return v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || v === false;
};

/** Split the schema on its `section` headings. A form with no headings comes
 *  back as one unnamed step, which is the questionnaire case. */
const toSteps = (schema) => {
  const steps = [];
  let current = { title: null, help: null, fields: [] };
  schema.forEach((f) => {
    if (f.type === 'section') {
      if (current.fields.length) steps.push(current);
      current = { title: f.label, help: f.help, fields: [] };
    } else {
      current.fields.push(f);
    }
  });
  if (current.fields.length) steps.push(current);
  return steps;
};

const FormFill = () => {
  const { token } = useParams();
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [invalidKeys, setInvalidKeys] = useState([]);
  const [step, setStep] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const topRef = useRef(null);

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

  // A blob URL outlives the component unless it is handed back, and this page
  // can mint a new one on every trip to the review screen.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const schema = form?.schema || [];
  const isMedical = form?.kind === 'medical_history';
  const steps = useMemo(() => toSteps(schema), [schema]);
  // Stepping only earns its keep when there is more than one section to step
  // through. A three-question form with a heading on it stays one screen.
  const stepped = isMedical && steps.length > 1;
  const visible = stepped ? (steps[step]?.fields || []) : schema.filter((f) => f.type !== 'section');

  const missingIn = (fields) => fields.filter((f) => f.required && unanswered(f, answers[f.key]));
  const missing = useMemo(() => missingIn(schema.filter((f) => f.type !== 'section')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema, answers]);

  const flagMissing = (fields) => {
    const gaps = missingIn(fields);
    if (!gaps.length) return false;
    setInvalidKeys(gaps.map((f) => f.key));
    const el = document.getElementById(gaps[0].key);
    (el || document.querySelector('fieldset'))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  };

  const goTo = (n) => {
    setStep(n);
    setInvalidKeys([]);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const next = () => {
    if (flagMissing(steps[step]?.fields || [])) return;
    goTo(step + 1);
  };

  // Renders the finished document without storing anything, so a patient who
  // looks at it and closes the tab has submitted nothing.
  const review = async () => {
    if (flagMissing(steps[step]?.fields || [])) return;
    setPreviewing(true);
    setError('');
    try {
      const res = await axios.post(`${API}/public/forms/${token}/preview`, { answers },
        { responseType: 'blob' });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(res.data));
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      setError('Could not prepare your document. Please check your answers and try again.');
    } finally {
      setPreviewing(false);
    }
  };

  const submit = async () => {
    if (flagMissing(schema.filter((f) => f.type !== 'section'))) return;
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
      Your {isMedical ? 'signed form' : 'answers'} went to {form.clinic_name || 'the clinic'} and
      {isMedical ? ' is now on your file.' : ' has been recorded.'} You can close this page.
    </Screen>;
  }

  const header = (
    <header ref={topRef} className="bg-white border-b border-gray-200">
      <div className="max-w-xl mx-auto px-5 py-4">
        <p className="text-[13px] font-semibold text-[#2a276e]">{form.clinic_name}</p>
        <h1 className="mt-0.5 text-lg font-bold text-gray-900 leading-tight">{form.form_name}</h1>
        {!previewUrl && (
          <p className="mt-1 text-[14px] text-gray-600">
            {form.patient_first_name ? `Hello ${form.patient_first_name}. ` : ''}
            Please answer these before your visit.
            {stepped ? ' Your answers are kept on this page until you send them.' : ' It takes a couple of minutes.'}
          </p>
        )}

        {stepped && !previewUrl && (
          <div className="mt-3">
            <div className="flex gap-1.5" aria-hidden="true">
              {steps.map((s, i) => (
                <span
                  key={s.title || i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i < step ? 'bg-[#2a276e]' : i === step ? 'bg-[#2a276e]/50' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-[13px] font-semibold text-gray-700">
              Step {step + 1} of {steps.length}
              {steps[step]?.title ? `: ${steps[step].title}` : ''}
            </p>
            {steps[step]?.help && (
              <p className="mt-0.5 text-[13px] text-gray-500 leading-snug">{steps[step].help}</p>
            )}
          </div>
        )}
      </div>
    </header>
  );

  // ── Review: the document as it will be filed ────────────────────────────
  if (previewUrl) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {header}
        <main className="flex-1 max-w-xl w-full mx-auto px-5 py-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <FileText size={18} className="text-[#2a276e] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-gray-900">Check your form before you send it</h2>
                <p className="mt-1 text-[14px] text-gray-600 leading-relaxed">
                  This is exactly what your clinic will keep on file, with your signature on it.
                  Nothing has been sent yet.
                </p>
              </div>
            </div>

            <div className="mt-3.5 rounded-xl border border-gray-200 overflow-hidden bg-gray-100">
              <iframe
                src={previewUrl}
                title="Your completed form"
                className="w-full h-[55vh] min-h-[320px] bg-white"
              />
            </div>

            {/* Phone browsers show a PDF in a frame inconsistently, and some
                show only the first page. The link is not a nicety, it is how a
                patient on iOS reads page two before signing off on it. */}
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2.5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#2a276e] hover:underline"
            >
              <ExternalLink size={14} /> Open the full document
            </a>
          </div>

          {error && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">
              {error}
            </p>
          )}
        </main>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200">
          <div className="max-w-xl mx-auto px-5 py-3.5 flex gap-2.5">
            <button
              type="button"
              onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(''); }}
              disabled={submitting}
              className="rounded-xl border border-gray-300 px-4 py-3.5 text-[15px] font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-60 inline-flex items-center gap-2"
            >
              <ArrowLeft size={16} /> Change something
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex-1 rounded-xl bg-[#2a276e] px-4 py-3.5 text-[15px] font-semibold text-white hover:bg-[#1e1c4f] transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 size={16} className="animate-spin" /> Sending</> : 'Sign and send'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Filling ─────────────────────────────────────────────────────────────
  const onLastStep = !stepped || step === steps.length - 1;
  const stepGaps = stepped ? missingIn(steps[step]?.fields || []).length : missing.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {header}

      <main className="max-w-xl mx-auto px-5 py-5 space-y-3">
        {visible.map((f) => (
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
          <div className="flex gap-2.5">
            {stepped && step > 0 && (
              <button
                type="button"
                onClick={() => goTo(step - 1)}
                className="rounded-xl border border-gray-300 px-4 py-3.5 text-[15px] font-semibold text-gray-700 hover:bg-gray-50 transition inline-flex items-center gap-2"
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}
            <button
              type="button"
              onClick={onLastStep ? (isMedical ? review : submit) : next}
              disabled={submitting || previewing}
              className="flex-1 rounded-xl bg-[#2a276e] px-4 py-3.5 text-[15px] font-semibold text-white hover:bg-[#1e1c4f] transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {previewing && <Loader2 size={16} className="animate-spin" />}
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {previewing ? 'Preparing your form'
                : submitting ? 'Sending'
                : !onLastStep ? <>Next <ArrowRight size={16} /></>
                : isMedical ? 'Review and sign'
                : 'Send to the clinic'}
            </button>
          </div>
          <p className="mt-2 text-center text-[12px] text-gray-500">
            {stepGaps
              ? `${stepGaps} question${stepGaps === 1 ? '' : 's'} still to answer${stepped && !onLastStep ? ' on this step' : ''}`
              : 'Your answers go only to this clinic.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FormFill;
