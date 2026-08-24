import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollText, RefreshCw, Download, Loader2, Monitor, Smartphone, Globe,
} from 'lucide-react';
import { notify } from '../../../utils/notify';
import { api } from '../../../utils/api';
import { formatDateTime } from '../../../utils/datetime';
import { downloadAuthedFile } from '../../../utils/whatsapp';
import { resolveUserAvatar } from '../../../utils/avatar';
import TableToolbar from '../../../components/common/TableToolbar';
import Pagination from '../../../components/Pagination';
import EmptyState from '../../../components/common/EmptyState';
import PageShell from '../../../components/common/PageShell';
import { noData } from '../../../assets/illustrations';

const PER_PAGE = 25;

/**
 * Audit Log — the consequential things people did in this clinic.
 *
 * Deliberately read-only: there is no edit and no delete, because a trail
 * somebody can tidy up afterwards isn't evidence of anything. Only actions that
 * destroy or move something are recorded; logging every page view would bury
 * the one row that matters.
 *
 * Rendered as the Audit Log tab of Access & Activity. `embedded` drops the page
 * chrome (scroll container, heading, Refresh) because the host supplies it;
 * `reloadKey` is how that host's Refresh button reaches in here.
 */

// Colour by how much the action can cost you, not by which module it came from.
const TONE = [
  { match: /\.deleted$|\.removed$|deactivated/, cls: 'bg-red-50 text-red-700 border-red-100' },
  { match: /permissions|security|clinic\./,     cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  { match: /discount/,                          cls: 'bg-violet-50 text-violet-700 border-violet-100' },
];
const toneFor = (action) =>
  (TONE.find((t) => t.match.test(action || '')) || { cls: 'bg-gray-100 text-gray-600 border-gray-200' }).cls;

// Rough shape of the machine, from the user agent. Enough to tell "that was
// the front desk PC" from "that was someone's phone".
const deviceOf = (ua = '') => {
  if (/iphone|android.*mobile/i.test(ua)) return { Icon: Smartphone, label: 'Phone' };
  if (/ipad|tablet/i.test(ua)) return { Icon: Smartphone, label: 'Tablet' };
  if (/molarplus|electron|tauri/i.test(ua)) return { Icon: Monitor, label: 'Desktop app' };
  if (/mozilla|chrome|safari|firefox/i.test(ua)) return { Icon: Globe, label: 'Browser' };
  return { Icon: Globe, label: '—' };
};

const AuditLog = ({ embedded = false, reloadKey = 0 }) => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const params = useCallback(() => {
    const p = {};
    if (debounced.trim().length >= 2) p.search = debounced.trim();
    if (action) p.action = action;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [debounced, action, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/security/audit-log', {
        params: { page, per_page: PER_PAGE, ...params() },
      });
      setLogs(data?.logs || []);
      setTotal(Number(data?.total) || 0);
      if (data?.actions?.length) setActions(data.actions);
    } catch (e) {
      notify.problem('Could not load the audit log');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, params]);

  useEffect(() => { load(); }, [load, reloadKey]);
  // Any filter change starts over at page one, or you land on an empty page.
  useEffect(() => { setPage(1); }, [debounced, action, dateFrom, dateTo]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams(params()).toString();
      const span = dateFrom || dateTo ? `_${dateFrom || 'start'}_to_${dateTo || 'today'}` : '';
      await downloadAuthedFile(
        `/security/audit-log/export${qs ? `?${qs}` : ''}`,
        `audit-log${span}.csv`
      );
      notify.done('Audit log exported');
    } catch (e) {
      notify.problem('Could not export the audit log');
    } finally {
      setExporting(false);
    }
  };

  const dateCls = 'px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#29828a]/20 focus:border-[#29828a]';

  return (
    <PageShell embedded={embedded}>
      {!embedded && (
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ScrollText size={20} className="text-[#29828a]" /> Audit Log
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Deletions, money changes and settings changes — who did it, when, and from where.
              </p>
            </div>
            <button
              onClick={load}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      )}

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by staff member or what changed..."
      >
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className={dateCls}
        >
          <option value="">All actions</option>
          {actions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <input type="date" value={dateFrom} max={dateTo || undefined}
               onChange={(e) => setDateFrom(e.target.value)} className={dateCls} title="From date" />
        <input type="date" value={dateTo} min={dateFrom || undefined}
               onChange={(e) => setDateTo(e.target.value)} className={dateCls} title="To date" />
        <button
          onClick={handleExport}
          disabled={exporting || total === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} className="text-[#29828a]" />}
          {exporting ? 'Exporting…' : 'Export'}
        </button>
      </TableToolbar>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] divide-y divide-gray-200">
            <thead className="bg-[#f8fafc]">
              <tr>
                {['When', 'Who', 'Action', 'Details', 'Device & IP'].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-16 text-center">
                  <Loader2 className="animate-spin text-gray-300 mx-auto" size={22} />
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8">
                  <EmptyState
                    image={noData}
                    title={total === 0 && !action && !debounced && !dateFrom ? 'Nothing logged yet' : 'Nothing matches those filters'}
                    subtitle={total === 0 && !action && !debounced && !dateFrom
                      ? 'Deletions and settings changes will appear here as they happen.'
                      : 'Try a wider date range or a different action.'}
                  />
                </td></tr>
              ) : logs.map((l) => {
                const dev = deviceOf(l.user_agent);
                return (
                  <tr key={l.id} className="hover:bg-indigo-50/30 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {l.created_at ? formatDateTime(l.created_at) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={resolveUserAvatar({ name: l.actor_name, id: l.id }, 32)}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover bg-gray-100 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{l.actor_name}</p>
                          {l.actor_role && (
                            <p className="text-xs text-gray-400 capitalize">{l.actor_role.replace(/_/g, ' ')}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${toneFor(l.action)}`}>
                        {l.action_label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-md">{l.summary}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500" title={l.user_agent || ''}>
                        <dev.Icon size={13} className="text-gray-400" /> {dev.label}
                      </div>
                      {l.ip_address && <p className="text-xs text-gray-400 font-mono mt-0.5">{l.ip_address}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PER_PAGE} totalItems={total} onPageChange={setPage} />
      </div>
    </PageShell>
  );
};

export default AuditLog;
