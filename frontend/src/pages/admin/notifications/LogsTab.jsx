import React from 'react';
import {
  MessageCircle, FileText, RefreshCw,
  ChevronLeft, ChevronRight,
  Clock, Send, CheckCircle2, Eye, XCircle,
} from 'lucide-react';
import { EVENT_LABELS, CHANNEL_META } from './constants';

const LogsTab = ({ logs, logsTotal, logsPage, logsFilter, setLogsFilter, setLogsPage, fetchLogs }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-gray-50">
      <div>
        <h3 className="font-semibold text-gray-900">Message Logs</h3>
        <p className="text-xs text-gray-400 mt-0.5">{logsTotal} total messages</p>
      </div>
      <div className="flex gap-2">
        <select
          value={logsFilter.channel}
          onChange={e => { const f = { ...logsFilter, channel: e.target.value }; setLogsFilter(f); setLogsPage(1); fetchLogs(1, f); }}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 bg-white outline-none focus:ring-2 focus:ring-[#29828a]/10"
        >
          <option value="">All Channels</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
        <select
          value={logsFilter.status}
          onChange={e => { const f = { ...logsFilter, status: e.target.value }; setLogsFilter(f); setLogsPage(1); fetchLogs(1, f); }}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 bg-white outline-none focus:ring-2 focus:ring-[#29828a]/10"
        >
          <option value="">All Status</option>
          <option value="queued">Queued</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="read">Read</option>
          <option value="failed">Failed</option>
        </select>
        <button
          onClick={() => fetchLogs(logsPage)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            {['Time', 'Channel', 'Recipient', 'Event', 'Status', 'Cost'].map(h => (
              <th key={h} className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {logs.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-14 text-center text-sm text-gray-400">
                <FileText size={28} className="mx-auto mb-2 text-gray-200" />
                No messages have been sent yet.
              </td>
            </tr>
          ) : (
            logs.map(log => {
              const meta = CHANNEL_META[log.channel] || {};
              const Icon = meta.icon || MessageCircle;
              const STATUS_CFG = {
                queued:    { cls: 'bg-gray-100 text-gray-500',    icon: <Clock size={10} />,        label: 'Queued' },
                sent:      { cls: 'bg-blue-50 text-blue-600',     icon: <Send size={10} />,         label: 'Sent' },
                delivered: { cls: 'bg-green-50 text-green-700',   icon: <CheckCircle2 size={10} />, label: 'Delivered' },
                read:      { cls: 'bg-purple-50 text-purple-700', icon: <Eye size={10} />,          label: 'Read' },
                failed:    { cls: 'bg-red-50 text-red-600',       icon: <XCircle size={10} />,      label: 'Failed' },
              };
              const cfg = STATUS_CFG[log.status] || { cls: 'bg-gray-100 text-gray-500', icon: null, label: log.status };
              return (
                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.badge || 'bg-gray-100 text-gray-600'}`}>
                      <Icon size={10} />
                      {meta.label || log.channel}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 font-mono text-xs">{log.recipient}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-500">{EVENT_LABELS[log.event_type] || log.event_type || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}
                      title={log.error_message || undefined}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs font-medium text-gray-600 text-right pr-6">
                    {log.cost > 0 ? `₹${log.cost.toFixed(4)}` : '—'}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>

    {logsTotal > 20 && (
      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Showing {((logsPage - 1) * 20) + 1}–{Math.min(logsPage * 20, logsTotal)} of {logsTotal}
        </p>
        <div className="flex gap-2">
          <button
            disabled={logsPage <= 1}
            onClick={() => { const p = logsPage - 1; setLogsPage(p); fetchLogs(p); }}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-all"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg border border-gray-200">
            {logsPage}
          </span>
          <button
            disabled={logsPage * 20 >= logsTotal}
            onClick={() => { const p = logsPage + 1; setLogsPage(p); fetchLogs(p); }}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-all"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    )}
  </div>
);

export default LogsTab;
