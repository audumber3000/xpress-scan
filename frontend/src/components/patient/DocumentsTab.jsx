import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Plus, FileText, Download, ExternalLink, FileSignature, Receipt, ClipboardList } from 'lucide-react';
import Spinner from '../common/Spinner';
import EmptyState from '../common/EmptyState';
import { noData } from '../../assets/illustrations';
import { api } from '../../utils/api';
import { notify } from '../../utils/notify';
import { downloadAuthedFile } from '../../utils/whatsapp';
import { formatDate } from '../../utils/datetime';
import CategoryChips from './files/CategoryChips';
import FileFilterBar from './files/FileFilterBar';
import {
  CATEGORIES, CATEGORY_STYLE, fetchPatientDocuments, countByCategory,
} from './files/documentSources';
import FormReviewModal from '../forms/FormReviewModal';
import SendFormBar from './files/SendFormBar';
import {
  ACCEPT, MAX_FILE_MB, humanSize, uploadDocumentWithProgress,
} from './files/fileHelpers';

/**
 * Every document this patient has, from wherever it was made.
 *
 * This tab used to list uploads only, which meant a consent form, a
 * prescription PDF and an invoice each lived on a different tab and "find the
 * paperwork" meant trying three of them. It now aggregates all five sources
 * (see files/documentSources.js) into one list with real category counts.
 *
 * It reads. Creating a consent, a prescription or an invoice happens in the
 * drawer that owns it — the Quick Actions column routes there rather than
 * growing a second implementation here.
 */
const CATEGORY_ICON = {
  consent: FileSignature,
  prescription: ClipboardList,
  report: FileText,
  invoice: Receipt,
  upload: FileText,
};

const SORTS = [
  { value: 'newest', label: 'Sort: Newest first' },
  { value: 'oldest', label: 'Sort: Oldest first' },
  { value: 'name', label: 'Sort: Name' },
];

