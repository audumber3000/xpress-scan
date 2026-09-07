/**
 * What a file is, from the viewer's point of view.
 *
 * Deliberately its own copy rather than an import from patient/files/fileHelpers:
 * that module answers the same question about the *row shapes* the Documents and
 * Imaging tabs hold, and this one answers it about the normalised shape the
 * viewer takes. Coupling them would mean the viewer could only ever be opened
 * from those two tabs.
 *
 * The viewable shape:
 *   { key, id, source, name, url, fileType, subtitle? }
 *
 *   source    which table it came from — decides the byte-streaming route.
 *             'document' | 'upload' | 'xray' | 'invoice' | 'report' |
 *             'prescription' | ''
 *   url       the presigned/direct URL. Fine for <img> and for Download; never
 *             fetchable cross-origin, so anything that parses bytes uses the
 *             source's raw route instead.
 *   fileType  an extension or a mime fragment; both turn up in the wild.
 */

const ext = (file) => {
  const fromName = (file?.name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const fromUrl = (file?.url || '').toLowerCase().split(/[?#]/)[0].match(/\.([a-z0-9]+)$/)?.[1];
  const declared = (file?.fileType || '').toLowerCase().replace(/^.*\//, '').replace(/^\./, '');
  return { fromName, fromUrl, declared };
};

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif']);
const DICOM_EXT = new Set(['dcm', 'dicom']);

export const kindOf = (file) => {
  const { fromName, fromUrl, declared } = ext(file);
  const type = (file?.fileType || '').toLowerCase();
  const any = [fromName, fromUrl, declared].filter(Boolean);

  if (any.some((e) => DICOM_EXT.has(e)) || type.includes('dicom')) return 'dicom';
  if (any.some((e) => e === 'pdf') || type.includes('pdf')) return 'pdf';
  if (any.some((e) => IMAGE_EXT.has(e)) || type.startsWith('image') || type === 'photo') return 'image';

  // A TIFF is an image by every definition except the one that matters: no
  // browser renders it. Calling it 'other' gets the honest download card
  // instead of a broken <img>.
  return 'other';
};

/** Everything a viewer can actually display. Used to decide whether a row is
 *  clickable at all, and to build the prev/next list. */
export const isViewable = (file) => kindOf(file) !== 'other';

export const KIND_LABEL = {
  image: 'Image',
  pdf: 'PDF',
  dicom: 'DICOM',
  other: 'File',
};
