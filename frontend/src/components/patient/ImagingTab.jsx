import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Upload, Eye, Camera, ImageOff } from 'lucide-react';
import Spinner from '../common/Spinner';
import EmptyState from '../common/EmptyState';
import { noData } from '../../assets/illustrations';
import { api } from '../../utils/api';
import { notify } from '../../utils/notify';
import { formatDate } from '../../utils/datetime';
import CategoryChips from './files/CategoryChips';
import RvgCaptureModal from './files/RvgCaptureModal';
import FileFilterBar from './files/FileFilterBar';
import {
  ACCEPT, MAX_FILE_MB, humanSize, fileUrl, canOpen, isDicom, uploadDocumentWithProgress,
} from './files/fileHelpers';

const DicomViewerModal = lazy(() => import('./DicomViewerModal'));

/**
 * Imaging: films, photos and scans for one patient.
 *
 * Named for what clinics call it. "X-rays" excluded the intraoral photos and
 * scans that were already being filed here, and the tab is now the one place
 * every image of this patient lives.
 *
 * Types are the clinic's own vocabulary — IOPA, OPG, Bitewing, CBCT, Photo,
 * Scan — and they are stored that way, not translated on display, so an export
 * and this screen say the same word.
 */
const TYPES = [
  { key: 'all', label: 'All Images' },
  { key: 'IOPA', label: 'IOPA' },
  { key: 'OPG', label: 'OPG' },
  { key: 'Bitewing', label: 'Bitewing' },
  { key: 'CBCT', label: 'CBCT' },
  { key: 'Photo', label: 'Photo' },
  { key: 'Scan', label: 'Scan' },
];

const TYPE_STYLE = {
  IOPA: 'bg-[#2a276e]/[0.08] text-[#2a276e]',
  OPG: 'bg-violet-50 text-violet-700',
  Bitewing: 'bg-blue-50 text-blue-700',
  CBCT: 'bg-amber-50 text-amber-700',
  Photo: 'bg-emerald-50 text-emerald-700',
  Scan: 'bg-gray-100 text-gray-600',
};

const SORTS = [
  { value: 'newest', label: 'Sort: Newest first' },
  { value: 'oldest', label: 'Sort: Oldest first' },
];