const DATE_WINDOWS = [
  { value: 'all', label: 'All dates' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 3 months' },
  { value: '365', label: 'Last year' },
];

const DocumentRow = ({ doc, onOpen }) => {
  const Icon = CATEGORY_ICON[doc.category] || FileText;
  // A form has no file: its answers are data, and the row opens the review
  // panel instead. Without this it rendered as an un-openable dead row.
  const openable = Boolean(doc.url || doc.route || doc.download || doc.source === 'form');
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
      <span className={`w-10 h-10 rounded-lg grid place-items-center flex-shrink-0 ${CATEGORY_STYLE[doc.category] || 'bg-gray-100 text-gray-500'}`}>
        <Icon size={17} />
      </span>
      {doc.needsReview && (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200 bg-amber-50 text-amber-700 shrink-0 order-last">
          Needs review
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-gray-900 truncate" title={doc.title}>{doc.title}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0 whitespace-nowrap ${CATEGORY_STYLE[doc.category]}`}>
            {CATEGORIES.find((c) => c.key === doc.category)?.label.replace(/s$/, '') || 'File'}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 truncate">
          {[
            doc.date ? formatDate(doc.date) : null,
            doc.size ? humanSize(doc.size) : null,
            doc.fileType ? doc.fileType.toUpperCase() : null,
            doc.addedBy ? `Added by ${doc.addedBy}` : null,
          ].filter(Boolean).join('  ·  ')}
        </p>
      </div>

      {openable ? (
        <button
          type="button"
          onClick={() => onOpen(doc)}
          aria-label={`Open ${doc.title}`}
          className="p-2 rounded-lg text-gray-400 hover:text-[#2a276e] hover:bg-gray-50 transition-colors flex-shrink-0 cursor-pointer"
        >
          {doc.route ? <ExternalLink size={16} /> : <Download size={16} />}
        </button>
      ) : (
        // Say why rather than showing a button that does nothing. Older rows
        // predate cloud storage and have no reachable file.
        <span className="text-[11px] text-gray-300 flex-shrink-0 whitespace-nowrap" title="This record has no stored file">
          No file
        </span>
      )}
    </div>
  );
};

const DocumentsTab = ({ patientId, patient, prescriptions = [], invoices = [], onQuickAction }) => {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reviewing, setReviewing] = useState(null);

  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [window_, setWindow] = useState('all');
  const [sort, setSort] = useState('newest');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, tpl] = await Promise.all([
        fetchPatientDocuments(patientId, { prescriptions, invoices }),
        api.get('/consents/templates').catch(() => []),
      ]);
      setDocs(all);
      // Most-used first: a template list ordered by what the clinic actually
      // reaches for beats one ordered by when it happened to be created.
      setTemplates([...(Array.isArray(tpl) ? tpl : [])]
        .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0)).slice(0, 4));
    } catch (e) {
      notify.problem('Could not load this patient\'s documents.');
    } finally {
      setLoading(false);
    }
    // prescriptions/invoices are owned by the page above; re-running on every
    // new array identity would refetch on each of its renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, prescriptions.length, invoices.length]);

  useEffect(() => { if (patientId) load(); }, [patientId, load]);

  const counts = useMemo(() => countByCategory(docs), [docs]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff = window_ === 'all' ? null : Date.now() - Number(window_) * 86400000;
    const out = docs.filter((d) => {
      if (category !== 'all' && d.category !== category) return false;
      if (q && !d.title.toLowerCase().includes(q)) return false;
      if (cutoff && (!d.date || new Date(d.date).getTime() < cutoff)) return false;
      return true;
    });
    if (sort === 'name') return out.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'oldest') return out.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    return out.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [docs, category, query, window_, sort]);

  const openDoc = async (doc) => {
    if (doc.source === 'form') { setReviewing(doc.id); return; }
    if (doc.route) { navigate(doc.route); return; }
    if (doc.url) { window.open(doc.url, '_blank', 'noopener'); return; }
    // Behind auth, so it cannot simply be opened in a tab.
    if (doc.download) {
      try {
        await downloadAuthedFile(doc.download, `${doc.title.replace(/\s+/g, '_')}.pdf`);
      } catch {
        notify.problem('Could not download that file.');
      }
    }
  };

  const upload = async (fileList) => {
    const all = Array.from(fileList || []).filter(Boolean);
    const limit = MAX_FILE_MB * 1024 * 1024;
    const valid = all.filter((f) => f.size <= limit);
    if (all.length !== valid.length) {
      notify.problem(`Files over ${MAX_FILE_MB} MB were skipped.`);
    }
    if (!valid.length) return;
    setUploading(true);
    try {
      for (const f of valid) await uploadDocumentWithProgress(patientId, f, () => {});
      notify.done(valid.length === 1 ? 'Document uploaded' : `${valid.length} documents uploaded`);
      await load();
    } catch (e) {
      notify.problem('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const QUICK = [
    { key: 'consent', label: 'Create Consent Form', icon: FileSignature },
    { key: 'prescription', label: 'Create Prescription', icon: ClipboardList },
    { key: 'invoice', label: 'Create Invoice', icon: Receipt },
  ];

  return (
    <div>
      {/* No <h2>. The tab strip directly above already says Documents, and a
          heading that repeats it costs a row and tells nobody anything. */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <CategoryChips
          items={CATEGORIES.map((c) => ({ ...c, count: counts[c.key] ?? 0 }))}
          value={category}
          onChange={setCategory}
          className="flex-1 min-w-0"
        />

        {/* Uploading is the one thing this tab itself creates, so it is the
            primary. Consents, prescriptions and invoices are made in the
            drawers that own them, from Quick actions. */}
        <label className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-[#2a276e] text-white text-sm font-semibold flex-shrink-0 transition-colors ${
          uploading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[#1a1548] cursor-pointer'
        }`}>
          {uploading ? <Spinner className="w-4 h-4" /> : <Upload size={15} />}
          {uploading ? 'Uploading' : 'Upload Document'}
          <input
            type="file"
            multiple
            accept={ACCEPT}
            disabled={uploading}
            className="hidden"
            onChange={(e) => { upload(e.target.files); e.target.value = ''; }}
          />
        </label>
      </div>

      <SendFormBar patientId={patientId} patient={patient} onSent={load} />

      <FileFilterBar
        query={query}
        onQuery={setQuery}
        placeholder="Search documents…"
        filters={[{
          key: 'date', label: 'Date range', value: window_, onChange: setWindow, options: DATE_WINDOWS,
        }]}
        sort={sort}
        onSort={setSort}
        sortOptions={SORTS}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <section className="bg-white border border-gray-200 rounded-xl min-w-0">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">
              {category === 'all' ? 'All documents' : CATEGORIES.find((c) => c.key === category)?.label}
              <span className="ml-1.5 text-gray-400 font-semibold">{visible.length}</span>
            </h3>
          </div>

          {loading ? (
            <div className="p-10 grid place-items-center"><Spinner className="w-6 h-6 text-[#2a276e]" /></div>
          ) : visible.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState
                image={noData}
                title={docs.length === 0 ? 'No documents yet' : 'Nothing matches that'}
                subtitle={docs.length === 0
                  ? 'Consents, prescriptions, invoices and anything you upload all show up here.'
                  : 'Try a different category or clear the search.'}
              />
            </div>
          ) : (
            visible.map((doc) => <DocumentRow key={doc.key} doc={doc} onOpen={openDoc} />)
          )}
        </section>

        <div className="space-y-4 min-w-0">
          <section className="bg-white border border-gray-200 rounded-xl">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">Quick actions</h3>
            </div>
            <div className="p-2">
              {QUICK.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onQuickAction?.(key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <span className="w-8 h-8 rounded-lg bg-[#2a276e]/[0.07] text-[#2a276e] grid place-items-center flex-shrink-0">
                    <Icon size={15} />
                  </span>
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </button>
              ))}
            </div>
          </section>

          {templates.length > 0 && (
            <section className="bg-white border border-gray-200 rounded-xl">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">Consent templates</h3>
              </div>
              <div className="p-2">
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className="w-8 h-8 rounded-lg bg-[#2a276e]/[0.07] text-[#2a276e] grid place-items-center flex-shrink-0">
                      <FileSignature size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate" title={t.name}>{t.name}</p>
                      {/* A real count, from patient_consents. */}
                      <p className="text-[11px] text-gray-400">
                        {t.usage_count > 0
                          ? `Used ${t.usage_count} ${t.usage_count === 1 ? 'time' : 'times'}`
                          : 'Not used yet'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/consent/preview/${t.id}`)}
                      className="text-[11px] font-semibold text-[#2a276e] hover:underline flex-shrink-0 cursor-pointer"
                    >
                      Preview
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
      {reviewing && (
        <FormReviewModal
          submissionId={reviewing}
          onClose={() => setReviewing(null)}
          onApplied={(res) => {
            load();
            notify.done(res?.count ? `${res.count} field${res.count === 1 ? '' : 's'} updated` : 'Marked reviewed');
          }}
        />
      )}

    </div>
  );
};

export default DocumentsTab;
