
import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";
import axios from "axios";
import { toast } from "react-toastify";

const ConsentSign = () => {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [tokenData, setTokenData] = useState(null);
    const [branding, setBranding] = useState(null);  // real clinic letterhead
    const [error, setError] = useState(null);
    const [agreed, setAgreed] = useState(false);
    const sigPad = useRef(null);

    const NEXUS_API_URL = import.meta.env.VITE_NEXUS_API_URL || `http://${window.location.hostname}:8001/api/v1`;
    const MAIN_API_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api/v1`;

    useEffect(() => {
        validateToken();
    }, [token]);

    const validateToken = async () => {
        try {
            const res = await axios.get(`${NEXUS_API_URL}/consent/validate/${token}`);
            if (res.data.valid) {
                setTokenData(res.data.data);
                // Phase 8: fetch real clinic branding so the signing page shows
                // the actual clinic name / color / logo, not a hardcoded brand.
                const clinicId = res.data.data?.clinicId;
                if (clinicId) {
                    axios.get(`${MAIN_API_URL}/clinics/${clinicId}/branding`)
                        .then(r => setBranding(r.data))
                        .catch(() => { /* branding is best-effort; fall back to defaults */ });
                }
            } else {
                setError(res.data.message);
            }
        } catch (err) {
            setError("Unable to connect to signature service");
        } finally {
            setLoading(false);
        }
    };

    const clearSignature = () => {
        sigPad.current.clear();
    };

    const handleSubmit = async () => {
        if (!agreed) {
            toast.warn("Please agree to the terms before signing");
            return;
        }
        if (sigPad.current.isEmpty()) {
            toast.warn("Please provide your signature");
            return;
        }

        try {
            setSubmitting(true);
            const signature = sigPad.current.getCanvas().toDataURL("image/png");
            
            await axios.post(`${NEXUS_API_URL}/consent/submit/${token}`, {
                signature
            });

            toast.success("Consent form submitted successfully!");
            setTokenData(null); // Clear form
            setError("Thank you! Your consent has been recorded. You can close this window.");
        } catch (err) {
            console.error("Submission Error Complete Details: ", err);
            // FastAPI returns `{ detail: "..." }`; older endpoints return `{ error }`.
            // Fall through to whichever one we have so the underlying cause is visible.
            const errorText =
                err.response?.data?.detail ||
                err.response?.data?.error ||
                err.message ||
                "Unknown Error";
            toast.error(`Error: ${errorText} (To: ${NEXUS_API_URL})`, { autoClose: 10000 });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2a276e]"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white text-center">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Notice</h2>
                <p className="text-gray-600 max-w-sm">{error}</p>
            </div>
        );
    }

    const accentColor = branding?.primary_color || '#2a276e';
    const clinicName = branding?.name || 'Clinic';
    const clinicTagline = branding?.tagline || '';

    return (
        <div className="min-h-screen bg-gray-200 flex flex-col items-center py-8 px-4 font-sans antialiased text-slate-900">
            {/* Document Container - A4-like on Desktop, responsive on Mobile */}
            <div className="w-full max-w-[800px] bg-white shadow-[0_0_50px_rgba(0,0,0,0.1)] min-h-[1000px] flex flex-col overflow-hidden rounded-sm border border-gray-300 relative">

                {/* Decorative PDF-style Header Line — uses real clinic accent */}
                <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }}></div>

                <div className="p-8 md:p-16 space-y-12 flex-1">
                    {/* Clinic Header — real branding (Phase 8) */}
                    <div className="flex justify-between items-start border-b-2 border-slate-100 pb-8">
                        <div className="flex items-center gap-4 min-w-0">
                            {branding?.logo_url && (
                                <img
                                    src={branding.logo_url}
                                    alt={clinicName}
                                    className="w-14 h-14 object-contain shrink-0"
                                />
                            )}
                            <div className="min-w-0">
                                <h2
                                    className="text-2xl font-black tracking-tighter uppercase truncate"
                                    style={{ color: accentColor }}
                                >
                                    {clinicName}
                                </h2>
                                {clinicTagline && (
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 truncate">
                                        {clinicTagline}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                            <h1 className="text-xl font-bold text-slate-800">CONSENT FORM</h1>
                            <p className="text-slate-500 text-xs italic">{tokenData.templateName}</p>
                        </div>
                    </div>

                    {/* Document Identification Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 border border-slate-100 p-6 rounded-lg shadow-inner">
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase font-black text-slate-400">Patient Name</span>
                            <p className="font-bold text-slate-800 border-b border-slate-200 pb-1">{tokenData.patientName}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase font-black text-slate-400">Patient ID</span>
                            <p className="font-bold text-slate-800 border-b border-slate-200 pb-1">#{tokenData.patientId}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase font-black text-slate-400">Date Generated</span>
                            <p className="font-bold text-slate-800 border-b border-slate-200 pb-1">{new Date().toLocaleDateString()}</p>
                        </div>
                    </div>

                    {/* Formal Consent Content */}
                    <div className="relative pt-4">
                        <div className="absolute top-0 right-0 opacity-[0.03] pointer-events-none select-none">
                            <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L10 13.17l7.59-7.59L19 7l-9 10z" />
                            </svg>
                        </div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 border-l-4 border-[#2a276e] pl-3">Legal Agreement & Terms</h4>
                        <div className="text-slate-700 leading-8 font-serif text-lg text-justify whitespace-pre-wrap px-2">
                            {tokenData.content}
                        </div>
                    </div>

                    {/* Checkbox and Agreement */}
                    <div className="pt-8 border-t border-slate-100">
                        <label className="flex items-center gap-4 group cursor-pointer bg-blue-50/50 p-4 rounded-xl border border-blue-100 hover:border-blue-300 transition-all">
                            <div className="relative flex items-center">
                                <input
                                    type="checkbox"
                                    className="w-7 h-7 rounded border-2 border-slate-300 text-[#2a276e] focus:ring-[#2a276e] transition-all cursor-pointer accent-[#2a276e]"
                                    checked={agreed}
                                    onChange={(e) => setAgreed(e.target.checked)}
                                />
                            </div>
                            <span className="text-sm font-bold text-slate-700 leading-tight select-none">
                                I confirm that I have read and understood the document above and voluntarily provide my consent.
                            </span>
                        </label>
                    </div>

                    {/* Signature Block */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-end pb-12">
                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b-2 border-slate-800 pb-2">
                                <span className="text-xs font-black uppercase text-slate-400">Patient Signature</span>
                                <button 
                                    onClick={clearSignature}
                                    className="text-[10px] font-black uppercase text-red-500 hover:text-red-700 tracking-tighter"
                                >
                                    Clear Pad
                                </button>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-sm overflow-hidden h-72 sm:h-96 relative group touch-none">
                                {/*
                                  Bigger pad (h-72 mobile / h-96 desktop) for comfortable
                                  finger / stylus signing. Bitmap dims bumped in lockstep so
                                  the captured signature stays high-resolution.
                                */}
                                <SignatureCanvas
                                    ref={sigPad}
                                    penColor='#0f172a'
                                    canvasProps={{
                                        className: "w-full h-full cursor-crosshair",
                                        width: 800,
                                        height: 360,
                                    }}
                                />
                                <div className="absolute inset-0 pointer-events-none border-4 border-transparent group-hover:border-blue-500/10 transition-all"></div>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium italic">Electronically signed via touch/stylus input</p>
                        </div>

                        <div>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className={`w-full py-5 rounded-sm text-white font-black uppercase tracking-[0.2em] text-sm shadow-xl transition-all ${
                                    submitting 
                                        ? 'bg-slate-400' 
                                        : 'bg-slate-900 hover:bg-black hover:translate-y-[-2px] active:translate-y-[0px] shadow-slate-200'
                                }`}
                            >
                                {submitting ? 'Processing...' : 'Submit Document'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer / Watermark */}
                <div className="bg-slate-50 p-6 flex justify-between items-center border-t border-slate-200 mt-auto">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Digital Certificate: {token.substring(0, 8)}...</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-black">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        SECURELY ENCRYPTED
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConsentSign;
