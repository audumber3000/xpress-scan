import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Upload, X, RefreshCw, User } from 'lucide-react';
import { notify } from '../../utils/notify';
import { api } from '../../utils/api';

/**
 * A patient's photo: uploaded from a file, or taken on the spot.
 *
 * The camera is the part with teeth, so the things that actually break are
 * handled rather than assumed:
 *
 *  - `getUserMedia` only exists on a secure origin — HTTPS or localhost. That
 *    covers production and dev, but it vanishes silently if anyone opens the
 *    app over plain HTTP on a LAN address, which a front desk on a local
 *    network may well do. The dialog says so instead of showing a dead frame.
 *  - The stream must be stopped explicitly. A webcam light left burning after
 *    the drawer closes is the most alarming bug this feature can have, so it is
 *    released on close, on unmount, and on capture.
 *  - Permission can be denied, no camera can exist, or another app can hold it.
 *    Each of those says something different and actionable.
 *  - The capture is downscaled and JPEG-encoded in the browser before sending.
 *    The server does it again, but a clinic on a slow line should not push four
 *    megabytes up to have it thrown away at the other end.
 */

const CAPTURE_MAX = 800;      // the server's own target, so nothing is wasted
const JPEG_QUALITY = 0.85;
const MAX_BYTES = 8 * 1024 * 1024;

const cameraSupported = () => !!(
  typeof navigator !== 'undefined'
  && navigator.mediaDevices
  && typeof navigator.mediaDevices.getUserMedia === 'function'
);

const secureOrigin = () => (
  typeof window === 'undefined'
  || window.isSecureContext
  || ['localhost', '127.0.0.1'].includes(window.location.hostname)
);

