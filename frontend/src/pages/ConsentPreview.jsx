import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { api } from '../utils/api';

/**
 * ConsentPreview — a printable blank consent form.
 *
 * Renders the HTML produced by the backend's consent engine (the SAME
 * consent_templates.classic renderer used for signed consents and Template
 * Settings), so the letterhead and layout match exactly. The HTML is shown in
 * an iframe to keep its own print styles isolated. ?print=1 auto-opens the
 * print dialog ("Save as PDF" or print).
 */
const ConsentPreview = () => {
  const { templateId } = useParams();
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const iframeRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/consents/templates/${templateId}/preview`);
        if (!res?.html) { setError('Could not render this template'); return; }
        setHtml(res.html);
      } catch {
        setError('Failed to load template preview');
      } finally {
        setLoading(false);
      }
    })();
  }, [templateId]);

  const printDoc = () => iframeRef.current?.contentWindow?.print();

  // Auto-print when opened with ?print=1 (the Download button).
  const onIframeLoad = () => {
    if (new URLSearchParams(window.location.search).get('print') === '1') {
      setTimeout(printDoc, 300);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading preview…</div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <button onClick={() => window.close()} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900">
          <ArrowLeft size={16} /> Close
        </button>
        <span className="text-sm font-semibold text-gray-500">Consent form preview</span>
        <button
          onClick={printDoc}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm"
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      {/* The real template, isolated in an iframe so its @page / print CSS wins. */}
      <iframe
        ref={iframeRef}
        title="Consent preview"
        srcDoc={html}
        onLoad={onIframeLoad}
        className="flex-1 w-full border-0 bg-gray-100"
      />
    </div>
  );
};

export default ConsentPreview;
