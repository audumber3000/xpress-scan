/**
 * Everything the Imaging and Documents tabs both need to know about a file.
 *
 * Lifted out of PatientFilesTab when that one component split in two. These are
 * the rules about what a file *is* — can it be opened, is it an image, how big
 * is it — and both tabs have to answer them identically, or the same PDF reads
 * as a document on one screen and an unknown blob on the other.
 */

// Held just under the 50M `client_max_body_size` on the prod nginx in front of
// the API. Going higher needs that raised first, otherwise the browser uploads
// the whole file and nginx answers 413 — worse than refusing it up front.
// 2D radiographs (RVG, OPG) run 2-20 MB, so this is ample; CBCT is out of scope.
export const MAX_FILE_MB = 48;
export const ACCEPT = 'image/*,application/pdf,.pdf,.dcm,application/dicom';

export const fileUrl = (file) => file.file_path || file.image_url || '';

// Only http(s) URLs (presigned R2) can be opened in the browser. An x-ray that
// stored a server-local path has nothing useful to open here.
export const canOpen = (file) => /^https?:\/\//i.test(fileUrl(file));

// Two-letter monogram for an uploader avatar ("Asha Rao" -> "AR").
export const initials = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

export const isImage = (file) => {
  const t = (file.file_type || file.image_type || '').toLowerCase();
  if (t.includes('image') || t.includes('photo')) return true;
  if (/^(png|jpe?g|webp|gif|bmp)$/.test(t)) return true; // file_type is a bare extension
  // Allow a query string / hash after the extension (presigned URLs append ?X-Amz-…).
  return /\.(png|jpe?g|webp|gif|bmp)(\?|#|$)/i.test(fileUrl(file));
};

export const isPdf = (file) => {
  const t = (file.file_type || file.image_type || '').toLowerCase();
  return t.includes('pdf') || /\.pdf(\?|#|$)/i.test(fileUrl(file));
};

export const isDicom = (file) => {
  const t = (file.file_type || file.image_type || '').toLowerCase();
  return t === 'dcm' || t.includes('dicom') || /\.(dcm|dicom)(\?|#|$)/i.test(fileUrl(file));
};

export const humanSize = (bytes) => {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Type badge: distinct label and colour per file kind.
export const fileKind = (file) => {
  const u = fileUrl(file).toLowerCase();
  const t = (file.file_type || file.image_type || '').toLowerCase();
  if (/\.(dcm|dicom)(\?|#|$)/.test(u) || t === 'dcm' || t.includes('dicom') || t.includes('xray') || t.includes('x-ray')) {
    return { label: 'X-ray', cls: 'bg-indigo-50 text-indigo-600' };
  }
  if (/\.pdf(\?|#|$)/.test(u) || t.includes('pdf')) return { label: 'PDF', cls: 'bg-red-50 text-red-600' };
  if (isImage(file)) return { label: 'Image', cls: 'bg-emerald-50 text-emerald-600' };
  return { label: (file.file_type || file.image_type || 'File').toUpperCase(), cls: 'bg-gray-100 text-gray-500' };
};

// fetch() cannot report upload progress, so the file goes up with XHR to drive
// a real percentage bar. Mirrors api.post's URL and auth handling.
const API_BASE = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/v1`;

export const uploadDocumentWithProgress = (patientId, file, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/documents/upload/${patientId}`);
    const token = localStorage.getItem('auth_token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        let detail;
        try { detail = JSON.parse(xhr.responseText)?.detail; } catch { /* non-JSON body */ }
        const err = new Error(detail || `HTTP ${xhr.status}`);
        err.status = xhr.status;
        err.detail = detail;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
