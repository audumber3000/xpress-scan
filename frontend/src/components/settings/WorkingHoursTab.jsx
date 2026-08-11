import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2, CalendarOff, Info } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../utils/api';

/**
 * When this person actually works, and when they are away.
 *
 * The clinic's opening hours already existed, but they say when the door is
 * open, not who is behind it. Without this the calendar would happily book a
 * dentist onto a day they are not in the building.
 *
 * Two blocks on one weekday express a split shift, a morning list and an
 * evening list with a break between, which is how most practices run.
 */

const DAYS = [
  { i: 0, short: 'Mon', long: 'Monday' },
  { i: 1, short: 'Tue', long: 'Tuesday' },
  { i: 2, short: 'Wed', long: 'Wednesday' },
  { i: 3, short: 'Thu', long: 'Thursday' },
  { i: 4, short: 'Fri', long: 'Friday' },
  { i: 5, short: 'Sat', long: 'Saturday' },
  { i: 6, short: 'Sun', long: 'Sunday' },
];

const timeCls =
  'h-9 px-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#29828a] focus:border-transparent outline-none';

const WorkingHoursTab = ({ doctorId, doctorName }) => {
  const [blocks, setBlocks] = useState([]);
  const [timeOff, setTimeOff] = useState([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newOff, setNewOff] = useState({ start_date: '', end_date: '', reason: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/scheduling/availability/${doctorId}`);
      setBlocks(res.blocks || []);
      setTimeOff(res.time_off || []);
      setConfigured(res.configured);
    } catch {
      setBlocks([]); setTimeOff([]); setConfigured(false);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => { load(); }, [load]);

  const save = async (next) => {
    setSaving(true);
    try {
      const res = await api.put(`/scheduling/availability/${doctorId}`, {
        blocks: next.map(({ weekday, start_time, end_time }) => ({ weekday, start_time, end_time })),
      });
      setBlocks(res.blocks || []);
      setConfigured(res.configured);
      toast.success('Hours saved');
    } catch (e) {
      toast.error(e?.detail || e?.message || 'Could not save those hours');
      load();
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (weekday) => {
    const existing = blocks.filter((b) => b.weekday === weekday);
    // A second block on the same day is a split shift, so it starts after the
    // first one ends rather than on top of it.
    const start = existing.length ? existing[existing.length - 1].end_time : '09:00';
    const startH = Number(start.split(':')[0]);
    save([...blocks, {
      weekday,
      start_time: existing.length ? start : '09:00',
      end_time: `${String(Math.min(23, startH + (existing.length ? 4 : 9))).padStart(2, '0')}:00`,
    }]);
  };

  const updateBlock = (idx, patch) => {
    const next = blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    setBlocks(next);
  };

  const removeBlock = (idx) => save(blocks.filter((_, i) => i !== idx));

  const addTimeOff = async () => {
    if (!newOff.start_date) { toast.error('Pick a first day'); return; }
    try {
      const res = await api.post('/scheduling/time-off', {
        doctor_id: doctorId,
        start_date: newOff.start_date,
        end_date: newOff.end_date || newOff.start_date,
        reason: newOff.reason || null,
      });
      setNewOff({ start_date: '', end_date: '', reason: '' });
      load();
      const hit = res.affected_appointments || [];
      if (hit.length) {
        // Existing bookings are never moved or cancelled automatically. That is
        // the clinic's call, and a silent mass-cancel would be far worse than
        // a list of people to ring.
        toast.warn(
          `${hit.length} appointment${hit.length === 1 ? '' : 's'} already booked in that time. Nothing was cancelled, so ring those patients.`,
          { autoClose: 9000 }
        );
      } else {
        toast.success('Time off saved');
      }
    } catch (e) {
      toast.error(e?.detail || e?.message || 'Could not save that');
    }
  };

  const removeTimeOff = async (id) => {
    try {
      await api.delete(`/scheduling/time-off/${id}`);
      load();
    } catch (e) {
      toast.error(e?.message || 'Could not remove that');
    }
  };

  if (loading) {
    return <div className="py-12 grid place-items-center text-gray-400"><Loader2 size={20} className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-bold text-gray-900">Working hours</h4>
        <p className="text-xs text-gray-500 mt-0.5">
          The calendar shades time {doctorName || 'this person'} is not working, and refuses a booking there.
        </p>
      </div>

      {!configured && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
          <Info size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800">
            No hours set yet, so nothing is being enforced and any time can be booked.
            Add a day below to start.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {DAYS.map((d) => {
          const rows = blocks
            .map((b, i) => ({ ...b, idx: i }))
            .filter((b) => b.weekday === d.i);
          return (
            <div key={d.i} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
              <span className="w-12 pt-2 text-xs font-bold text-gray-700 flex-shrink-0">{d.short}</span>
              <div className="flex-1 min-w-0 space-y-2">
                {rows.length === 0 && (
                  <span className="inline-block pt-2 text-xs text-gray-400">Not working</span>
                )}
                {rows.map((b) => (
                  <div key={b.idx} className="flex items-center gap-2 flex-wrap">
                    <input type="time" step={900} value={b.start_time}
                           onChange={(e) => updateBlock(b.idx, { start_time: e.target.value })}
                           onBlur={() => save(blocks)} className={timeCls} />
                    <span className="text-xs text-gray-400">to</span>
                    <input type="time" step={900} value={b.end_time}
                           onChange={(e) => updateBlock(b.idx, { end_time: e.target.value })}
                           onBlur={() => save(blocks)} className={timeCls} />
                    <button onClick={() => removeBlock(b.idx)} aria-label="Remove this block"
                            className="p-1.5 text-gray-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => addBlock(d.i)}
                disabled={saving}
                title={rows.length ? 'Add a second block for a split shift' : 'Add hours'}
                className="mt-1 inline-flex items-center gap-1 px-2 h-8 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#29828a] hover:text-[#29828a] flex-shrink-0"
              >
                <Plus size={12} /> {rows.length ? 'Split' : 'Add'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="pt-2">
        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <CalendarOff size={14} className="text-gray-500" /> Time off
        </h4>
        <p className="text-xs text-gray-500 mt-0.5 mb-3">
          Leave and days away. This overrides the hours above without changing them.
        </p>

        {timeOff.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {timeOff.map((t) => (
              <div key={t.id} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-xs font-medium text-gray-800 flex-1 min-w-0">
                  {t.start_date}{t.end_date !== t.start_date ? ` to ${t.end_date}` : ''}
                  {t.reason && <span className="text-gray-400 font-normal"> · {t.reason}</span>}
                </span>
                <button onClick={() => removeTimeOff(t.id)} aria-label="Remove"
                        className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">From</label>
            <input type="date" value={newOff.start_date}
                   onChange={(e) => setNewOff((o) => ({ ...o, start_date: e.target.value }))}
                   className={timeCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">To</label>
            <input type="date" value={newOff.end_date} min={newOff.start_date}
                   onChange={(e) => setNewOff((o) => ({ ...o, end_date: e.target.value }))}
                   className={timeCls} />
          </div>
          <div className="flex-1 min-w-[8rem]">
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Reason</label>
            <input value={newOff.reason} placeholder="Optional"
                   onChange={(e) => setNewOff((o) => ({ ...o, reason: e.target.value }))}
                   className={`${timeCls} w-full`} />
          </div>
          <button onClick={addTimeOff}
                  className="h-9 px-4 rounded-lg bg-[#29828a] hover:bg-[#216b71] text-white text-xs font-bold">
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkingHoursTab;
