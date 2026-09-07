import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  X, Download, ExternalLink, ChevronLeft, ChevronRight, Loader2, FileQuestion,
} from 'lucide-react';
import { kindOf, KIND_LABEL } from './kind';
import { rawPathFor, fetchBlobUrl } from '../../../utils/fileBytes';
import { notify } from '../../../utils/notify';

// Each renderer pulls in a decoder measured in hundreds of kilobytes — pdf.js,
// Cornerstone — and most sessions open none of them. Split so the cost is paid
// by the click that needs it rather than by every page load.
const ImageView = lazy(() => import('./ImageView'));
const PdfView   = lazy(() => import('./PdfView'));
const DicomView = lazy(() => import('./DicomView'));

/**
 * One full-screen viewer for every file the app holds.
 *
 * Before this, opening anything meant `window.open` into a new tab: the patient
 * you were reading disappeared, the browser's own PDF viewer had none of the
 * app's context, and on a phone the tab often became a download prompt instead.
 * DICOM had its own separate overlay with its own controls, so the same click
 * behaved differently depending on what had been uploaded.
 *
 * The shell owns everything that is the same whatever the file is — the chrome,
 * the keyboard, moving between files, download — and each kind gets a view that
 * owns only its own controls. Adding a format is a new view and a line in
 * kind.js, not another overlay.
 *
 * Props:
 *   files    the viewable list, in the order shown on screen
 *   index    which one is open
 *   onIndex  called with the new index when the user moves
 *   onClose
 */
const FileViewerModal = ({ files, index, onIndex, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const file = files?.[index];

  const go = useCallback((delta) => {
    if (!files?.length) return;
    const next = index + delta;
    if (next < 0 || next >= files.length) return;
    onIndex(next);
  }, [files, index, onIndex]);

  // Escape closes, arrows move. Bound on the window rather than the overlay so
  // it works without the user having clicked into the viewer first.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // The page behind must not scroll under the overlay, which on a phone is the
  // difference between pinching an x-ray and scrolling the patient's file.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!file) return null;
  const kind = kindOf(file);

  /**
   * Download through our own origin where the file has a route there.
   *
   * A plain `<a download>` pointed at a presigned R2 URL is cross-origin, so
   * the browser ignores the download attribute and navigates instead — the file
   * opens in the tab and the viewer is gone. Fetching to a blob keeps the name
   * and keeps the user where they were.
   */
  const download = async () => {
    setDownloading(true);
    try {
      const path = rawPathFor(file);
      if (path) {
        const { url, revoke } = await fetchBlobUrl(path);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name || 'file';
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Give the browser a tick to start the download before the URL dies.
        setTimeout(revoke, 10_000);
      } else if (file.url) {
        window.open(file.url, '_blank', 'noopener');
      }
    } catch {
      notify.problem('That file could not be downloaded.');
    } finally { setDownloading(false); }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={file.name || 'File viewer'}
    >
      {/* ── Chrome ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 text-white shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{file.name || 'File'}</p>
          <p className="text-[11px] text-white/50 truncate">
            {KIND_LABEL[kind]}
            {file.subtitle ? ` · ${file.subtitle}` : ''}
            {files.length > 1 ? ` · ${index + 1} of ${files.length}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={download} disabled={downloading}
            title="Download" aria-label="Download"
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12px] font-semibold transition-colors disabled:opacity-50">
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span className="hidden sm:inline">Download</span>
          </button>

          {file.url && (
            <a href={file.url} target="_blank" rel="noreferrer"
              title="Open in a new tab" aria-label="Open in a new tab"
              className="w-9 h-9 grid place-items-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <ExternalLink size={15} />
            </a>
          )}

          <button type="button" onClick={onClose} aria-label="Close viewer"
            className="w-9 h-9 grid place-items-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
            <X size={17} />
          </button>
        </div>
      </div>

      {/* ── The file ───────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        {kind === 'other' ? (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div>
              <FileQuestion size={30} className="mx-auto text-white/40" />
              <p className="mt-3 text-sm text-white/80">
                No browser can display a {(file.fileType || 'file').toUpperCase()} on its own.
              </p>
              <p className="mt-1 text-[13px] text-white/50 max-w-sm mx-auto">
                Download it and it will open in whatever handles this format on your machine.
              </p>
              <button type="button" onClick={download} disabled={downloading}
                className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white text-gray-900 text-[13px] font-semibold hover:bg-gray-100 disabled:opacity-50">
                {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Download it
              </button>
            </div>
          </div>
        ) : (
          <Suspense fallback={
            <div className="absolute inset-0 grid place-items-center">
              <Loader2 size={22} className="animate-spin text-white/60" />
            </div>
          }>
            {/* Keyed on the file so switching between two PDFs remounts the
                renderer rather than showing the previous one's pages while the
                next loads. */}
            {kind === 'image' && <ImageView key={file.key} file={file} />}
            {kind === 'pdf'   && <PdfView   key={file.key} file={file} />}
            {kind === 'dicom' && <DicomView key={file.key} file={file} />}
          </Suspense>
        )}

        {/* Arrows sit over the file, vertically centred, and only when there is
            somewhere to go. Hidden on the narrowest screens, where they would
            cover the file and the swipe/keyboard already work. */}
        {files.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} disabled={index === 0}
              aria-label="Previous file"
              className="hidden sm:grid absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors disabled:opacity-0 disabled:pointer-events-none">
              <ChevronLeft size={20} />
            </button>
            <button type="button" onClick={() => go(1)} disabled={index === files.length - 1}
              aria-label="Next file"
              className="hidden sm:grid absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors disabled:opacity-0 disabled:pointer-events-none">
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default FileViewerModal;
