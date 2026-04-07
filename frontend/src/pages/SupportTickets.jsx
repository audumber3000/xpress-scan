import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { Send, X, ChevronDown, MessageSquare, Plus } from 'lucide-react';

const STATUS_COLORS = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};
const PRIORITY_COLORS = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-blue-100 text-blue-600',
  low: 'bg-gray-100 text-gray-500',
};

const Chip = ({ label, colorMap }) => (
  <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${colorMap[label] || 'bg-gray-100 text-gray-500'}`}>
    {label?.replace('_', ' ')}
  </span>
);

export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [newTicket, setNewTicket] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'setup', priority: 'normal' });
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/support-tickets');
      setTickets(res.tickets || []);
      setTotal(res.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const loadDetail = async (id) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await api.get(`/support-tickets/${id}`);
      setDetail(res);
    } catch (e) { console.error(e); }
    finally { setDetailLoading(false); }
  };

  const handleReply = async () => {
    if (!reply.trim()) return;
    setReplySending(true);
    try {
      await api.post(`/support-tickets/${selectedId}/messages`, { body: reply });
      setReply('');
      loadDetail(selectedId);
    } catch (e) { console.error(e); }
    finally { setReplySending(false); }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/support-tickets', form);
      setNewTicket(false);
      setForm({ title: '', description: '', category: 'setup', priority: 'normal' });
      await loadTickets();
      loadDetail(res.id);
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Support Tickets</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} ticket{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setNewTicket(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#2a276e] hover:bg-[#1f1d52] text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus size={16} /> New Ticket
        </button>
      </div>

      <div className="flex gap-5" style={{ minHeight: '500px' }}>
        {/* Ticket list */}
        <div className="w-80 flex-shrink-0 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-7 h-7 border-3 border-[#2a276e] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <MessageSquare size={28} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500 font-medium">No tickets yet</p>
              <p className="text-xs text-gray-400 mt-1">Click "New Ticket" to get started</p>
            </div>
          ) : (
            tickets.map(t => (
              <button
                key={t.id}
                onClick={() => loadDetail(t.id)}
                className={`w-full text-left bg-white border rounded-2xl shadow-sm p-4 transition-all hover:shadow-md ${
                  selectedId === t.id ? 'border-[#2a276e]/30 ring-2 ring-[#2a276e]/15' : 'border-gray-100'
                }`}
              >
                <div className="text-sm font-semibold text-gray-900 truncate">{t.title}</div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Chip label={t.status} colorMap={STATUS_COLORS} />
                  <Chip label={t.priority} colorMap={PRIORITY_COLORS} />
                  <span className="text-[11px] text-gray-400 capitalize">{t.category}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-gray-400">{t.created_at?.slice(0, 10)}</span>
                  <span className="text-[11px] text-gray-400">{t.message_count} msg{t.message_count !== 1 ? 's' : ''}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Ticket detail / thread */}
        <div className="flex-1 min-w-0">
          {!selectedId && !newTicket ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-full flex items-center justify-center">
              <div className="text-center">
                <MessageSquare size={32} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm text-gray-400">Select a ticket to view</p>
              </div>
            </div>
          ) : newTicket ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-gray-900">New Ticket</h2>
                <button onClick={() => setNewTicket(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subject</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Brief description of your issue"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Category</label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e]">
                      <option value="setup">Setup</option>
                      <option value="billing">Billing</option>
                      <option value="bug">Bug</option>
                      <option value="feature">Feature Request</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Priority</label>
                    <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e]">
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe your issue in detail..."
                    rows={5}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setNewTicket(false)} className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancel</button>
                  <button
                    onClick={handleCreate}
                    disabled={submitting || !form.title.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2a276e] hover:bg-[#1f1d52] rounded-xl disabled:opacity-60"
                  >
                    {submitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</> : <><Send size={14} /> Submit</>}
                  </button>
                </div>
              </div>
            </div>
          ) : detailLoading ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-full flex items-center justify-center">
              <div className="w-7 h-7 border-3 border-[#2a276e] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : detail ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full">
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">{detail.ticket.title}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Chip label={detail.ticket.status} colorMap={STATUS_COLORS} />
                      <Chip label={detail.ticket.priority} colorMap={PRIORITY_COLORS} />
                      <span className="text-xs text-gray-400 capitalize">{detail.ticket.category}</span>
                      <span className="text-xs text-gray-400">#{detail.ticket.id}</span>
                    </div>
                  </div>
                </div>
                {detail.ticket.description && (
                  <p className="text-sm text-gray-600 mt-3 bg-slate-50 rounded-xl p-3">{detail.ticket.description}</p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[360px]">
                {detail.messages.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">No replies yet. Our team will respond soon.</p>
                )}
                {detail.messages.map(m => (
                  <div key={m.id} className={`flex gap-3 ${m.is_staff ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${m.is_staff ? 'bg-[#2a276e]/10 text-[#2a276e]' : 'bg-gray-100 text-gray-600'}`}>
                      {m.is_staff ? 'MP' : (m.sender_name?.[0] || 'U')}
                    </div>
                    <div className={`max-w-[75%] flex flex-col gap-1 ${m.is_staff ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-700">{m.sender_name}</span>
                        <span className="text-[10px] text-gray-400">{m.created_at?.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.is_staff ? 'bg-[#2a276e] text-white rounded-tr-sm' : 'bg-slate-100 text-gray-800 rounded-tl-sm'}`}>
                        {m.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {detail.ticket.status !== 'closed' && (
                <div className="border-t border-gray-100 p-4">
                  <div className="flex gap-3">
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply(); }}
                      placeholder="Add a reply... (Ctrl+Enter to send)"
                      rows={2}
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e]"
                    />
                    <button
                      onClick={handleReply}
                      disabled={replySending || !reply.trim()}
                      className="px-4 py-3 bg-[#2a276e] hover:bg-[#1f1d52] text-white rounded-xl transition-colors disabled:opacity-50"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