const Thumb = ({ image }) => {
  const [failed, setFailed] = useState(false);
  const src = fileUrl(image);
  // An X-ray stored as a server-local path has nothing the browser can load, so
  // it gets the placeholder rather than a broken image icon.
  if (!canOpen(image) || failed) {
    return (
      <div className="aspect-[4/3] bg-gray-50 grid place-items-center text-gray-300">
        <ImageOff size={22} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={image.notes || image.file_name || 'Radiograph'}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-[4/3] w-full object-cover bg-gray-900"
    />
  );
};

const ImagingTab = ({ patientId, user }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dicomView, setDicomView] = useState(null);
  const [captureOpen, setCaptureOpen] = useState(false);

  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState('grid');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/xray/patient/${patientId}`);
      setImages(Array.isArray(res) ? res : []);
    } catch {
      notify.problem('Could not load this patient\'s imaging.');
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { if (patientId) load(); }, [patientId, load]);

  const counts = useMemo(() => TYPES.reduce((acc, t) => {
    acc[t.key] = t.key === 'all' ? images.length : images.filter((i) => i.image_type === t.key).length;
    return acc;
  }, {}), [images]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = images.filter((i) => {
      if (type !== 'all' && i.image_type !== type) return false;
      if (!q) return true;
      return [i.notes, i.file_name, i.tooth_area].filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    return out.sort((a, b) => {
      const da = new Date(a.capture_date || a.created_at || 0);
      const db = new Date(b.capture_date || b.created_at || 0);
      return sort === 'oldest' ? da - db : db - da;
    });
  }, [images, type, query, sort]);

  const open = (image) => {
    if (isDicom(image)) { setDicomView(image); return; }
    if (canOpen(image)) window.open(fileUrl(image), '_blank', 'noopener');
    else notify.problem('This image has no file that can be opened in the browser.');
  };

  const upload = async (fileList) => {
    const all = Array.from(fileList || []).filter(Boolean);
    const valid = all.filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024);
    if (all.length !== valid.length) notify.problem(`Files over ${MAX_FILE_MB} MB were skipped.`);
    if (!valid.length) return;
    setUploading(true);
    try {
      for (const f of valid) await uploadDocumentWithProgress(patientId, f, () => {});
      notify.done(valid.length === 1 ? 'Image uploaded' : `${valid.length} images uploaded`);
      await load();
    } catch {
      notify.problem('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const Badge = ({ t }) => (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${TYPE_STYLE[t] || 'bg-gray-100 text-gray-600'}`}>
      {t || 'Image'}
    </span>
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <CategoryChips
          items={TYPES.map((t) => ({ ...t, count: counts[t.key] ?? 0 }))}
          value={type}
          onChange={setType}
          className="flex-1 min-w-0"
        />

        <div className="flex items-center gap-2 flex-shrink-0">
          <label className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 transition-colors ${
            uploading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
          }`}>
            {uploading ? <Spinner className="w-4 h-4" /> : <Upload size={15} className="text-[#2a276e]" />}
            {uploading ? 'Uploading' : 'Upload'}
            <input
              type="file" multiple accept={ACCEPT} disabled={uploading} className="hidden"
              onChange={(e) => { upload(e.target.files); e.target.value = ''; }}
            />
          </label>

          {/* Capture means the sensor on the chair, not the tablet's camera.
              Until a device is bridged this opens the modal that says so and
              routes to the person who can connect one. */}
          <button
            type="button"
            onClick={() => setCaptureOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-[#2a276e] text-white text-sm font-semibold hover:bg-[#1a1548] transition-colors cursor-pointer"
          >
            <Camera size={15} />
            Capture Image
          </button>
        </div>
      </div>

      <FileFilterBar
        query={query}
        onQuery={setQuery}
        placeholder="Search by tooth, note or file name…"
        sort={sort}
        onSort={setSort}
        sortOptions={SORTS}
        view={view}
        onView={setView}
      />

      {loading ? (
        <div className="p-10 grid place-items-center"><Spinner className="w-6 h-6 text-[#2a276e]" /></div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-10">
          <EmptyState
            image={noData}
            title={images.length === 0 ? 'No imaging yet' : 'Nothing matches that'}
            subtitle={images.length === 0
              ? 'Upload an IOPA, OPG or intraoral photo and it will appear here.'
              : 'Try a different type or clear the search.'}
          />
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {visible.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => open(img)}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden text-left hover:border-[#2a276e]/35 transition-colors cursor-pointer"
            >
              <Thumb image={img} />
              <div className="p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">
                    {formatDate(img.capture_date || img.created_at)}
                  </span>
                  <Badge t={img.image_type} />
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate" title={img.notes || img.file_name}>
                  {img.notes || img.file_name || 'Untitled'}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  {[img.tooth_area, img.file_size ? humanSize(img.file_size) : null].filter(Boolean).join('  ·  ') || '—'}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full min-w-[46rem]">
            <thead>
              <tr className="border-b border-gray-100">
                {['Date', 'Type', 'Tooth / Area', 'Description', 'Size', ''].map((h, i) => (
                  <th key={h || i} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map((img) => (
                <tr key={img.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                    {formatDate(img.capture_date || img.created_at)}
                  </td>
                  <td className="px-4 py-3"><Badge t={img.image_type} /></td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-900 whitespace-nowrap">
                    {img.tooth_area || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <span className="block truncate max-w-[16rem]" title={img.notes}>{img.notes || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {img.file_size ? humanSize(img.file_size) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => open(img)}
                      aria-label={`Open ${img.notes || img.file_name || 'image'}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#2a276e] hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RvgCaptureModal open={captureOpen} onClose={() => setCaptureOpen(false)} user={user} />

      {dicomView && (
        <Suspense fallback={<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 text-white text-sm">Loading viewer…</div>}>
          {/* fileId / downloadUrl / fileName, matching the viewer's actual
              props. A single `file` object would have rendered an empty
              viewer with no error. */}
          <DicomViewerModal
            fileId={dicomView.id}
            downloadUrl={fileUrl(dicomView)}
            fileName={dicomView.file_name}
            onClose={() => setDicomView(null)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default ImagingTab;
