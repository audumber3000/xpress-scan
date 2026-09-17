import React, { useEffect, useState } from 'react';
import { X, Loader2, Image as ImageIcon } from 'lucide-react';
import { IMAGING_CATEGORIES } from '../../../utils/fileCategories';
import { humanSize } from './fileHelpers';

/**
 * What kind of image is this, before it is filed.
 *
 * The tab used to take the files and upload them with no kind at all, so every
 * film arrived as an untyped blob — which is half of why none of them could be
 * found again. One question, asked once for the batch: a clinician uploading
 * four bitewings is uploading four bitewings.
 *
 * Centred rather than a side drawer, because this is a short confirmation of
 * something already begun, not a new flow.
 */
const ImagingUploadModal = ({
  open, files = [], areaLabel = 'Tooth / Area', defaultType = 'IOPA',
  uploading = false, onCancel, onConfirm,
}) => {
  const [type, setType] = useState(defaultType);
  const [area, setArea] = useState('');
  const [note, setNote] = useState('');

  // A fresh batch is a fresh answer: the type carries over from the filter the
  // clinician was already on, the finding never should.
  useEffect(() => {
    if (!open) return;
    setType(IMAGING_CATEGORIES.includes(defaultType) ? defaultType : 'IOPA');
    setArea('');
    setNote('');
  }, [open, defaultType]);

  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => { if (e.key === 'Escape' && !uploading) onCancel?.(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open, uploading, onCancel]);

  if (!open) return null;

  const total = files.reduce((n, f) => n + (f.size || 0), 0);

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm" onClick={() => !uploading && onCancel?.()} />
      <div className="fixed inset-0 z-[90] grid place-items-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900">
                {files.length === 1 ? 'Add this image' : `Add ${files.length} images`}
              </h3>
              <p className="mt-0.5 text-xs text-gray-500">
                {humanSize(total)} · filed on this patient&rsquo;s Imaging tab
              </p>
            </div>
            <button
              type="button"
              onClick={() => !uploading && onCancel?.()}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Cancel"
            >
              <X size={17} />
            </button>
          </div>

          <div className="space-y-5 px-5 py-5">
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
                What kind of image
              </label>
              <div className="flex flex-wrap gap-1.5">
                {IMAGING_CATEGORIES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                      type === t
                        ? 'border-[#2a276e] bg-[#2a276e] text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  {areaLabel}
                </label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="46, Lower Arch, Full Mouth"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Finding <span className="font-medium normal-case tracking-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Periapical radiolucency"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/10"
                />
              </div>
            </div>

            {files.length > 1 && (
              <p className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[11px] leading-snug text-gray-500">
                <ImageIcon size={13} className="mt-px shrink-0 text-gray-400" />
                All {files.length} files are filed as {type}. Upload them separately
                if they are different kinds.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button
              type="button"
              onClick={() => onCancel?.()}
              disabled={uploading}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm?.({ category: type, toothArea: area.trim(), notes: note.trim() })}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2a276e] px-4 py-2 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#1a1548] active:scale-[0.97] disabled:opacity-60"
            >
              {uploading && <Loader2 size={15} className="animate-spin" />}
              {uploading ? 'Uploading…' : `Upload ${files.length} file${files.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ImagingUploadModal;
