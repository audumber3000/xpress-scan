import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download, Loader2, RefreshCw, ShieldAlert, Database, HardDriveDownload,
} from 'lucide-react';
import { api } from '../../../utils/api';
import { notify } from '../../../utils/notify';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateTime } from '../../../utils/datetime';
import SectionHeader from '../../../components/common/SectionHeader';

/**
 * Control Center → Security → Backup & Data.
 *
 * A clinic's records are the clinic's, and until now the only way to get at
 * them was one screen at a time: a patient CSV here, a collections CSV there,
 * and nothing that adds up to a copy of the practice. This is that copy — every
 * row the clinic owns, one CSV per table, in a single zip.
 *
 * It sits under Security because that is the question it answers. "What happens
 * to my data if something happens to you" is the same worry as "who can get in
 * and what did they do", and a clinic that has never thought about it is one
 * bad afternoon from having no records at all.
 */

// Where the browser remembers the last download. Per clinic, and deliberately
// per DEVICE: the server knows when a backup was taken (it is in the audit log)
// but not whether the file still exists on this laptop, and that is the thing
// the person standing here is actually asking about.
const LAST_KEY = (clinicId) => `molarplus:last-backup:${clinicId || 'unknown'}`;

const GROUP_ORDER = ['Clinical', 'Money', 'Practice'];

const readLast = (clinicId) => {
  try { return localStorage.getItem(LAST_KEY(clinicId)) || ''; } catch { return ''; }
};

