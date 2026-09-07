/**
 * pdf.js worker wiring, isolated the same way utils/dicomLoader.js is.
 *
 * Importing this module pulls in the whole pdf.js bundle, so only the PDF
 * renderer may import it — anything else that needs a file's bytes uses
 * utils/fileBytes.js, which has no renderer dependency.
 *
 * pdf.js decodes on a worker thread and refuses to start without one.
 * `new URL(..., import.meta.url)` is the form Vite can resolve statically, so
 * the worker is fingerprinted and emitted as a real asset rather than fetched
 * from a CDN at runtime, which would break on a filtered or offline network.
 */
import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export { pdfjs };
