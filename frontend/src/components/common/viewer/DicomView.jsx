import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, FileWarning, Contrast, Maximize2 } from 'lucide-react';
import { cornerstone, loadDicomImage, dicomProxyUrl } from '../../../utils/dicomLoader';
import { rawPathFor } from '../../../utils/fileBytes';

/**
 * A DICOM radiograph, which no browser can display on its own.
 *
 * Cornerstone decodes it and drives the viewport. This is the same engine the
 * old DicomViewerModal used, lifted out of its modal chrome so the one file
 * viewer can host it beside the image and PDF views instead of there being two
 * full-screen overlays with two sets of controls.
 *
 * Window/level on drag is the control that matters clinically and the reason a
 * .dcm is worth keeping as a .dcm: the file holds a far wider range of values
 * than a screen can show at once, and moving that window is how a thin
 * periapical radiolucency becomes visible. A flattened PNG has already thrown
 * that away.
 */
const DicomView = ({ file }) => {
  const elRef = useRef(null);
  const enabledRef = useRef(false);
  const readyRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const element = elRef.current;
    const path = rawPathFor(file);

    if (!path) {
      setError('This file has no route we can stream it through.');
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setError('');

    (async () => {
      try {
        enabledRef.current = true;
        await loadDicomImage(element, dicomProxyUrl(path));
        if (cancelled) return;
        readyRef.current = true;
        setLoading(false);
      } catch (e) {
        console.error('DICOM render failed:', e);
        if (cancelled) return;
        setError('This DICOM could not be displayed. Download it to open in imaging software.');
        setLoading(false);
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
  }, [file.key]);   // eslint-disable-line react-hooks/exhaustive-deps

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const element = elRef.current;
    if (!readyRef.current) return;
    const vp = cornerstone.getViewport(element);
    vp.scale = Math.max(0.1, Math.min(vp.scale + (e.deltaY < 0 ? 0.15 : -0.15), 12));
    cornerstone.setViewport(element, vp);
  }, []);

  // Drag adjusts window/level; Shift+drag pans. Same bindings every dental
  // imaging package uses, so it is the gesture a dentist already has.
  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    const element = elRef.current;
    if (!readyRef.current) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = cornerstone.getViewport(element);
    const pan = e.shiftKey;
    const startWW = start.voi.windowWidth;
    const startWC = start.voi.windowCenter;
    const startTx = start.translation.x;
    const startTy = start.translation.y;

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

  const invert = () => {
    const element = elRef.current;
    if (!readyRef.current) return;
    const vp = cornerstone.getViewport(element);
    vp.invert = !vp.invert;
    cornerstone.setViewport(element, vp);
  };

  if (error) {
    return (
      <div className="absolute inset-0 grid place-items-center px-6 text-center">
        <div>
          <FileWarning size={30} className="mx-auto text-white/40" />
          <p className="mt-3 text-sm text-white/80 max-w-md">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={elRef}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        className="absolute inset-0 select-none"
        style={{ cursor: 'crosshair' }}
      />

      {loading && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <Loader2 size={22} className="animate-spin text-white/60" />
        </div>
      )}

      {!loading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-xl bg-black/70 backdrop-blur px-2.5 py-1.5">
          <button type="button" onClick={invert} title="Invert"
            className="w-9 h-9 grid place-items-center rounded-lg bg-white/10 text-white/90 hover:bg-white/20 transition-colors">
            <Contrast size={16} />
          </button>
          <button type="button" onClick={reset} title="Fit to screen"
            className="w-9 h-9 grid place-items-center rounded-lg bg-white/10 text-white/90 hover:bg-white/20 transition-colors">
            <Maximize2 size={16} />
          </button>
          <span className="pl-1.5 pr-1 text-[11px] text-white/50 select-none hidden sm:inline">
            drag to adjust contrast · shift+drag to pan · scroll to zoom
          </span>
        </div>
      )}
    </>
  );
};

export default DicomView;
