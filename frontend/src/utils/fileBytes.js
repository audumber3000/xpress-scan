/**
 * Getting the bytes of a stored file, for the code that has to read them.
 *
 * Deliberately free of any renderer import. This module is used by the viewer
 * shell, which is eagerly loaded; when these two functions lived beside the
 * pdf.js worker setup, importing them dragged the whole pdf.js bundle into the
 * shell's chunk and the lazy split around the PDF renderer bought nothing
 * (407 KB of it, measured).
 *
 * The rule this exists to serve: an R2 presigned URL carries no CORS headers,
 * so the browser will display it in an <img> and refuse to `fetch` it. Anything
 * that parses bytes — pdf.js, Cornerstone, a download that must keep its
 * filename — goes through our own origin instead.
 */
const API_BASE = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/v1`;

/**
 * The path that streams a file's bytes through our API, or '' when the source
 * has no such route.
 *
 * `invoice` is the exception that proves the rule: its PDF is rendered on
 * demand from our own origin, so it is already fetchable and needs no proxy.
 * Every other source stores its file in R2 and needs one.
 */
export const rawPathFor = (file) => {
  switch (file?.source) {
    case 'document':
    case 'upload':       return `/documents/${file.id}/raw`;
    // Its own table with its own id sequence, so it cannot share the documents
    // route — that mismatch is what made the old DICOM viewer stream the wrong
    // file. See backend/domains/medical/routes/xray.py.
    case 'xray':         return `/xray/${file.id}/raw`;
    case 'prescription': return `/clinical/prescriptions/${file.id}/raw`;
    case 'report':       return `/reports/${file.id}/raw`;
    case 'invoice':      return `/invoices/${file.id}/pdf`;
    default:             return '';
  }
};

/**
 * Fetch a file as a blob URL, using our token.
 *
 * Returns { url, revoke }. The caller must call revoke(): a blob URL is held by
 * the document until released, so a viewer that mints one per file would keep
 * every file it had shown in memory for the life of the tab.
 */
export const fetchBlobUrl = async (path, signal) => {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE}${path}`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = new Error(`Could not load this file (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
};
