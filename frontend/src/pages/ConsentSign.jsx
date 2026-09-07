import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";
import axios from "axios";
import {
  CheckCircle2, AlertCircle, Loader2, ArrowLeft, FileText, ExternalLink, Check,
} from "lucide-react";
import { notify } from '../utils/notify';

/**
 * The consent a patient opens from a WhatsApp link on their phone.
 *
 * Rebuilt to the same shape as the medical form (pages/FormFill.jsx), because
 * they are the same act: a patient reading a document, signing it, and it being
 * filed. It used to submit straight off the signature pad — the patient agreed
 * to a wall of text on a phone screen and the finished document was something
 * only the clinic ever saw.
 *
 * Now: read, agree, sign, then see the actual PDF with the signature on it, and
 * only then submit. The preview is rendered by the same code path that files
 * the copy (ConsentService.render_pdf), so what they approve is the document,
 * not an impression of it. Nothing is stored until they press the last button,
 * and the link survives being previewed, so changing their mind costs nothing.
 */
const Screen = ({ icon, title, children }) => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
            {icon}
            <h1 className="mt-4 text-lg font-bold text-gray-900">{title}</h1>
            <p className="mt-2 text-[15px] text-gray-600 leading-relaxed">{children}</p>
        </div>
    </div>
);

