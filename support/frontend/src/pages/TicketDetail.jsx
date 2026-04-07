import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowLeft, Send, User, Shield } from 'lucide-react';
import api from '../utils/api';
import { Card, Badge, StatusBadge, Spinner, fmt } from '../components/ui';

const STATUS_OPTS = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTS = ['low', 'normal', 'high', 'urgent'];
const PRIORITY_MAP = { urgent: 'rose', high: 'amber', normal: 'sky', low: 'slate' };

const SelectField = ({ label, value, options, onChange, disabled }) => (
  <div>
    <label className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      className="w-full h-8 px-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400 disabled:opacity-50 capitalize">
      {options.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
    </select>
  </div>
);

export default function TicketDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const bottomRef = useRef(null);

  const load = async () => {
    try {
      const res = await api.get(`/tickets/${id}`);
      setData(res);
    } catch { toast.error('Failed to load ticket'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (data) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [data]);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/tickets/${id}/messages`, { body: reply });
      setReply('');
      load();
      toast.success('Reply sent');
    } catch { toast.error('Failed to send reply'); }
    finally { setSending(false); }
  };

  const handleUpdate = async (field, value) => {
    setUpdating(true);
    try {
      await api.patch(`/tickets/${id}`, { [field]: value });
      load();
      toast.success('Updated');
    } catch { toast.error('Update failed'); }
    finally { setUpdating(false); }
  };

  if (loading) return <Spinner />;
  if (!data) return <div className="p-6 text-slate-500">Ticket not found.</div>;

  const { ticket, messages } = data;

  return (
    <div className="p-6 max-w-[960px]">
      <Link to="/tickets" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-600 transition-colors mb-4">
        <ArrowLeft size={14} /> Tickets
      </Link>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Thread */}
        <div className="flex-1 flex flex-col min-h-0">
          <Card padding={false} className="flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-slate-100">
              <h1 className="text-base font-semibold text-slate-900">{ticket.title}</h1>
              <p className="text-xs text-slate-400 mt-0.5">{ticket.clinic_name} · #{ticket.id}</p>
              {ticket.description && (
                <p className="text-sm text-slate-600 mt-2 bg-slate-50 rounded-lg p-3">{ticket.description}</p>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[480px]">
              {messages.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">No messages yet.</p>
              )}
              {messages.map(m => (
                <div key={m.id} className={`flex gap-2.5 ${m.is_staff ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.is_staff ? 'bg-brand-50' : 'bg-slate-100'}`}>
                    {m.is_staff ? <Shield size={12} className="text-brand-600" /> : <User size={12} className="text-slate-500" />}
                  </div>
                  <div className={`max-w-[75%] flex flex-col gap-0.5 ${m.is_staff ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-600">{m.sender_name}</span>
                      <span className="text-[10px] text-slate-400">{fmt.datetime(m.created_at)}</span>
                    </div>
                    <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                      m.is_staff
                        ? 'bg-brand-600 text-white rounded-tr-sm'
                        : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                    }`}>
                      {m.body}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Reply box */}
            {ticket.status !== 'closed' && (
              <div className="border-t border-slate-100 p-3">
                <div className="flex gap-2">
                  <textarea value={reply} onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply(); }}
                    placeholder="Type a reply… (⌘+Enter to send)"
                    rows={3}
                    className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400" />
                  <button onClick={handleReply} disabled={sending || !reply.trim()}
                    className="flex flex-col items-center justify-center gap-0.5 w-14 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-40">
                    <Send size={15} />
                    <span className="text-[9px] font-semibold">Send</span>
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-56 space-y-3">
          <Card>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Ticket Info</h3>
            <div className="space-y-3">
              <SelectField label="Status" value={ticket.status} options={STATUS_OPTS} onChange={v => handleUpdate('status', v)} disabled={updating} />
              <SelectField label="Priority" value={ticket.priority} options={PRIORITY_OPTS} onChange={v => handleUpdate('priority', v)} disabled={updating} />
            </div>

            <div className="mt-4 space-y-1.5 text-xs">
              {[
                ['Clinic', ticket.clinic_name],
                ['Category', ticket.category],
                ['Created by', ticket.creator?.name || '—'],
                ['Created', fmt.date(ticket.created_at)],
                ['Updated', fmt.date(ticket.updated_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-slate-400">{k}</span>
                  <span className="text-slate-700 font-medium text-right truncate max-w-[110px]">{v}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-1.5">
              <StatusBadge status={ticket.status} />
              <Badge color={PRIORITY_MAP[ticket.priority] || 'slate'}>{ticket.priority}</Badge>
            </div>
          </Card>

          <Link to={`/clinics/${ticket.clinic_id}`}
            className="block w-full py-2 text-center text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors">
            View Clinic →
          </Link>
        </div>
      </div>
    </div>
  );
}
