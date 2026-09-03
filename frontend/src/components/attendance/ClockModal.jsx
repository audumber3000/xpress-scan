import React, { useCallback, useEffect, useState } from 'react';
import { X, MapPin, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import Spinner from '../common/Spinner';
import InlineFeedback from '../common/InlineFeedback';
import { api, getFriendlyErrorMessage } from '../../utils/api';
import { formatDateTime } from '../../utils/datetime';

/**
 * Clocking on and off from the browser.
 *
 * Deliberately the same rules the phone already enforces, because the two write
 * to one attendance record and a staff member who could clock in from home on a
 * laptop would make the geofence on the app pointless:
 *
 *   - clocking IN is refused outside the clinic's radius, by the server
 *   - clocking OUT is always allowed, because somebody who has finished their
 *     shift and walked to the car park still has to close it
 *   - the distance is recorded either way, so an owner reviewing the day can
 *     see how far out a check-in was even when it was allowed
 *
 * The geofence decision is never made here. A page that decided for itself
 * whether it was close enough would be defeated by anyone willing to edit a
 * coordinate in the console, which is most of the point of recording one.
 */
const ClockModal = ({ open, onClose }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // A refusal on distance is not an error to apologise for, it is an answer, so
  // it gets its own state and its own panel rather than a red banner.
  const [refusal, setRefusal] = useState('');
  const [reason, setReason] = useState('');
  const [done, setDone] = useState('');

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setStatus(await api.get('/attendance-mobile/status'));
    } catch (err) {
      setLoadError(getFriendlyErrorMessage(err, "We couldn't check your shift."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(''); setRefusal(''); setDone(''); setReason('');
    fetchStatus();
  }, [open, fetchStatus]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  /** The browser's position, or a sentence explaining why there isn't one. */
  const getFix = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser cannot share a location, so clocking in here is not possible. Use the app instead.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      }),
      (err) => {
        // Told apart because the fix differs: one is a setting to change, the
        // other is usually just standing near a window.
        if (err.code === 1) {
          reject(new Error('Location is blocked for this site. Allow it in your browser settings, then try again.'));
        } else if (err.code === 3) {
          reject(new Error('Finding your location took too long. Try again in a moment.'));
        } else {
          reject(new Error('We could not read your location just now.'));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });

  const act = async (direction) => {
    setBusy(true); setError(''); setRefusal('');
    try {
      const fix = await getFix();
      const body = direction === 'in' && needsReason && reason.trim()
        ? { ...fix, reason: reason.trim() }
        : fix;
      await api.post(`/attendance-mobile/clock-${direction}`, body);
      setDone(direction === 'in' ? "You're clocked in." : "You're clocked out.");
      setReason('');
      await fetchStatus();
    } catch (err) {
      // 403 from this endpoint means one thing only: too far from the clinic.
      if (err?.status === 403) setRefusal(err.detail || err.message);
      else setError(getFriendlyErrorMessage(err, 'That did not go through.'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const clockedIn = !!status?.is_clocked_in;
  const doneForDay = !!status?.is_done_for_today;
  // Only asked when clocking in, and only when the clinic has hours set that
  // today's arrival is actually past. No hours means nothing to be late
  // against, and the benefit of the doubt goes to whoever turned up.
  const needsReason = !clockedIn && !doneForDay && !!status?.late_now;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-bold text-gray-900 leading-tight">Your shift</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatDateTime(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" disabled={busy}
                  className="p-1.5 text-gray-400 hover:text-gray-700 flex-shrink-0 cursor-pointer disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Spinner className="w-4 h-4" /> Checking
            </div>
          )}

          {!loading && loadError && <InlineFeedback>{loadError}</InlineFeedback>}

          {!loading && !loadError && status && (
            <>
              <div className="rounded-xl border border-gray-200 p-3 text-sm">
                {doneForDay && (
                  <p className="text-gray-700">
                    Done for today. In at {formatDateTime(status.clock_in_time, { hour: '2-digit', minute: '2-digit' })},
                    out at {formatDateTime(status.clock_out_time, { hour: '2-digit', minute: '2-digit' })}.
                  </p>
                )}
                {clockedIn && (
                  <p className="text-gray-700">
                    On shift since {formatDateTime(status.clock_in_time, { hour: '2-digit', minute: '2-digit' })}.
                  </p>
                )}
                {!clockedIn && !doneForDay && (
                  <p className="text-gray-700">You have not clocked in yet today.</p>
                )}

                {status.opening_time && !clockedIn && !doneForDay && (
                  <p className="text-xs text-gray-500 mt-1">
                    The clinic opens at {status.opening_time}.
                  </p>
                )}

                {!status.geofence_set && (
                  <p className="text-xs text-amber-700 mt-2 flex items-start gap-1.5">
                    <MapPin size={13} className="mt-0.5 flex-shrink-0" />
                    Your clinic has not set its location yet, so nothing is being
                    checked against it.
                  </p>
                )}
              </div>

              {needsReason && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    You are {status.late_by_minutes} minutes past opening. What happened?
                  </label>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={280}
                    placeholder="Traffic, a delayed train, anything"
                    className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Saved with today's record. You can clock in without it.
                  </p>
                </div>
              )}

              {refusal && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
                  <MapPin size={15} className="mt-0.5 flex-shrink-0" />
                  <span>{refusal}</span>
                </div>
              )}
              {error && <InlineFeedback className="mt-3">{error}</InlineFeedback>}
              {done && (
                <div className="mt-3 flex items-center gap-1.5 text-sm text-emerald-700">
                  <CheckCircle2 size={15} /> {done}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} disabled={busy}
                  className="h-9 px-3.5 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-40">
            Close
          </button>
          {!loading && !loadError && status && !doneForDay && (
            <button
              type="button"
              onClick={() => act(clockedIn ? 'out' : 'in')}
              disabled={busy}
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-semibold border transition-colors ${
                busy
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-transparent bg-[#2a276e] text-white hover:bg-[#1a1548] cursor-pointer'
              }`}
            >
              {busy
                ? <><Spinner className="w-3.5 h-3.5" /> Checking your location</>
                : clockedIn
                  ? <><LogOut size={15} /> Clock out</>
                  : <><LogIn size={15} /> Clock in</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClockModal;
