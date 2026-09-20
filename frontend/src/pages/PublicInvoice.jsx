import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Phone, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';

/**
 * What the QR code on a printed bill opens.
 *
 * The person on this page is a patient, on a phone, who scanned a code off a
 * piece of paper. They have no account and should need none. So: say whose bill
 * this is and what is owed, give one obvious way to open the bill itself, and
 * give them the clinic's number. Nothing else.
 *
 * Bypasses utils/api on purpose, the way ConsentSign does. That client attaches
 * a login and sends a 401 to the sign-in screen, which is the wrong door for
 * someone who was never going to log in.
 *
 * The token "preview" is reserved for the template editor's live preview, so a
 * clinic owner who scans the preview to test it is told it is a sample rather
 * than being shown an error.
 */
const API = `${import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:8000`}/api/v1/public/invoices`;

// A calendar date, built from its parts. `new Date('2026-09-17')` is read as
// UTC midnight and lands on the 16th anywhere west of Greenwich.
const formatDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

const money = (symbol, n) =>
  `${symbol}${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const Shell = ({ children }) => (
  <div className="min-h-screen bg-gray-50 flex items-start sm:items-center justify-center px-4 py-10">
    <div className="w-full max-w-sm">{children}</div>
  </div>
);

const Row = ({ label, value, strong }) => (
  <div className="flex items-baseline justify-between py-2.5">
    <span className={`text-sm ${strong ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{label}</span>
    <span className={`tabular-nums ${strong ? 'text-lg font-bold text-gray-900' : 'text-sm font-medium text-gray-700'}`}>
      {value}
    </span>
  </div>
);

const PublicInvoice = () => {
  const { token } = useParams();
  const isPreview = token === 'preview';
  const [state, setState] = useState(isPreview ? 'preview' : 'loading');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (isPreview) return undefined;
    let cancelled = false;
    fetch(`${API}/${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => { if (!cancelled) { setData(d); setState('ready'); } })
      .catch(() => { if (!cancelled) setState('missing'); });
    return () => { cancelled = true; };
  }, [token, isPreview]);

  if (state === 'loading') {
    return (
      <Shell>
        <div className="animate-pulse space-y-3" aria-label="Loading your invoice">
          <div className="h-3 w-28 bg-gray-200 rounded" />
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-36 w-full bg-white border border-gray-200 rounded-xl mt-5" />
          <div className="h-12 w-full bg-gray-200 rounded-xl" />
        </div>
      </Shell>
    );
  }

  if (state === 'preview') {
    return (
      <Shell>
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <span className="w-11 h-11 rounded-full bg-[#2a276e]/10 text-[#2a276e] grid place-items-center mx-auto">
            <FileText size={20} />
          </span>
          <h1 className="text-base font-bold text-gray-900 mt-4">This is a sample</h1>
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            You scanned the QR code from your template preview. On a real invoice,
            this code opens that patient's bill.
          </p>
        </div>
      </Shell>
    );
  }

  if (state === 'missing') {
    return (
      <Shell>
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <span className="w-11 h-11 rounded-full bg-amber-50 text-amber-600 grid place-items-center mx-auto">
            <AlertCircle size={20} />
          </span>
          <h1 className="text-base font-bold text-gray-900 mt-4">We couldn't open this invoice</h1>
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            The link may be incomplete, or the clinic may have stopped sharing invoices online.
            Your clinic can give you a copy.
          </p>
        </div>
      </Shell>
    );
  }

  const sym = data.currency_symbol || '₹';
  const paidSoFar = Math.max(0, (data.total || 0) - (data.due || 0));

  return (
    <Shell>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{data.clinic_name}</p>
      <h1 className="text-xl font-bold text-gray-900 tracking-tight mt-1">
        Invoice {data.invoice_number}
      </h1>
      <p className="text-sm text-gray-500 mt-0.5">
        {data.patient_first_name ? `For ${data.patient_first_name}` : 'Your bill'}
        {data.date ? ` · ${formatDate(data.date)}` : ''}
      </p>

      <div className="bg-white border border-gray-200 rounded-xl px-4 mt-5 divide-y divide-gray-100">
        <Row label="Total" value={money(sym, data.total)} />
        {paidSoFar > 0 && !data.paid && <Row label="Paid so far" value={money(sym, paidSoFar)} />}
        {data.paid ? (
          <div className="flex items-center gap-2 py-3 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={17} /> Paid in full. Thank you.
          </div>
        ) : (
          <Row label="Balance due" value={money(sym, data.due)} strong />
        )}
      </div>

      {/* A plain link rather than a fetched blob: the phone's own PDF viewer
          is better at this than anything we could draw, and it brings share
          and save with it. */}
      <a
        href={`${API}/${encodeURIComponent(token)}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 w-full flex items-center justify-center gap-2 bg-[#2a276e] text-white rounded-xl py-3.5 text-sm font-semibold hover:bg-[#231f5e] transition-colors"
      >
        Open the full invoice
        <ArrowUpRight size={16} />
      </a>
      <p className="text-xs text-gray-400 text-center mt-2">Opens as a PDF you can save or share.</p>

      {data.clinic_phone && (
        <a
          href={`tel:${data.clinic_phone}`}
          className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-[#2a276e] transition-colors"
        >
          <Phone size={14} />
          Questions? Call {data.clinic_name}
        </a>
      )}
    </Shell>
  );
};

export default PublicInvoice;