const Backup = () => {
  const { user } = useAuth();
  const clinicId = user?.clinic?.id || user?.clinic_id;

  const [datasets, setDatasets] = useState([]);
  const [chosen, setChosen] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [lastAt, setLastAt] = useState(() => readLast(clinicId));

  useEffect(() => { setLastAt(readLast(clinicId)); }, [clinicId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/backup/datasets');
      const list = Array.isArray(data?.datasets) ? data.datasets : [];
      setDatasets(list);
      // Everything ticked. A backup missing the half somebody forgot to tick is
      // worse than no backup, because they believe they have one.
      setChosen(Object.fromEntries(list.map((d) => [d.key, true])));
      setLoadError('');
    } catch (err) {
      setLoadError(err?.message || 'Could not read what is on file.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const byGroup = new Map();
    datasets.forEach((d) => {
      const g = d.group || 'Other';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(d);
    });
    return [...byGroup.entries()].sort(
      (a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0])
    );
  }, [datasets]);

  const chosenKeys = datasets.filter((d) => chosen[d.key]).map((d) => d.key);
  const chosenRows = datasets
    .filter((d) => chosen[d.key])
    .reduce((n, d) => n + (d.rows || 0), 0);
  const allOn = datasets.length > 0 && chosenKeys.length === datasets.length;

  const toggle = (key) => setChosen((prev) => ({ ...prev, [key]: !prev[key] }));
  const setAll = (on) =>
    setChosen(Object.fromEntries(datasets.map((d) => [d.key, on])));

  const download = async () => {
    if (!chosenKeys.length) return;
    setDownloading(true);
    try {
      // Straight fetch rather than the api helper: this comes back as a zip,
      // and the helper parses JSON.
      const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(
        `${baseURL}/api/v1/backup/export?datasets=${encodeURIComponent(chosenKeys.join(','))}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } },
      );
      if (!res.ok) throw new Error(res.status === 403
        ? 'Only the clinic owner can download a backup.'
        : 'The backup could not be prepared.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (res.headers.get('content-disposition') || '').match(/filename="?([^"]+)"?/)?.[1]
        || 'molarplus-backup.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const now = new Date().toISOString();
      try { localStorage.setItem(LAST_KEY(clinicId), now); } catch { /* private window */ }
      setLastAt(now);
      notify.done('Backup downloaded');
    } catch (err) {
      notify.problem(err, 'Could not download the backup');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto custom-scrollbar bg-[#f8fafc] p-6 pb-10 lg:p-8">
      <SectionHeader
        title="Backup & Data"
        subtitle="Download a complete copy of your clinic's records, as spreadsheets you can open anywhere."
        action={
          <button
            onClick={load}
            disabled={loading}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {/* The download, stated before the list of what is in it. Somebody who
          came here to take a backup should not have to read twenty rows first. */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-[14rem] flex-1 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#29828a]/10 text-[#29828a]">
              <HardDriveDownload size={19} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">Download a backup</p>
              <p className="mt-0.5 text-xs leading-snug text-gray-500">
                One zip file, one spreadsheet per kind of record. Keep it somewhere
                that is not this computer.
              </p>
              <p className="mt-1.5 text-xs text-gray-400">
                {lastAt
                  ? `Last downloaded on this device: ${formatDateTime(lastAt)}`
                  : 'No backup has been downloaded on this device yet.'}
              </p>
            </div>
          </div>
          <button
            onClick={download}
            disabled={downloading || loading || !chosenKeys.length}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-[#29828a] px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[#236d75] active:scale-[0.97] disabled:opacity-50"
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {downloading ? 'Preparing…' : 'Download backup'}
          </button>
        </div>
      </div>

      {/* What is in it, and how much of it. Counted rather than promised — the
          point of showing 4,182 patients is that somebody can believe the file. */}
      <div className="mt-5 rounded-2xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-gray-400" />
            <span className="text-sm font-bold text-gray-900">What goes in</span>
            {!loading && (
              <span className="text-xs text-gray-400">
                {chosenKeys.length} of {datasets.length} · {chosenRows.toLocaleString('en-IN')} rows
              </span>
            )}
          </div>
          {!loading && datasets.length > 0 && (
            <button
              onClick={() => setAll(!allOn)}
              className="text-xs font-semibold text-[#29828a] hover:underline"
            >
              {allOn ? 'Clear all' : 'Select all'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-14 text-sm text-gray-500">
            <Loader2 size={18} className="animate-spin text-[#29828a]" /> Reading your records…
          </div>
        ) : loadError ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-600">{loadError}</p>
            <button onClick={load} className="mt-2 text-xs font-semibold text-[#29828a] hover:underline">
              Try again
            </button>
          </div>
        ) : (
          grouped.map(([group, rows]) => (
            <div key={group} className="border-b border-gray-100 last:border-b-0">
              <p className="px-5 pt-4 text-[11px] font-black uppercase tracking-wider text-gray-400">
                {group}
              </p>
              <div className="px-3 pb-3 pt-1">
                {rows.map((d) => (
                  <label
                    key={d.key}
                    className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={!!chosen[d.key]}
                      onChange={() => toggle(d.key)}
                      className="mt-1 cursor-pointer rounded border-gray-300 text-[#29828a] focus:ring-[#29828a]/30"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold text-gray-900">{d.label}</span>
                        <span className="text-xs text-gray-400">
                          {d.rows === null || d.rows === undefined
                            ? 'count unavailable'
                            : `${d.rows.toLocaleString('en-IN')} row${d.rows === 1 ? '' : 's'}`}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-gray-500">
                        {d.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Said plainly, because the gap between "I have a backup" and "I have my
          x-rays" is where a clinic finds out the hard way. */}
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="min-w-0 text-xs leading-relaxed text-amber-900">
          <p className="font-bold">What this file does not contain</p>
          <p className="mt-1">
            Uploaded files themselves — x-rays, scans and signed PDFs — are not in
            the zip. Their details are listed, so you can see what exists, but each
            file is downloaded from the patient's own record.
          </p>
          <p className="mt-1.5">
            Sign-in details are left out on purpose. Nobody can use this file to get
            into your account, which also means it cannot restore one.
          </p>
          <p className="mt-1.5">
            Everything in it is patient information. Treat the file the way you would
            treat the paper records it replaces.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Backup;
