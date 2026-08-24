import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Clock, AlertTriangle, Check, Loader2, Search, Repeat } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../../utils/api';
import { track, EVENTS } from '../../../analytics/track';

/**
 * Book an appointment, opened prefilled from a click on the grid.
 *
 * The point of this modal is that the grid click is a starting point, not a
 * decision. Time and duration stay fully editable here, the end time follows
 * whichever of the two you change, and picking a treatment sets the duration
 * from what that treatment actually takes. Typing over it wins.
 *
 * The slot is checked against the server as you edit, so a clash or a day off
 * is caught while the booking is still open rather than after it is written.
 */

const DURATIONS = [15, 30, 45, 60, 90, 120];

const toMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hhmm = (mins) => {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, mins));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
};

const Field = ({ label, children, hint }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
    {children}
    {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
  </div>
);

const inputCls =
  'w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2a276e] focus:border-transparent outline-none';

const BookingModal = ({
  open,
  onClose,
  onSaved,
  initial,          // { date, startTime, endTime, duration, doctorId, chairNumber }
  doctors = [],
  treatments = [],
  chairCount = 1,
}) => {
  const [form, setForm] = useState(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [slot, setSlot] = useState(null);      // { ok, unavailable_reason, conflict }
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [series, setSeries] = useState({ on: false, occurrences: 3, intervalDays: 7 });
  const checkSeq = useRef(0);

  useEffect(() => {
    if (!open || !initial) return;
    setForm({
      // Present only when reopening an existing appointment to change it.
      appointment_id: initial.appointmentId ?? null,
      patient_id: initial.patientId ?? null,
      patient_name: initial.patientName ?? '',
      patient_phone: initial.patientPhone ?? '',
      doctor_id: initial.doctorId ?? '',
      chair_number: initial.chairNumber ?? '',
      treatment: initial.treatment ?? '',
      date: initial.date,
      start_time: initial.startTime,
      duration: initial.duration || 30,
    });
    setPatientQuery(initial.patientName ?? ''); setResults([]); setSlot(null); setError('');
    setSeries({ on: false, occurrences: 3, intervalDays: 7 });
  }, [open, initial]);

  const endTime = useMemo(
    () => (form ? hhmm(toMinutes(form.start_time) + Number(form.duration || 0)) : ''),
    [form]
  );

  // Re-check the slot whenever anything that defines it moves. Sequence-guarded
  // so a slow earlier response cannot overwrite the answer for the slot the
  // user is actually looking at now.
  useEffect(() => {
    if (!open || !form?.date || !form?.start_time || !form?.duration) return;
    const seq = ++checkSeq.current;
    const t = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await api.post('/scheduling/check-slot', {
          doctor_id: form.doctor_id ? Number(form.doctor_id) : null,
          on: form.date,
          start_time: form.start_time,
          end_time: hhmm(toMinutes(form.start_time) + Number(form.duration)),
        });
        if (seq === checkSeq.current) setSlot(res);
      } catch {
        if (seq === checkSeq.current) setSlot(null);
      } finally {
        if (seq === checkSeq.current) setChecking(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, form?.date, form?.start_time, form?.duration, form?.doctor_id]);

  const searchPatients = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      // The endpoint's parameter is `q`. Sending `query` meant it never saw a
      // search term, and with an empty `q` it skips the filter entirely, so the
      // dropdown listed the first 8 patients in the clinic no matter what was
      // typed. It looked like search worked and was simply bad at matching.
      const res = await api.get('/appointments/search-patients', { params: { q } });
      setResults(Array.isArray(res) ? res.slice(0, 6) : (res?.patients || []).slice(0, 6));
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchPatients(patientQuery), 250);
    return () => clearTimeout(t);
  }, [patientQuery, searchPatients]);

  if (!open || !form) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pickTreatment = (name) => {
    const t = treatments.find((x) => x.name === name);
    // A treatment knows how long it takes now. It sets the duration rather than
    // dictating it: the field stays editable and a typed value survives.
    set('treatment', name);
    if (t?.duration_minutes) set('duration', t.duration_minutes);
  };

  const save = async () => {
    setError('');
    if (!form.patient_name.trim()) { setError('Who is this appointment for?'); return; }
    setSaving(true);
    try {
      // A booking with no patient file is a dead end: you cannot start the
      // visit from it, bill it, or see it in their history. 39% of production
      // bookings were in exactly that state. So an unmatched name creates the
      // file here rather than leaving it dangling.
      let patientId = form.patient_id;
      if (!patientId) {
        const phone = (form.patient_phone || '').replace(/[^\d+]/g, '');
        if (phone.length < 10) {
          setError('A phone number is needed to create the patient file');
          setSaving(false);
          return;
        }
        try {
          const created = await api.post('/patients', {
            name: form.patient_name.trim(),
            phone,
          });
          patientId = created?.id || null;
          track(EVENTS.PATIENT_CREATED, { source: 'booking_modal' });
        } catch (e) {
          // Booking still goes ahead without the file rather than losing the
          // slot: a clash for the chair is worse than a patient record we can
          // attach afterwards. The message says which happened.
          console.warn('Could not create the patient file', e);
        }
      }
      // Editing an existing appointment: one PUT, and no patient is created
      // because the booking already has whoever it is for.
      if (form.appointment_id) {
        const res = await api.put(`/appointments/${form.appointment_id}`, {
          patient_id: patientId || null,
          patient_name: form.patient_name,
          patient_phone: form.patient_phone || null,
          doctor_id: form.doctor_id ? Number(form.doctor_id) : null,
          treatment: form.treatment || null,
          chair_number: form.chair_number || null,
          appointment_date: form.date,
          start_time: form.start_time,
          end_time: endTime,
          duration: Number(form.duration),
        });
        onSaved?.({ kind: 'edit', appointment: res });
        onClose();
        return;
      }
      if (series.on) {
        const res = await api.post('/scheduling/series', {
          patient_id: patientId || null,
          patient_name: form.patient_name,
          patient_phone: form.patient_phone || null,
          doctor_id: form.doctor_id ? Number(form.doctor_id) : null,
          treatment: form.treatment || null,
          chair_number: form.chair_number || null,
          start_date: form.date,
          start_time: form.start_time,
          duration: Number(form.duration),
          occurrences: Number(series.occurrences),
          interval_days: Number(series.intervalDays),
        });
        onSaved?.({ kind: 'series', ...res });
      } else {
        const res = await api.post('/appointments', {
          patient_id: patientId || null,
          patient_name: form.patient_name,
          patient_phone: form.patient_phone || null,
          doctor_id: form.doctor_id ? Number(form.doctor_id) : null,
          treatment: form.treatment || null,
          chair_number: form.chair_number || null,
          appointment_date: form.date,
          start_time: form.start_time,
          end_time: endTime,
          duration: Number(form.duration),
        });
        onSaved?.({ kind: 'one', appointment: res, createdPatient: !form.patient_id && !!patientId });
      }
      onClose();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not save that booking'));
    } finally {
      setSaving(false);
    }
  };

  const blocked = slot && slot.ok === false;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      {/* Modals keep their lift; the cards behind them stay border-only. */}
      <div className="relative w-full sm:max-w-lg max-h-[92vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">{form.appointment_id ? 'Edit appointment' : 'New appointment'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(form.date + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <Field label="Patient">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={form.patient_id ? form.patient_name : patientQuery}
                onChange={(e) => {
                  setPatientQuery(e.target.value);
                  setForm((f) => ({ ...f, patient_id: null, patient_name: e.target.value }));
                }}
                placeholder="Search, or type a new name"
                className={`${inputCls} pl-9`}
              />
              {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
            </div>
            {!form.patient_id && results.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setForm((f) => ({ ...f, patient_id: p.id, patient_name: p.name, patient_phone: p.phone || '' }));
                      setResults([]); setPatientQuery('');
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium text-gray-900">{p.name}</span>
                    {p.phone && <span className="text-gray-400 ml-2">{p.phone}</span>}
                  </button>
                ))}
              </div>
            )}
            {!form.patient_id && form.patient_name.trim() && !searching && (
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <p className="text-xs font-semibold text-gray-800">
                  New patient: a file will be created for {form.patient_name.trim()}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5 mb-2">
                  Only a name and phone number are needed now. The rest can be filled in
                  when they arrive.
                </p>
                <input
                  value={form.patient_phone}
                  onChange={(e) => set('patient_phone', e.target.value.replace(/[^\d+]/g, ''))}
                  placeholder="Phone number"
                  inputMode="tel"
                  className={inputCls}
                />
              </div>
            )}
          </Field>

          {/* Date sits with the times because moving an appointment is one
              decision, not two. It used to be read-only text in the header, so
              a patient who rang to come next Tuesday had to be cancelled and
              rebooked. The slot check below re-runs on any of the three. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Date">
              <input type="date" value={form.date}
                     onChange={(e) => e.target.value && set('date', e.target.value)}
                     className={inputCls} />
            </Field>
            <Field label="Starts">
              <input type="time" step={900} value={form.start_time}
                     onChange={(e) => set('start_time', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Ends" hint="Follows the length">
              <input type="time" value={endTime} readOnly
                     className={`${inputCls} bg-gray-50 text-gray-500`} />
            </Field>
            <Field label="Day">
              <div className={`${inputCls} bg-gray-50 text-gray-500 flex items-center text-xs`}>
                {new Date(form.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })}
              </div>
            </Field>
          </div>

          <Field label="How long" hint="15 minutes is just the grid. Any length is fine.">
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => set('duration', d)}
                  className={`px-2.5 h-9 rounded-lg text-xs font-bold border transition-colors ${
                    Number(form.duration) === d
                      ? 'bg-[#2a276e] text-white border-[#2a276e]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Math.floor, not a plain divide: 90 was rendering as
                      "1.5h 30m" because 90/60 kept its fraction. */}
                  {d < 60 ? `${d}m` : `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}m` : ''}`}
                </button>
              ))}
              <input
                type="number" min={5} step={5} value={form.duration}
                onChange={(e) => set('duration', e.target.value)}
                className="w-20 h-9 px-2 border border-gray-200 rounded-lg text-xs text-center"
                aria-label="Minutes"
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Doctor">
              <select value={form.doctor_id} onChange={(e) => set('doctor_id', e.target.value)} className={inputCls}>
                <option value="">Unassigned</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name || d.email}</option>)}
              </select>
            </Field>
            <Field label="Chair">
              {/* A picker, not free text. The live data held "1" seventy-two
                  times alongside "7" and "43", which is the same failure as a
                  free-text lab work type. */}
              <select value={form.chair_number} onChange={(e) => set('chair_number', e.target.value)} className={inputCls}>
                <option value="">Any</option>
                {Array.from({ length: Math.max(1, chairCount) }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>Chair {i + 1}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Treatment" hint="Picking one sets the length from how long it usually takes">
            <select value={form.treatment} onChange={(e) => pickTreatment(e.target.value)} className={inputCls}>
              <option value="">Not specified</option>
              {treatments.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}{t.duration_minutes ? ` (${t.duration_minutes} min)` : ''}
                </option>
              ))}
            </select>
          </Field>

          {/* Series. A root canal is three visits and each used to be booked
              from scratch. Hidden when editing: turning one existing
              appointment into a course is a different action from moving it. */}
          {!form.appointment_id && (
          <div className="border border-gray-200 rounded-lg p-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={series.on}
                     onChange={(e) => setSeries((s) => ({ ...s, on: e.target.checked }))}
                     className="w-4 h-4 accent-[#2a276e]" />
              <Repeat size={14} className="text-gray-500" />
              <span className="text-xs font-semibold text-gray-800">Book a course of visits</span>
            </label>
            {series.on && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="How many visits">
                  <input type="number" min={2} max={24} value={series.occurrences}
                         onChange={(e) => setSeries((s) => ({ ...s, occurrences: e.target.value }))}
                         className={inputCls} />
                </Field>
                <Field label="Days apart">
                  <input type="number" min={1} value={series.intervalDays}
                         onChange={(e) => setSeries((s) => ({ ...s, intervalDays: e.target.value }))}
                         className={inputCls} />
                </Field>
                <p className="col-span-2 text-[11px] text-gray-400">
                  Dates that clash or fall on a day off are skipped and listed, never dropped quietly.
                </p>
              </div>
            )}
          </div>
          )}

          {/* Live slot verdict */}
          <div className={`rounded-lg px-3 py-2.5 text-xs flex items-start gap-2 border ${
            checking ? 'border-gray-200 bg-gray-50 text-gray-500'
              : blocked ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-green-200 bg-green-50 text-green-800'
          }`}>
            {checking ? <Loader2 size={14} className="animate-spin mt-0.5 flex-shrink-0" />
              : blocked ? <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              : <Check size={14} className="mt-0.5 flex-shrink-0" />}
            <span>
              {checking ? 'Checking that slot'
                : blocked
                  ? (slot.unavailable_reason
                     || `Clashes with ${slot.conflict?.patient_name} at ${slot.conflict?.start_time}`)
                  : `${form.start_time} to ${endTime} is free`}
            </span>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 flex-shrink-0">
          <button onClick={onClose} className="px-4 h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:border-gray-300">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || blocked}
            title={blocked ? 'That slot is not free' : undefined}
            className="px-5 h-10 rounded-lg bg-[#2a276e] hover:bg-[#221f5c] text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {form.appointment_id ? 'Save changes' : series.on ? 'Book the course' : 'Book'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingModal;