const ConsentSign = () => {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [tokenData, setTokenData] = useState(null);
    const [branding, setBranding] = useState(null);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [signed, setSigned] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [done, setDone] = useState(false);
    const sigPad = useRef(null);
    const topRef = useRef(null);

    const NEXUS_API_URL = import.meta.env.VITE_NEXUS_API_URL || `http://${window.location.hostname}:8001/api/v1`;
    const MAIN_API_URL = `${import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:8000`}/api/v1`;

    useEffect(() => { validateToken(); /* eslint-disable-next-line */ }, [token]);

    // A blob URL is held by the document until it is handed back, and this page
    // can mint a new one every time the patient returns to the review screen.
    useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

    // Opened with ?print=1 from the clinic's Sent Links tab: go straight to the
    // browser's print sheet, which is how staff save a copy as PDF.
    useEffect(() => {
        if (loading) return;
        if (new URLSearchParams(window.location.search).get('print') !== '1') return;
        const t = setTimeout(() => window.print(), 600);
        return () => clearTimeout(t);
    }, [loading]);

    const validateToken = async () => {
        try {
            const res = await axios.get(`${NEXUS_API_URL}/consent/validate/${token}`);
            if (res.data.valid) {
                setTokenData(res.data.data);
                const clinicId = res.data.data?.clinicId;
                if (clinicId) {
                    axios.get(`${MAIN_API_URL}/clinics/${clinicId}/branding`)
                        .then(r => setBranding(r.data))
                        .catch(() => { /* branding is best-effort */ });
                }
            } else {
                setError(res.data.message || 'This link is no longer valid.');
            }
        } catch {
            setError("We could not open this link. Please ask the clinic to send you a new one.");
        } finally {
            setLoading(false);
        }
    };

    const clearSignature = () => { sigPad.current?.clear(); setSigned(false); };

    /** Render the finished consent without filing it. */
    const review = async () => {
        if (!agreed) { setNotice('Please tick the box to say you have read and understood it.'); return; }
        if (!sigPad.current || sigPad.current.isEmpty()) { setNotice('Please sign in the box above.'); return; }
        setNotice('');
        setPreviewing(true);
        try {
            const signature = sigPad.current.getCanvas().toDataURL("image/png");
            const res = await axios.post(`${NEXUS_API_URL}/consent/preview/${token}`,
                { signature }, { responseType: 'blob' });
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(URL.createObjectURL(res.data));
            topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
            setNotice('We could not prepare your document. Please try again.');
        } finally {
            setPreviewing(false);
        }
    };

    const submit = async () => {
        setSubmitting(true);
        setNotice('');
        try {
            const signature = sigPad.current.getCanvas().toDataURL("image/png");
            await axios.post(`${NEXUS_API_URL}/consent/submit/${token}`, { signature });
            setDone(true);
        } catch (err) {
            const detail = err.response?.data?.detail || err.response?.data?.error || err.message;
            notify.problem(`We could not record your consent. ${detail || 'Please try again.'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const accent = branding?.primary_color || '#2a276e';
    const clinicName = branding?.name || 'Clinic';

    if (loading) {
        return <Screen icon={<Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto" />} title="Opening your form">
            One moment.
        </Screen>;
    }

    if (error) {
        return <Screen icon={<AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />} title="This link is not available">
            {error}
        </Screen>;
    }

    if (done) {
        return <Screen icon={<CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />} title="Thank you">
            Your signed consent has gone to {clinicName} and is now on your file. You can close this page.
        </Screen>;
    }

    const header = (
        <header ref={topRef} className="bg-white border-b border-gray-200">
            <div className="max-w-xl mx-auto px-5 py-4 flex items-center gap-3">
                {branding?.logo_url && (
                    <img src={branding.logo_url} alt="" className="w-10 h-10 object-contain shrink-0" />
                )}
                <div className="min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: accent }}>{clinicName}</p>
                    <h1 className="mt-0.5 text-lg font-bold text-gray-900 leading-tight truncate">
                        {tokenData?.templateName || 'Consent form'}
                    </h1>
                </div>
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
                            <FileText size={18} className="mt-0.5 shrink-0" style={{ color: accent }} />
                            <div className="min-w-0">
                                <h2 className="text-[15px] font-bold text-gray-900">Check it before you send it</h2>
                                <p className="mt-1 text-[14px] text-gray-600 leading-relaxed">
                                    This is exactly what {clinicName} will keep on file, with your signature on it.
                                    Nothing has been sent yet.
                                </p>
                            </div>
                        </div>

                        <div className="mt-3.5 rounded-xl border border-gray-200 overflow-hidden bg-gray-100">
                            <iframe src={previewUrl} title="Your signed consent"
                                    className="w-full h-[55vh] min-h-[320px] bg-white" />
                        </div>

                        {/* Phone browsers render a framed PDF inconsistently and some show
                            only the first page. This is how a patient on iOS reads all of
                            it before signing off on it. */}
                        <a href={previewUrl} target="_blank" rel="noreferrer"
                           className="mt-2.5 inline-flex items-center gap-1.5 text-[14px] font-semibold hover:underline"
                           style={{ color: accent }}>
                            <ExternalLink size={14} /> Open the full document
                        </a>
                    </div>

                    {notice && (
                        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">
                            {notice}
                        </p>
                    )}
                </main>

                <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200">
                    <div className="max-w-xl mx-auto px-5 py-3.5 flex gap-2.5">
                        <button type="button" disabled={submitting}
                                onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(''); }}
                                className="rounded-xl border border-gray-300 px-4 py-3.5 text-[15px] font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-60 inline-flex items-center gap-2">
                            <ArrowLeft size={16} /> Change something
                        </button>
                        <button type="button" onClick={submit} disabled={submitting}
                                className="flex-1 rounded-xl px-4 py-3.5 text-[15px] font-semibold text-white transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
                                style={{ backgroundColor: accent }}>
                            {submitting ? <><Loader2 size={16} className="animate-spin" /> Sending</> : 'Sign and send'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Reading and signing ────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50">
            {header}

            <main className="max-w-xl mx-auto px-5 py-5 space-y-3">
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="text-[13px] text-gray-500">
                        For <span className="font-semibold text-gray-700">{tokenData?.patientName}</span>
                        {' · '}{new Date().toLocaleDateString()}
                    </p>
                    {/* Capped and scrollable, not collapsed behind a "read more".
                        The patient has to be able to see how long it is; a
                        document you must expand to read is one people agree to
                        without reading. */}
                    <div className="mt-3 max-h-[46vh] overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                        <p className="text-[14px] leading-relaxed text-gray-700 whitespace-pre-wrap">
                            {tokenData?.content}
                        </p>
                    </div>
                </div>

                <fieldset className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4">
                    <button type="button" onClick={() => { setAgreed((v) => !v); setNotice(''); }}
                            className={`flex items-center gap-2.5 w-full rounded-xl border px-3.5 py-3 text-left text-[15px] transition ${
                                agreed ? 'font-semibold' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                            }`}
                            style={agreed ? { borderColor: accent, backgroundColor: `${accent}0d`, color: accent } : undefined}>
                        <span className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0"
                              style={agreed ? { borderColor: accent, backgroundColor: accent, color: '#fff' } : { borderColor: '#d1d5db', background: '#fff' }}
                              aria-hidden="true">
                            {agreed && <Check size={13} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                            I have read and understood the document above and give my consent.
                        </span>
                    </button>
                </fieldset>

                <fieldset className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4">
                    <label className="block text-[15px] font-semibold text-gray-900 leading-snug">
                        Signature <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <div className="mt-2.5 rounded-xl border border-gray-300 bg-white overflow-hidden">
                        <SignatureCanvas ref={sigPad} penColor="#111827"
                                         canvasProps={{ className: 'w-full h-40 touch-none' }}
                                         onEnd={() => { setSigned(true); setNotice(''); }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                        <p className="text-[13px] text-gray-500">Sign with your finger.</p>
                        <button type="button" onClick={clearSignature}
                                className="text-[13px] font-semibold hover:underline" style={{ color: accent }}>
                            Clear
                        </button>
                    </div>
                </fieldset>

                {notice && (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">
                        {notice}
                    </p>
                )}
            </main>

            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200">
                <div className="max-w-xl mx-auto px-5 py-3.5">
                    <button type="button" onClick={review} disabled={previewing}
                            className="w-full rounded-xl px-4 py-3.5 text-[15px] font-semibold text-white transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
                            style={{ backgroundColor: accent }}>
                        {previewing ? <><Loader2 size={16} className="animate-spin" /> Preparing your document</> : 'Review and sign'}
                    </button>
                    <p className="mt-2 text-center text-[12px] text-gray-500">
                        {!agreed ? 'Tick the box above to continue'
                            : !signed ? 'Add your signature to continue'
                            : "You will see the finished document before anything is sent."}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ConsentSign;
