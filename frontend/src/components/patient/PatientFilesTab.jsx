import React, { useState, useEffect, lazy, Suspense } from 'react';
import { api, getFriendlyErrorMessage } from '../../utils/api';
import { toast } from 'react-toastify';

// Lazy so the heavy DICOM decode libraries only load when a .dcm is opened.
const DicomViewerModal = lazy(() => import('./DicomViewerModal'));

// Client-side guards so we fail fast instead of waiting on the server.
const MAX_FILE_MB = 25;
const ACCEPT = 'image/*,application/pdf,.pdf,.dcm,application/dicom';

const fileUrl = (file) => file.file_path || file.image_url || '';

// Only http(s) URLs (presigned R2) can be opened in the browser. X-rays store a
// server-local path, so there's nothing useful to open for them here.
const canOpen = (file) => /^https?:\/\//i.test(fileUrl(file));

const formatDateTime = (file) => {
  const raw = file.created_at || file.capture_date;
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

// Two-letter monogram for the uploader avatar (e.g. "Asha Rao" -> "AR").
const initials = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

// Route deletes by the backend's `category` field instead of guessing from the
// path. Documents are deletable; x-rays have no category; reports aren't
// user-managed files and have no delete endpoint.
const deleteEndpoint = (file) => {
  if (file.category === 'report') return null;
  if (file.category === 'document') return `/documents/${file.id}`;
  return `/xray/${file.id}`;
};

const isImage = (file) => {
  const t = (file.file_type || file.image_type || '').toLowerCase();
  if (t.includes('image') || t.includes('photo')) return true;
  if (/^(png|jpe?g|webp|gif|bmp)$/.test(t)) return true; // file_type is a bare extension
  // Allow a query string / hash after the extension (presigned URLs append ?X-Amz-…).
  return /\.(png|jpe?g|webp|gif|bmp)(\?|#|$)/i.test(fileUrl(file));
};

const isPdf = (file) => {
  const t = (file.file_type || file.image_type || '').toLowerCase();
  return t.includes('pdf') || /\.pdf(\?|#|$)/i.test(fileUrl(file));
};

const isDicom = (file) => {
  const t = (file.file_type || file.image_type || '').toLowerCase();
  return t === 'dcm' || t.includes('dicom') || /\.(dcm|dicom)(\?|#|$)/i.test(fileUrl(file));
};

const humanSize = (bytes) => {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// fetch() can't report upload progress, so post the file with XHR to drive a
// real percentage bar. Mirrors api.post's URL + auth handling.
const API_BASE = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/v1`;
const uploadDocumentWithProgress = (patientId, file, onProgress) =>
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

// Type badge: distinct label + color per file kind.
const fileKind = (file) => {
  const u = fileUrl(file).toLowerCase();
  const t = (file.file_type || file.image_type || '').toLowerCase();
  if (/\.(dcm|dicom)(\?|#|$)/.test(u) || t === 'dcm' || t.includes('dicom') || t.includes('xray') || t.includes('x-ray')) return { label: 'X-ray', cls: 'bg-indigo-50 text-indigo-600' };
  if (/\.pdf(\?|#|$)/.test(u) || t.includes('pdf')) return { label: 'PDF', cls: 'bg-red-50 text-red-600' };
  if (isImage(file)) return { label: 'Image', cls: 'bg-emerald-50 text-emerald-600' };
  return { label: (file.file_type || file.image_type || 'File').toUpperCase(), cls: 'bg-gray-100 text-gray-500' };
};

const FileIcon = () => (
    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

// <img> with a graceful fallback to the file icon if the source 404s/errors
// (e.g. a thumbnail that couldn't be generated for a compressed DICOM).
const ThumbnailImg = ({ src, alt }) => {
    const [failed, setFailed] = useState(false);
    if (failed) return <FileIcon />;
    return (
        <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setFailed(true)}
            className="w-full h-full object-cover object-top"
        />
    );
};

// Decides what to show in a card's preview area: real image, server-generated
// thumbnail (DICOM/PDF documents), or a fallback icon.
const FilePreview = ({ file }) => {
    const src = fileUrl(file);
    if (isImage(file) && src) return <ThumbnailImg src={src} alt={file.file_name} />;
    // DICOM/PDF previews are rendered server-side and cached — cheap and avoids
    // downloading large (e.g. ~15 MB) files just to show a thumbnail.
    if ((isDicom(file) || isPdf(file)) && file.category === 'document') {
        return <ThumbnailImg src={`${API_BASE}/documents/${file.id}/thumbnail`} alt={file.file_name} />;
    }
    // Reports are PDFs in a different table (no thumbnail endpoint) — show page 1 inline.
    if (isPdf(file) && /^https?:\/\//i.test(src)) {
        return (
            <div className="absolute inset-0 bg-white pointer-events-none">
                <iframe src={`${src}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} title={file.file_name} loading="lazy" className="w-full h-full border-0" tabIndex={-1} />
            </div>
        );
    }
    return <FileIcon />;
};

// Skeleton placeholder shown while files load — mirrors the real grid so the
// layout appears instantly instead of a blank spinner (same pattern as the
// dental-labs dashboard).
const FilesSkeleton = () => (
    <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
                <div className="h-6 w-44 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-60 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="h-10 w-40 bg-gray-100 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="aspect-video bg-gray-100 animate-pulse" />
                    <div className="p-3.5 space-y-3">
                        <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gray-100 animate-pulse" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                                <div className="h-2.5 w-20 bg-gray-100 rounded animate-pulse" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const PatientFilesTab = ({ patientId }) => {
    const [files, setFiles] = useState([]);
    const [consents, setConsents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(null); // { done, total, pct } during a batch
    const [dragOver, setDragOver] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [dicomView, setDicomView] = useState(null);

    const fetchFiles = async () => {
        try {
            setLoading(true);
            const [xrays, docs, signedConsents] = await Promise.all([
                api.get(`/xray/patient/${patientId}`),
                api.get(`/documents/patient/${patientId}`),
                api.get(`/consents/patient/${patientId}`).catch(() => [])
            ]);
            setFiles([...(xrays || []), ...(docs || [])]);
            setConsents(signedConsents || []);
        } catch (error) {
            console.error('Error fetching patient files:', error);
            toast.error('Failed to load patient files.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (patientId) fetchFiles();
    }, [patientId]);

    const uploadFiles = async (fileList) => {
        if (uploading) return;
        const all = Array.from(fileList || []).filter(Boolean);
        if (!all.length) return;

        // Reject oversized files up front rather than round-tripping them.
        const limit = MAX_FILE_MB * 1024 * 1024;
        const oversized = all.filter((f) => f.size > limit);
        const valid = all.filter((f) => f.size <= limit);
        if (oversized.length) {
            toast.error(
                oversized.length === 1
                    ? `"${oversized[0].name}" is larger than ${MAX_FILE_MB} MB and was skipped.`
                    : `${oversized.length} files exceed ${MAX_FILE_MB} MB and were skipped.`
            );
        }
        if (!valid.length) return;

        setUploading(true);
        setProgress({ done: 0, total: valid.length, pct: 0, phase: 'uploading' });
        let succeeded = 0;
        const failed = [];
        let lastError = null;
        for (let i = 0; i < valid.length; i++) {
            const file = valid[i];
            setProgress((p) => (p ? { ...p, phase: 'uploading' } : p));
            try {
                await uploadDocumentWithProgress(patientId, file, (fraction) => {
                    // Overall % = files already done + current file's byte fraction, over the batch.
                    const pct = Math.round(((i + Math.min(fraction, 1)) / valid.length) * 100);
                    // Once all bytes are sent, the server is still storing the file (e.g.
                    // pushing to R2) with no progress signal — switch to an honest
                    // "Processing" state instead of parking the bar at 100%.
                    const phase = fraction >= 1 ? 'processing' : 'uploading';
                    setProgress((p) => (p ? { ...p, pct, phase } : p));
                });
                succeeded += 1;
            } catch (error) {
                console.error('Error uploading file:', error);
                failed.push(file.name);
                lastError = error;
            } finally {
                setProgress((p) => (p ? { ...p, done: p.done + 1, pct: Math.round(((i + 1) / valid.length) * 100) } : p));
            }
        }
        setUploading(false);
        setProgress(null);

        if (succeeded) toast.success(`${succeeded} file${succeeded > 1 ? 's' : ''} uploaded.`);
        if (failed.length) {
            // For a single failure, surface the real reason from the server.
            toast.error(
                valid.length === 1
                    ? getFriendlyErrorMessage(lastError, 'Failed to upload file.')
                    : `Failed to upload ${failed.length} of ${valid.length} files.`
            );
        }
        fetchFiles();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        if (!uploading) uploadFiles(e.dataTransfer.files);
    };

    const doDelete = async (file) => {
        const endpoint = deleteEndpoint(file);
        if (!endpoint) {
            setPendingDelete(null);
            return;
        }
        try {
            await api.delete(endpoint);
            toast.success('File deleted.');
            fetchFiles();
        } catch (error) {
            console.error('Error deleting file:', error);
            toast.error(getFriendlyErrorMessage(error, 'Failed to delete file.'));
        } finally {
            setPendingDelete(null);
        }
    };

    const openFile = (file) => {
        const url = fileUrl(file);
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
    };

    // DICOM can't render in a browser tab (it would just download), so open it in
    // the in-app viewer instead; everything else opens in a new tab.
    const viewFile = (file) => {
        if (isDicom(file)) setDicomView(file);
        else openFile(file);
    };

    if (loading) return <FilesSkeleton />;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg md:text-xl font-bold text-gray-900">Patient Data & Files</h3>
                    <p className="text-sm text-gray-500">DICOM, PDF, images and clinical attachments</p>
                </div>
                <label className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors cursor-pointer shadow-sm flex-shrink-0 ${uploading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2a276e] text-white hover:bg-[#1a1548]'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                    {uploading ? (progress ? `Uploading ${progress.done}/${progress.total}...` : 'Uploading...') : 'Upload Document'}
                    <input type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { uploadFiles(e.target.files); e.target.value = ''; }} disabled={uploading} />
                </label>
            </div>

            {progress && (
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-4 py-3">
                    <div className="flex items-center justify-between mb-2 text-xs font-semibold">
                        <span className="text-gray-700">
                            {progress.phase === 'processing' ? 'Processing' : 'Uploading'}
                            {progress.total > 1 ? ` ${Math.min(progress.done + 1, progress.total)} of ${progress.total}` : ' file'}…
                        </span>
                        {progress.phase !== 'processing' && <span className="text-[#2a276e]">{progress.pct}%</span>}
                    </div>
                    <div className="relative h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        {progress.phase === 'processing' ? (
                            // Bytes are sent; server is still storing the file — show an
                            // indeterminate animation rather than a misleading static 100%.
                            <div className="absolute inset-y-0 w-2/5 bg-[#2a276e] rounded-full animate-[indeterminate_1.1s_ease-in-out_infinite]" />
                        ) : (
                            <div
                                className="h-full bg-[#2a276e] rounded-full transition-[width] duration-200 ease-out"
                                style={{ width: `${progress.pct}%` }}
                            />
                        )}
                    </div>
                </div>
            )}

            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`rounded-2xl transition-colors ${dragOver ? 'ring-2 ring-[#2a276e]/40 bg-[#2a276e]/5' : ''}`}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {files.length > 0 ? (
                        files.map((file) => {
                            const kind = fileKind(file);
                            return (
                                <div key={file.id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-xl transition-all">
                                    <div className="aspect-video bg-gray-100 flex items-center justify-center relative overflow-hidden">
                                        <FilePreview file={file} />
                                        {/* Click anywhere on the preview to open the file (Loom-style).
                                            Sits above the media but below the badges/actions. */}
                                        {canOpen(file) && (
                                            <button
                                                type="button"
                                                onClick={() => viewFile(file)}
                                                className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 hover:bg-black/20 focus:bg-black/20 focus:outline-none transition-colors cursor-pointer"
                                                aria-label={`View ${file.file_name}`}
                                                title="View"
                                            >
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity w-11 h-11 rounded-full bg-white/90 text-[#2a276e] flex items-center justify-center shadow-lg">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                </span>
                                            </button>
                                        )}
                                        <span className={`absolute top-2 left-2 z-20 pointer-events-none text-[10px] font-bold px-2 py-0.5 rounded-full ${kind.cls}`}>{kind.label}</span>
                                        {humanSize(file.file_size) && (
                                            <span className="absolute bottom-2 right-2 z-20 pointer-events-none text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/70 text-white">{humanSize(file.file_size)}</span>
                                        )}
                                        {/* Delete stays a discrete corner action so a stray tap can't trigger it. */}
                                        <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5">
                                            {deleteEndpoint(file) && (
                                                <button
                                                    onClick={() => setPendingDelete(file)}
                                                    className="p-2 bg-white/90 backdrop-blur-sm rounded-full text-red-600 shadow-sm hover:bg-white hover:scale-110 transition-all"
                                                    aria-label={`Delete ${file.file_name}`}
                                                    title="Delete"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-3.5">
                                        <h4
                                            className={`font-semibold text-sm text-gray-900 truncate leading-snug ${canOpen(file) ? 'cursor-pointer hover:text-[#2a276e]' : ''}`}
                                            title={file.file_name}
                                            onClick={canOpen(file) ? () => viewFile(file) : undefined}
                                        >
                                            {file.file_name}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-2.5">
                                            <div className="w-6 h-6 rounded-full bg-[#2a276e]/10 text-[#2a276e] flex items-center justify-center text-[10px] font-bold shrink-0">
                                                {initials(file.uploader_name)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-semibold text-gray-700 truncate">{file.uploader_name || 'System'}</p>
                                                <p className="text-[11px] text-gray-400 truncate">{formatDateTime(file)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <label className="col-span-full py-16 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200 hover:border-[#2a276e]/40 hover:bg-[#2a276e]/5 transition-colors cursor-pointer block">
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <h4 className="text-gray-900 font-bold">No clinical images yet</h4>
                            <p className="text-gray-500 text-sm mt-1">Drag &amp; drop or <span className="text-[#2a276e] font-semibold">click to upload</span> X-rays, scans or documents.</p>
                            <p className="text-gray-400 text-xs mt-1">Images &amp; PDFs, up to {MAX_FILE_MB} MB each.</p>
                            <input type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { uploadFiles(e.target.files); e.target.value = ''; }} disabled={uploading} />
                        </label>
                    )}
                </div>
            </div>

            {/* Signed Consent Forms */}
            <div className="mt-8">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-lg bg-[#2a276e]/5 text-[#2a276e] flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Signed Consent Forms</h3>
                        <p className="text-xs text-gray-500">Digitally signed consent documents</p>
                    </div>
                    {consents.length > 0 && (
                        <span className="ml-auto text-xs font-bold text-[#2a276e] bg-[#2a276e]/5 px-2.5 py-1 rounded-full">
                            {consents.length} {consents.length === 1 ? 'form' : 'forms'}
                        </span>
                    )}
                </div>

                {consents.length === 0 ? (
                    <div className="py-10 text-center bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
                        <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-sm font-semibold text-gray-500">No signed consent forms yet</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {consents.map((consent) => (
                            <div key={consent.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-[#2a276e]/30 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{consent.template_name}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Signed on {new Date(consent.signed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">Signed</span>
                                    {consent.signature_url && (
                                        <button
                                            onClick={() => window.open(consent.signature_url, '_blank')}
                                            className="p-2 text-gray-400 hover:text-[#2a276e] hover:bg-[#2a276e]/5 rounded-lg transition-colors"
                                            aria-label="View consent PDF"
                                            title="View PDF"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Styled delete confirmation */}
            {pendingDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setPendingDelete(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </div>
                        <h3 className="text-base font-bold text-gray-900 text-center">Delete this file?</h3>
                        <p className="text-sm text-gray-500 text-center mt-1 truncate">{pendingDelete.file_name}</p>
                        <p className="text-xs text-gray-400 text-center mt-1">This can't be undone.</p>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setPendingDelete(null)} className="flex-1 px-4 py-2.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors">Cancel</button>
                            <button onClick={() => doDelete(pendingDelete)} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {dicomView && (
                <Suspense fallback={<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 text-white text-sm">Loading viewer…</div>}>
                    <DicomViewerModal
                        fileId={dicomView.id}
                        downloadUrl={fileUrl(dicomView)}
                        fileName={dicomView.file_name}
                        onClose={() => setDicomView(null)}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default PatientFilesTab;
