import { useEffect, useRef, useState, useCallback } from 'react';
import { cornerstone, loadDicomImage, dicomProxyUrl } from '../../utils/dicomLoader';

/**
 * Full-screen modal that renders a single-frame DICOM image with basic
 * pan / zoom / window-level controls, since browsers can't display .dcm natively.
 *
 * @param {number} fileId      - document id; loaded through our CORS-safe proxy
 * @param {string} downloadUrl - direct (presigned) URL for the Download buttons
 */
const DicomViewerModal = ({ fileId, downloadUrl, fileName, onClose }) => {
    const elRef = useRef(null);
    const enabledRef = useRef(false);
    const readyRef = useRef(false); // true only once an image is displayed
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const element = elRef.current;

        (async () => {
            try {
                enabledRef.current = true;
                await loadDicomImage(element, dicomProxyUrl(fileId));
                if (cancelled) return;
                readyRef.current = true;
                setLoading(false);
            } catch (e) {
                console.error('DICOM render failed:', e);
                if (!cancelled) {
                    setError('This DICOM file could not be displayed. You can download it to open in imaging software.');
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
            readyRef.current = false;
            if (enabledRef.current && element) {
                try { cornerstone.disable(element); } catch { /* already torn down */ }
                enabledRef.current = false;
            }
        };
    }, [fileId]);

    // Wheel = zoom around current view.
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const element = elRef.current;
        if (!readyRef.current) return;
        const vp = cornerstone.getViewport(element);
        vp.scale += e.deltaY < 0 ? 0.15 : -0.15;
        vp.scale = Math.max(0.1, Math.min(vp.scale, 12));
        cornerstone.setViewport(element, vp);
    }, []);

    // Drag = window/level (contrast/brightness); Shift+drag = pan.
    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        const element = elRef.current;
        if (!readyRef.current) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const startVp = cornerstone.getViewport(element);
        const pan = e.shiftKey;
        const startWW = startVp.voi.windowWidth;
        const startWC = startVp.voi.windowCenter;
        const startTx = startVp.translation.x;
        const startTy = startVp.translation.y;

        const onMove = (ev) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            const vp = cornerstone.getViewport(element);
            if (pan) {
                vp.translation.x = startTx + dx / vp.scale;
                vp.translation.y = startTy + dy / vp.scale;
            } else {
                vp.voi.windowWidth = Math.max(1, startWW + dx);
                vp.voi.windowCenter = startWC + dy;
            }
            cornerstone.setViewport(element, vp);
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, []);

    const reset = () => {
        const element = elRef.current;
        if (!readyRef.current) return;
        cornerstone.reset(element);
        cornerstone.fitToWindow(element);
    };

    return (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-sm" onClick={onClose}>
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
                <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{fileName || 'DICOM image'}</p>
                    <p className="text-[11px] text-white/50">Scroll to zoom · drag to adjust contrast · Shift+drag to pan</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {!loading && !error && (
                        <button
                            onClick={reset}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            Reset
                        </button>
                    )}
                    <a
                        href={downloadUrl}
                        download={fileName}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    >
                        Download
                    </a>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                        aria-label="Close viewer"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Canvas viewport */}
            <div className="flex-1 relative" onClick={(e) => e.stopPropagation()}>
                <div
                    ref={elRef}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    className="absolute inset-0 select-none"
                    style={{ cursor: 'crosshair' }}
                />
                {loading && !error && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm pointer-events-none">
                        Loading DICOM…
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                        <p className="text-white/80 text-sm max-w-md">{error}</p>
                        <a
                            href={downloadUrl}
                            download={fileName}
                            className="px-4 py-2 text-sm font-semibold rounded-lg bg-white text-gray-900 hover:bg-gray-100 transition-colors"
                        >
                            Download file
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DicomViewerModal;
