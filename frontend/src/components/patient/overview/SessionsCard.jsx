import React, { useCallback, useEffect, useState } from 'react';
import { Layers, Plus, Undo2, Check, Loader2, X } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../../utils/api';
import InlineFeedback from '../../common/InlineFeedback';

/**
 * Courses of treatment sold as a fixed number of sittings.
 *
 * A skin clinic sells "laser hair reduction, 6 sittings" and needs to know how
 * many are left. Nothing else in this product counts sittings, so the clinic
 * was keeping it on paper.
 *
 * ─── Deliberately self-contained ────────────────────────────────────────────
 *
 * This is a temporary accommodation for one clinic that will move to a
 * different platform. So it fetches its own data and owns its own state rather
 * than threading props through PatientProfile → PatientOverviewTab: removing
 * the feature is deleting this file and one line in the overview tab, with no
 * unpicking of a prop chain that half the profile learned to pass along.
 *
 * Renders nothing at all when the clinic has no courses, so a dental practice
 * that will never use this never sees it.
 *
 * ─── Why undo is not optional ───────────────────────────────────────────────
 *
 * The count is advanced by hand, so it will be advanced by mistake. A counter
 * with no way back is one people stop trusting and go back to paper for, which
 * is the problem this exists to solve.
 */
const SessionsCard = ({ patientId }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ label: '', total_sessions: '6' });

  const load = useCallback(async () => {
    if (!patientId) return;
    try {
      const rows = await api.get(`/treatment-sessions/patients/${patientId}`);
      setCourses(Array.isArray(rows) ? rows : []);
    } catch {
      // Silent. A patient file must still open when a temporary side feature
      // cannot load, and there is nothing here the doctor is mid-way through.
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, path) => {
    setBusyId(id);
    setError('');
    try {
      const updated = await api.post(`/treatment-sessions/${id}/${path}`, {});
      setCourses((cs) => cs.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'That did not go through.'));
    } finally {
      setBusyId(null);
    }
  };

  const create = async () => {
    const label = draft.label.trim();
    const total = Number(draft.total_sessions);
    if (!label) { setError('Give the course a name.'); return; }
    if (!Number.isFinite(total) || total < 1) { setError('How many sittings?'); return; }

    setBusyId('new');
    setError('');
    try {
      const created = await api.post('/treatment-sessions', {
        patient_id: patientId, label, total_sessions: total,
      });
      setCourses((cs) => [created, ...cs]);
      setDraft({ label: '', total_sessions: '6' });
      setAdding(false);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not add that course.'));
    } finally {
      setBusyId(null);
    }
  };

  // Nothing to show and nothing being added: stay out of the way entirely.
  if (loading || (!courses.length && !adding)) {
    return loading ? null : (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Layers size={15} className="text-[#29828a]" /> Session courses
          </p>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#29828a] hover:text-[#216b71]"
          >
            <Plus size={13} /> Add a course
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          For treatment sold as a set number of sittings.
        </p>
      </div>
    );
  }

  const field = 'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#29828a]';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Layers size={15} className="text-[#29828a]" /> Session courses
        </p>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#29828a] hover:text-[#216b71]"
          >
            <Plus size={13} /> Add a course
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-3 rounded-lg border border-gray-200 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <input
              autoFocus
              value={draft.label}
              onChange={(e) => { setDraft((d) => ({ ...d, label: e.target.value })); setError(''); }}
              placeholder="Laser hair reduction"
              className={field}
            />
            <input
              value={draft.total_sessions}
              onChange={(e) => { setDraft((d) => ({ ...d, total_sessions: e.target.value })); setError(''); }}
              inputMode="numeric"
              aria-label="Number of sittings"
              className={`${field} sm:w-28`}
              placeholder="6"
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={create}
              disabled={busyId === 'new'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#29828a] hover:bg-[#216b71] disabled:bg-gray-300 text-white text-xs font-semibold"
            >
              {busyId === 'new' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Add
            </button>
            <button
              onClick={() => { setAdding(false); setError(''); }}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700"
            >
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {courses.map((c) => {
          const done = c.used_sessions >= c.total_sessions;
          const pct = c.total_sessions ? (c.used_sessions / c.total_sessions) * 100 : 0;
          return (
            <div key={c.id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.label}</p>
                <p className="text-xs text-gray-500 tabular-nums shrink-0">
                  <span className={done ? 'text-emerald-600 font-semibold' : 'text-[#29828a] font-semibold'}>
                    {c.used_sessions}
                  </span>
                  {' of '}{c.total_sessions} used
                </p>
              </div>

              <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-[#29828a]'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>

              <div className="flex items-center gap-2 mt-2.5">
                <button
                  onClick={() => act(c.id, 'use')}
                  disabled={busyId === c.id || done}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#29828a] hover:bg-[#216b71] disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold transition-colors"
                >
                  {busyId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {done ? 'All used' : 'Use one'}
                </button>
                {c.used_sessions > 0 && (
                  <button
                    onClick={() => act(c.id, 'undo')}
                    disabled={busyId === c.id}
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-40"
                    title="Take back the last sitting"
                  >
                    <Undo2 size={13} /> Undo
                  </button>
                )}
                <span className="ml-auto text-xs text-gray-400 tabular-nums">
                  {Math.max(c.total_sessions - c.used_sessions, 0)} left
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {error && <InlineFeedback tone="error" className="mt-3">{error}</InlineFeedback>}
    </div>
  );
};

export default SessionsCard;
