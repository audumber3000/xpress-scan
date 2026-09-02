import { api } from '../../../utils/api';

/**
 * Every PDF a patient has, from the five tables that make them.
 *
 * Consents, prescriptions, reports, invoices and hand uploads each live in
 * their own table with their own shape, so "find the paperwork" used to mean
 * "try three tabs". This normalises all five into one row shape and lets the
 * Documents tab be a single list.
 *
 * Aggregated on the client on purpose. Every source is an endpoint that already
 * exists and they fetch in parallel, so a new backend route would only be a
 * second place for the definition of "a document" to live.
 *
 * One rule holds it together: a source that fails resolves to an empty list
 * rather than rejecting. A patient with no reports and a reports endpoint that
 * is down look the same to this screen, and neither should blank the other four.
 */

export const CATEGORIES = [
  { key: 'all', label: 'All Documents' },
  { key: 'consent', label: 'Consent Forms' },
  { key: 'prescription', label: 'Prescriptions' },
  { key: 'report', label: 'Reports' },
  { key: 'invoice', label: 'Invoices' },
  { key: 'upload', label: 'Uploads' },
];

// Tint per category. Kept here beside the shapes so a badge and its source can
// never drift apart.
export const CATEGORY_STYLE = {
  consent: 'bg-[#2a276e]/[0.08] text-[#2a276e]',
  prescription: 'bg-emerald-50 text-emerald-700',
  report: 'bg-blue-50 text-blue-700',
  invoice: 'bg-amber-50 text-amber-700',
  upload: 'bg-gray-100 text-gray-600',
};

const safe = (promise) => promise.then((r) => (Array.isArray(r) ? r : [])).catch(() => []);

/** The one row shape the tab renders, whatever table it came from. */
const row = ({ id, category, title, date, url, route, download, size, fileType, addedBy, source }) => ({
  key: `${category}-${id}`,
  id,
  category,
  title,
  date: date || null,
  // A file has a URL. A consent does not: it is rendered in the app from its
  // stored content, so it carries an in-app route instead and the row opens
  // with the router rather than a new tab.
  url: url || '',
  route: route || '',
  // An invoice PDF is generated on demand behind auth, so it is neither a
  // public URL nor an in-app route — it is a path the client has to fetch with
  // its token and hand to the browser as a download.
  download: download || '',
  size: size ?? null,
  fileType: (fileType || 'pdf').toLowerCase(),
  addedBy: addedBy || null,
  source,
});

export async function fetchPatientDocuments(patientId, { prescriptions = [], invoices = [] } = {}) {
  const [uploads, consents, reports] = await Promise.all([
    safe(api.get(`/documents/patient/${patientId}`)),
    safe(api.get(`/consents/patient/${patientId}`)),
    // `?patient_id=` — the endpoint is clinic-wide, and without the filter
    // this pulled every report in the clinic and had nothing but the patient's
    // name to match them by.
    safe(api.get('/reports', { params: { patient_id: patientId } })),
  ]);

  const docs = [
    ...uploads.map((d) => row({
      id: d.id,
      // An upload can say what it is now that the column exists. Everything
      // stored before it lands under Uploads rather than guessing.
      category: d.category && d.category !== 'other' ? d.category : 'upload',
      title: d.file_name,
      date: d.created_at,
      url: d.file_path,
      size: d.file_size,
      fileType: d.file_type,
      addedBy: d.uploader_name,
      source: 'document',
    })),

    ...consents.map((c) => row({
      id: c.id,
      category: 'consent',
      title: c.template_name || 'Consent form',
      date: c.signed_at || c.created_at,
      // No stored PDF: a signed consent is rendered from `signed_content`, so
      // the row opens the preview route rather than a file.
      route: `/consent/preview/${c.template_id}`,
      fileType: 'form',
      source: 'consent',
    })),

    ...reports.map((r) => row({
      id: r.id,
      category: 'report',
      // `scan_type` is the wire name the reports endpoint answers with; the
      // value behind it is the patient's treatment type.
      title: r.scan_type ? `${r.scan_type} report` : 'Report',
      date: r.created_at,
      url: r.pdf_url || r.docx_url,
      fileType: r.pdf_url ? 'pdf' : 'docx',
      source: 'report',
    })),

    // These two are already loaded by the patient page, so they arrive as
    // arguments rather than as two more requests.
    ...prescriptions.map((p) => row({
      id: p.id,
      category: 'prescription',
      title: 'Prescription',
      date: p.created_at || p.date,
      url: p.pdf_url,
      fileType: 'pdf',
      source: 'prescription',
    })),

    ...invoices
      // A draft has been issued to nobody, so it is not yet paperwork.
      .filter((i) => !['draft', 'cancelled'].includes(String(i.status || '').toLowerCase()))
      .map((i) => row({
        id: i.id,
        category: 'invoice',
        title: i.invoice_number || `Invoice #${i.id}`,
        date: i.finalized_at || i.created_at,
        // Invoices carry no pdf_url column; the PDF is rendered on request.
        download: `/invoices/${i.id}/pdf`,
        fileType: 'pdf',
        source: 'invoice',
      })),
  ];

  return docs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

/** Counts for the category chips, including the zeroes. */
export const countByCategory = (docs) =>
  CATEGORIES.reduce((acc, c) => {
    acc[c.key] = c.key === 'all' ? docs.length : docs.filter((d) => d.category === c.key).length;
    return acc;
  }, {});