export default function PatientPhoto({
  patientId,
  value,
  onChange,
  size = 'md',
  editable = true,
  // `inline` sits the controls beside the picture, for a form row. `stacked`
  // puts them under it, centred. `hero` runs the picture edge to edge — no
  // frame, no radius of its own — for a container that clips it to its own
  // corners, with the controls in a padded band beneath.
  layout = 'inline',
  // Shown between the picture and the controls in the hero layout: the name.
  caption = null,
}) {
  const [busy, setBusy] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [camError, setCamError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);

  const box = size === 'xl' ? 'w-72 h-72 max-w-full'
    : size === 'lg' ? 'w-32 h-32' : size === 'sm' ? 'w-12 h-12' : 'w-20 h-20';
  // Square with a soft corner, not a circle. A circular crop cuts the top of
  // the head and the chin off a portrait, and an ID photo is square everywhere
  // else a clinic has ever seen one.
  const radius = size === 'sm' ? 'rounded-md' : size === 'xl' ? 'rounded-xl' : 'rounded-lg';
  const icon = size === 'xl' ? 72 : size === 'lg' ? 44 : size === 'sm' ? 18 : 28;
  const stacked = layout === 'stacked';
  const hero = layout === 'hero';

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Navigating away mid-capture would otherwise leave the webcam light on
  // until the tab is closed.
  useEffect(() => stopCamera, [stopCamera]);

  const openCamera = async () => {
    setCamError('');
    setCamOpen(true);
    if (!secureOrigin()) {
      setCamError('Your browser only allows the camera on a secure (https) address. Upload a photo instead.');
      return;
    }
    if (!cameraSupported()) {
      setCamError('This browser cannot reach a camera. Upload a photo instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      const named = {
        NotAllowedError: 'Camera access was blocked. Allow it from your browser’s address bar, then try again.',
        NotFoundError: 'No camera found on this computer. Upload a photo instead.',
        NotReadableError: 'The camera is already in use by another app. Close that and try again.',
        OverconstrainedError: 'This camera does not support the requested settings.',
      };
      setCamError(named[err?.name] || 'Could not start the camera. Upload a photo instead.');
    }
  };

  const closeCamera = () => { stopCamera(); setCamOpen(false); setCamError(''); };

  const send = async (blob, filename) => {
    // Before the patient exists there is nowhere to attach it, so the caller
    // holds the blob and uploads once the record has an id.
    if (!patientId) {
      onChange?.({ pendingBlob: blob, previewUrl: URL.createObjectURL(blob) });
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', blob, filename);
      const res = await api.post(`/patients/${patientId}/photo`, body);
      onChange?.({ photo_url: res?.photo_url || null });
      notify.done('Photo saved');
    } catch (e) {
      notify.problem(e?.message || 'Could not save that photo');
    } finally {
      setBusy(false);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      notify.problem('The camera is still starting, give it a moment');
      return;
    }
    const scale = Math.min(1, CAPTURE_MAX / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { notify.problem('Could not read that frame, try again'); return; }
      closeCamera();
      send(blob, 'capture.jpg');
    }, 'image/jpeg', JPEG_QUALITY);
  };

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';          // so re-picking the same file still fires
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify.problem('Choose an image file'); return; }
    if (file.size > MAX_BYTES) { notify.problem('That photo is over 8 MB'); return; }
    await send(file, file.name || 'photo.jpg');
  };

  const remove = async () => {
    if (!patientId) { onChange?.({ pendingBlob: null, previewUrl: null }); return; }
    setBusy(true);
    try {
      await api.delete(`/patients/${patientId}/photo`);
      onChange?.({ photo_url: null });
    } catch (e) {
      notify.problem(e?.message || 'Could not remove that photo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={hero ? '' : stacked ? 'flex flex-col items-center gap-4' : 'flex items-start gap-4'}>
      {hero ? (
        // Square, full width, nothing around it. A face is the reason this
        // dialog exists, so it gets every pixel the dialog has.
        <div className="relative w-full aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
          {value
            ? <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
            : <User className="text-gray-300" size={96} />}
          {busy && (
            <div className="absolute inset-0 bg-white/60 grid place-items-center">
              <RefreshCw size={22} className="text-[#2a276e] animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div className={`${box} ${radius} bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0`}>
          {value
            ? <img src={value} alt="" className="w-full h-full object-cover" />
            : <User className="text-gray-300" size={icon} />}
        </div>
      )}

      {editable && (
        <div className={hero ? 'px-5 pt-4 pb-5 text-center' : stacked ? 'min-w-0 text-center' : 'min-w-0'}>
          {hero && caption}
          <div className={`flex flex-wrap items-center gap-2 ${stacked || hero ? 'justify-center' : ''} ${hero ? 'mt-4' : ''}`}>
            <button
              type="button" onClick={openCamera} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#2a276e] hover:bg-[#211e57] disabled:opacity-40"
            >
              <Camera size={13} /> Take photo
            </button>
            <button
              type="button" onClick={() => fileRef.current?.click()} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              <Upload size={13} /> Upload
            </button>
            {value && (
              <button
                type="button" onClick={remove} disabled={busy}
                className="text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-40"
              >
                Remove
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-gray-400">
            Helps the front desk recognise the right patient. JPEG or PNG, up to 8 MB.
          </p>
          <input
            ref={fileRef} type="file" accept="image/*"
            onChange={pickFile} className="hidden"
          />
        </div>
      )}

      {camOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeCamera} />
          <div className="relative w-full max-w-md bg-white rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Take a photo</h3>
              <button type="button" onClick={closeCamera} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {camError ? (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-700">{camError}</p>
                <button
                  type="button"
                  onClick={() => { closeCamera(); fileRef.current?.click(); }}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#2a276e]"
                >
                  <Upload size={14} /> Upload a photo instead
                </button>
              </div>
            ) : (
              <>
                <div className="bg-black aspect-[4/3] flex items-center justify-center">
                  {/* Mirrored: a preview that moves the opposite way to the
                      person in front of it is very hard to aim. */}
                  <video
                    ref={videoRef} playsInline muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </div>
                <div className="p-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={openCamera}
                    title="Restart the camera"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50"
                  >
                    <RefreshCw size={13} /> Retry
                  </button>
                  <button
                    type="button"
                    onClick={capture}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#29828a] hover:bg-[#20666c]"
                  >
                    <Camera size={15} /> Capture
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
