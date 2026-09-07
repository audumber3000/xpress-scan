// Isolated Cornerstone/DICOM wiring. Kept separate from UI so the heavy decode
// libraries can be code-split (the viewer is lazy-loaded) and so all the
// loader-specific setup lives in one place.
import cornerstone from 'cornerstone-core';
import dicomParser from 'dicom-parser';
// Use the self-contained "NoWebWorkers" build: it bundles the image codecs and
// decodes on the main thread, so there's no separate worker/codec file to serve
// through Vite (the worker build fails to locate those under a bundler).
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader/dist/cornerstoneWADOImageLoaderNoWebWorkers.bundle.min.js';

const API_BASE = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/v1`;

// R2 presigned URLs block cross-origin XHR (no CORS headers), so DICOM is fetched
// through our own API, which is CORS-enabled. This builds that proxy URL.
//
// Takes the path rather than an id. It used to take a document id and always
// build `/documents/{id}/raw`, but the Imaging tab passes rows from
// `xray_images` — a different table with its own id sequence — so a radiograph
// either 404'd or, where a document happened to share the number, streamed an
// unrelated file. The caller now says which route the file lives on; see
// utils/pdfLoader.js rawPathFor, which is the single place that mapping lives.
export const dicomProxyUrl = (rawPath) => `${API_BASE}${rawPath}`;

let configured = false;
const configure = () => {
    if (configured) return;
    cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
    cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
    // The loader's XHR doesn't carry our auth header by default — add it so the
    // proxy endpoint can require authentication.
    cornerstoneWADOImageLoader.configure({
        beforeSend: (xhr) => {
            const token = localStorage.getItem('auth_token');
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        },
    });
    configured = true;
};

// Re-export so the viewer can drive the viewport (zoom/pan/window-level) without
// importing cornerstone-core directly.
export { cornerstone };

/**
 * Load a DICOM from a URL into a cornerstone-enabled element and fit it to view.
 * Throws if the file can't be fetched or decoded — the caller renders a fallback.
 */
export const loadDicomImage = async (element, url) => {
    configure();
    cornerstone.enable(element);
    const image = await cornerstone.loadImage(`wadouri:${url}`);
    cornerstone.displayImage(element, image);
    cornerstone.fitToWindow(element);
    return image;
};
