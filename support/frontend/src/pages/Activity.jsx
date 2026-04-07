import React, { useEffect, useState, useCallback } from 'react';
import { Activity as ActivityIcon, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import { PageHeader, Card, Badge, Pagination, FilterSelect, Spinner, fmt } from '../components/ui';

export default function ActivityPage() {
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [clinicId, setClinicId] = useState('');
  const [eventType, setEventType] = useState('');
  const [eventTypes, setEventTypes] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, data, types, clinicList] = await Promise.all([
        api.get('/activity/summary'),
        api.get(`/activity/?page=${page}&per_page=100${clinicId ? `&clinic_id=${clinicId}` : ''}${eventType ? `&event_type=${eventType}` : ''}`),
        api.get('/activity/event-types'),
        api.get('/clinics/?page=1&per_page=200'),
      ]);
      setSummary(s);
      setLogs(data.logs);
      setTotal(data.total);
      setEventTypes(types);
      setClinics(clinicList.clinics || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, clinicId, eventType]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <PageHeader
        title="Activity"
        subtitle={`${fmt.num(total)} events across all clinics`}
        actions={
          <button onClick={load} className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />

      {/* Event type chips */}
      {summary?.by_event_type?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.by_event_type.map(e => (
            <button
              key={e.event_type}
              onClick={() => { setEventType(eventType === e.event_type ? '' : e.event_type); setPage(1); }}
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold border transition-all ${
                eventType === e.event_type
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
              }`}
            >
              {e.event_type?.replace(/_/g, ' ')}
              <span className={`px-1 py-px rounded text-[10px] ${eventType === e.event_type ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{e.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterSelect value={clinicId} onChange={v => { setClinicId(v); setPage(1); }}
          options={clinics.map(c => ({ value: String(c.id), label: c.name }))} placeholder="All Clinics" />
        <FilterSelect value={eventType} onChange={v => { setEventType(v); setPage(1); }}
          options={eventTypes.map(t => ({ value: t, label: t?.replace(/_/g, ' ') }))} placeholder="All Event Types" />
      </div>

      {/* Feed */}
      <Card padding={false}>
        {loading ? <Spinner /> : logs.length === 0 ? (
          <div className="py-20 text-center">
            <ActivityIcon size={24} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">No activity found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors">
                <Badge color="slate" className="mt-0.5 flex-shrink-0">{log.event_type?.replace(/_/g, ' ')}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">{log.description}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs font-medium text-brand-600">{log.clinic}</span>
                    {log.actor_name && <><span className="text-slate-300">·</span><span className="text-xs text-slate-400">{log.actor_name}</span></>}
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 flex-shrink-0 pt-0.5">{fmt.ago(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} total={total} perPage={100} onPageChange={setPage} />
      </Card>
    </div>
  );
}
