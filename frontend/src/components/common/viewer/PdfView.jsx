import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import { Loader2, FileWarning, ZoomIn, ZoomOut, ChevronUp, ChevronDown } from 'lucide-react';
import { rawPathFor, fetchBlobUrl } from '../../../utils/fileBytes';
import '../../../utils/pdfLoader';   // configures the pdf.js worker
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

/**
 * A PDF, rendered in the app rather than handed to a new browser tab.
 *
 * react-pdf wraps Mozilla's pdf.js, which is the same engine Firefox ships and
 * Chrome's viewer is modelled on. Worth the dependency rather than an <iframe>:
 * an iframe gives the browser's viewer, which we cannot page, cannot search
 * from our own chrome, and which several mobile browsers refuse to render at
 * all, showing a download prompt instead.
 *
 * Where the bytes come from is the part that matters. A presigned R2 URL sends
 * no CORS headers, so pdf.js fetching one is blocked before it reads a byte —
 * the failure looks like a corrupt PDF and is not. So anything with a raw route
 * on our own origin is streamed through it, and only a file with no such route
 * is attempted directly, with an honest fallback when that fails.
 *
 * All pages render in one scroll. A clinical PDF is one to four pages and the
 * question being asked of it is "what does it say", which paging through one
 * page at a time actively obstructs.
 */
const Btn = ({ onClick, title, children, disabled }) => (
  <button
    type="button" onClick={onClick} title={title} aria-label={title} disabled={disabled}
    className="w-9 h-9 grid place-items-center rounded-lg bg-white/10 text-white/90 hover:bg-white/20 transition-colors disabled:opacity-30 disabled:hover:bg-white/10"
  >
    {children}
  </button>
);

const PdfView = ({ file }) => {
  const [src, setSrc] = useState(null);        // blob URL, or the direct URL
  const [pages, setPages] = useState(0);
  const [scale, setScale] = useState(1.1);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const scrollRef = useRef(null);
  const pageRefs = useRef([]);

  // Load the bytes. A blob URL rather than handing pdf.js a path, so the
  // Authorization header can be attached — pdf.js's own fetch cannot carry one.
  useEffect(() => {
    let revoke = null;
    let cancelled = false;
    const controller = new AbortController();

    setSrc(null); setError(''); setPages(0); setPage(1);

    const path = rawPathFor(file);
    if (!path) {
      // No route of our own: try the presigned URL and let the Document's own
      // error handler describe it if CORS refuses.
      setSrc(file.url || null);
      if (!file.url) setError('This file has nothing to open.');
      return () => {};
    }

    fetchBlobUrl(path, controller.signal)
      .then((r) => {
        if (cancelled) { r.revoke(); return; }
        revoke = r.revoke;
        setSrc(r.url);
      })
      .catch((e) => {
        if (cancelled || e.name === 'AbortError') return;
        setError(e.status === 404
          ? 'This file is no longer in storage.'
          : 'This file could not be loaded.');
      });

    return () => {
      cancelled = true;
      controller.abort();
      // Without this every PDF opened stays in memory until the tab is closed.
      if (revoke) revoke();
    };
  }, [file.key, file.url]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Which page is in view, for the counter. Cheap enough on scroll because the
  // list is a handful of pages, not a virtualised thousand.
  const onScroll = useCallback(() => {
    const box = scrollRef.current;
    if (!box) return;
    const mid = box.scrollTop + box.clientHeight / 2;
    const idx = pageRefs.current.findIndex((el) => el && el.offsetTop + el.offsetHeight > mid);
    if (idx >= 0) setPage(idx + 1);
  }, []);

  const goto = (n) => {
    const el = pageRefs.current[n - 1];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (error) {
    return (
      <div className="absolute inset-0 grid place-items-center px-6 text-center">
        <div>
          <FileWarning size={30} className="mx-auto text-white/40" />
          <p className="mt-3 text-sm text-white/80">{error}</p>
          <p className="mt-1 text-[13px] text-white/50">You can still download it from the bar above.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="absolute inset-0 overflow-auto overscroll-contain px-3 py-4 sm:px-6"
      >
        <div className="mx-auto w-fit">
          <Document
            file={src}
            loading={
              <div className="grid place-items-center py-24">
                <Loader2 size={22} className="animate-spin text-white/60" />
              </div>
            }
            error={
              <div className="grid place-items-center py-24 px-6 text-center">
                <div>
                  <FileWarning size={30} className="mx-auto text-white/40" />
                  <p className="mt-3 text-sm text-white/80">This PDF could not be displayed.</p>
                  <p className="mt-1 text-[13px] text-white/50">Download it to open in another reader.</p>
                </div>
              </div>
            }
            onLoadSuccess={({ numPages }) => { setPages(numPages); pageRefs.current = []; }}
          >
            {Array.from({ length: pages }, (_, i) => (
              <div
                key={i}
                ref={(el) => { pageRefs.current[i] = el; }}
                className="mb-4 last:mb-0 shadow-2xl bg-white rounded-sm overflow-hidden"
              >
                <Page
                  pageNumber={i + 1}
                  scale={scale}
                  renderAnnotationLayer
                  renderTextLayer
                />
              </div>
            ))}
          </Document>
        </div>
      </div>

      {pages > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-xl bg-black/70 backdrop-blur px-2 py-1.5">
          <Btn onClick={() => setScale((s) => Math.max(0.4, s - 0.2))} title="Zoom out"><ZoomOut size={16} /></Btn>
          <span className="px-1.5 text-[12px] font-semibold text-white/80 tabular-nums select-none">
            {Math.round(scale * 100)}%
          </span>
          <Btn onClick={() => setScale((s) => Math.min(3, s + 0.2))} title="Zoom in"><ZoomIn size={16} /></Btn>

          {pages > 1 && (
            <>
              <span className="w-px h-5 bg-white/20 mx-1" />
              <Btn onClick={() => goto(Math.max(1, page - 1))} title="Previous page" disabled={page <= 1}>
                <ChevronUp size={16} />
              </Btn>
              <span className="px-1 text-[12px] font-semibold text-white/80 tabular-nums select-none">
                {page} / {pages}
              </span>
              <Btn onClick={() => goto(Math.min(pages, page + 1))} title="Next page" disabled={page >= pages}>
                <ChevronDown size={16} />
              </Btn>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default PdfView;
