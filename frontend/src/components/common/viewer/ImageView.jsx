import React, { useState } from 'react';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, Maximize2, RotateCw, ImageOff, Loader2 } from 'lucide-react';

/**
 * A photo, a scanned form or a non-DICOM radiograph.
 *
 * react-zoom-pan-pinch does the work: wheel zoom, pinch on a touchscreen,
 * double-tap, drag to pan, and the momentum that makes a large OPG feel like
 * something you are moving rather than something you are nudging. Written by
 * hand this is the part that is always subtly wrong on a tablet.
 *
 * The image loads straight from its presigned URL. An <img> needs no CORS
 * headers to display a cross-origin file — only code that reads the bytes does,
 * which is why the PDF and DICOM views stream through our API and this one
 * does not.
 *
 * Rotation is here because a radiograph handed over by a sensor is not always
 * the way up the dentist wants to read it, and that is a display choice, not an
 * edit: nothing is written back.
 */
const Btn = ({ onClick, title, children, active }) => (
  <button
    type="button" onClick={onClick} title={title} aria-label={title}
    className={`w-9 h-9 grid place-items-center rounded-lg transition-colors ${
      active ? 'bg-white/25 text-white' : 'bg-white/10 text-white/90 hover:bg-white/20'
    }`}
  >
    {children}
  </button>
);

const Controls = ({ rotation, onRotate }) => {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-xl bg-black/60 backdrop-blur px-2 py-1.5">
      <Btn onClick={() => zoomOut()} title="Zoom out"><ZoomOut size={16} /></Btn>
      <Btn onClick={() => zoomIn()} title="Zoom in"><ZoomIn size={16} /></Btn>
      <Btn onClick={() => { resetTransform(); onRotate(0); }} title="Fit to screen"><Maximize2 size={16} /></Btn>
      <Btn onClick={() => onRotate((rotation + 90) % 360)} title="Rotate" active={rotation !== 0}>
        <RotateCw size={16} />
      </Btn>
    </div>
  );
};

const ImageView = ({ file }) => {
  const [state, setState] = useState('loading');   // loading | ready | failed
  const [rotation, setRotation] = useState(0);

  if (state === 'failed') {
    return (
      <div className="absolute inset-0 grid place-items-center px-6 text-center">
        <div>
          <ImageOff size={30} className="mx-auto text-white/40" />
          <p className="mt-3 text-sm text-white/80">This image could not be loaded.</p>
          <p className="mt-1 text-[13px] text-white/50">
            The link may have expired. Close and reopen the file, or download it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {state === 'loading' && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <Loader2 size={22} className="animate-spin text-white/60" />
        </div>
      )}

      <TransformWrapper
        // A radiograph is usually darker and smaller than the viewport, so it
        // opens fitted rather than at 1:1, and the ceiling is high because
        // reading a periapical means going right in on one root tip.
        initialScale={1}
        minScale={0.2}
        maxScale={12}
        centerOnInit
        doubleClick={{ mode: 'toggle', step: 2 }}
        wheel={{ step: 0.12 }}
      >
        <Controls rotation={rotation} onRotate={setRotation} />
        <TransformComponent
          wrapperClass="!w-full !h-full"
          contentClass="!w-full !h-full grid place-items-center"
        >
          <img
            src={file.url}
            alt={file.name || 'Image'}
            onLoad={() => setState('ready')}
            onError={() => setState('failed')}
            draggable={false}
            className="max-w-full max-h-full object-contain select-none transition-transform duration-200"
            style={{ transform: `rotate(${rotation}deg)`, visibility: state === 'ready' ? 'visible' : 'hidden' }}
          />
        </TransformComponent>
      </TransformWrapper>
    </>
  );
};

export default ImageView;
