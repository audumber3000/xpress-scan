import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, MapPin, LogIn, LogOut, CheckCircle2, Clock, Users, UserPlus, CalendarCheck } from 'lucide-react';
import Spinner from '../common/Spinner';
import InlineFeedback from '../common/InlineFeedback';
import ClockMap from './ClockMap';
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
 * The geofence decision is never made here. The map and the "within zone" chip
 * are a preview of the server's answer, not the answer — see ClockMap.
 *
 * ─── Why it grew a map ──────────────────────────────────────────────────────
 *
 * It was two lines of text and a button. You pressed it and found out. When the
 * answer was "too far away" there was nothing on screen to argue with: no sense
 * of how far, in which direction, or whether the clinic's own pin was wrong.
 * The location is now read as soon as the modal opens, so the state is visible
 * before the decision instead of after it.
 *
 * ─── And a summary ──────────────────────────────────────────────────────────
 *
 * Clocking out reported nothing back. The hours are computed from the two
 * timestamps (never stored — correcting a time has to correct the total), and
 * the day's counts come from real records. There is deliberately no "breaks"
 * figure however much the design asks for one: nothing in this system records a
 * break, so the number would be invented.
 */

/** Distance in metres between two coordinates. Haversine, same as the server. */
const distanceBetween = (aLat, aLng, bLat, bLng) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

/** A good fix if one is quick, a coarse one if not. See getFix for why. */
const FINE = { enableHighAccuracy: true, timeout: 7000, maximumAge: 15000 };
const COARSE = { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 };

const readPosition = (opts) => new Promise((resolve, reject) => {
  navigator.geolocation.getCurrentPosition(resolve, reject, opts);
});

const hhmm = (iso) => formatDateTime(iso, { hour: '2-digit', minute: '2-digit' });

/** Worked time from the two stamps, as "8h 15m". */
const workedSince = (startIso, endIso) => {
  if (!startIso) return null;
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date();
  const mins = Math.max(0, Math.round((end - start) / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
};

/** The icon arrives as children rather than a component prop: eslint's
 *  jsx-uses-vars does not track a renamed destructured prop here, and a new
 *  file should not ship a lint error to explain in a comment. */
const Stat = ({ label, value, children }) => (
  <div className="min-w-0">
    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
      {children} {label}
    </p>
    <p className="mt-0.5 text-xl font-bold text-[#29828a] tabular-nums leading-none">{value}</p>
  </div>
);

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
  const [note, setNote] = useState('');
  const [done, setDone] = useState('');

  const [position, setPosition] = useState(null);
  const [permission, setPermission] = useState('prompt');
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  // Ticks once a minute so "on shift for 3h 12m" stays true while the modal is
  // open, without re-rendering sixty times a minute for a figure in whole
  // minutes.
  const [, setTick] = useState(0);
  const watchId = useRef(null);
  // The freshest position the watcher has seen, as a last resort for getFix.
  const lastFix = useRef(null);

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

  /**
   * A position, or a sentence explaining why there isn't one.
   *
   * ─── Why this is a cascade and not one call ─────────────────────────────
   *
   * It was a single getCurrentPosition with `enableHighAccuracy: true` and
   * `maximumAge: 0`, and it timed out constantly on desktop. Both options were
   * wrong for the machine most staff use this on:
   *
   *   - a laptop has no GPS. High accuracy asks for one anyway, which on macOS
   *     means a slow WiFi-triangulation scan for a fix no better than the
   *     coarse one.
   *   - maximumAge 0 forbids the browser from answering with the fix it is
   *     already holding, so every open paid the full cost again.
   *
   * So: ask for a good fix briefly, fall back to a coarse one with room to
   * breathe, and finally accept the last position the watcher saw. Coarse is
   * genuinely good enough — the server widens the geofence by the accuracy the
   * device reports (capped at 200m), so a ±60m desktop fix is judged against
   * radius+60, not against the bare radius.
   */
  const getFix = useCallback(async () => {
    if (!navigator.geolocation) {
      setPermission('unsupported');
      throw new Error('This browser cannot share a location, so clocking in here is not possible. Use the app instead.');
    }

    const shape = (pos) => ({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
    });
    const denied = () => {
      setPermission('denied');
      return new Error('Location is blocked for this site. Allow it from the padlock in the address bar, then try again.');
    };

    try {
      const pos = await readPosition(FINE);
      setPermission('granted');
      return shape(pos);
    } catch (err) {
      if (err.code === 1) throw denied();
      // Timed out or unavailable at high accuracy. On a desktop that is the
      // normal outcome, not an exception.
      try {
        const pos = await readPosition(COARSE);
        setPermission('granted');
        return shape(pos);
      } catch (err2) {
        if (err2.code === 1) throw denied();
        // The watcher may already be holding something perfectly usable.
        if (lastFix.current && Date.now() - lastFix.current.at < 120000) {
          setPermission('granted');
          return lastFix.current.coords;
        }
        throw new Error(
          "Your device would not give up a location. On a Mac, check System Settings \u203a Privacy & Security \u203a Location Services is on for your browser, then try again."
        );
      }
    }
  }, []);

  /** Read the position for display. Never throws — the buttons handle failure. */
  const locate = useCallback(async () => {
    setLocating(true);
    setGeoError('');
    try {
      const fix = await getFix();
      lastFix.current = { coords: fix, at: Date.now() };
      setPosition(fix);
    } catch (err) {
      setGeoError(err.message);
    } finally {
      setLocating(false);
    }
  }, [getFix]);

  useEffect(() => {
    if (!open) return;
    setError(''); setRefusal(''); setDone(''); setReason(''); setNote('');
    setPosition(null); setGeoError('');
    fetchStatus();
  }, [open, fetchStatus]);

  /**
   * One geolocation source, not two.
   *
   * A getCurrentPosition on open used to run alongside this watcher, and the
   * two contended for the same provider — which is the other half of why the
   * one-shot kept timing out. The watcher fires immediately with any cached
   * fix, then keeps up as they walk, so it covers both jobs: the first paint
   * and the last twenty metres to the door.
   */
  useEffect(() => {
    if (!open) return undefined;
    if (!navigator.geolocation) { setPermission('unsupported'); return undefined; }

    setLocating(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        };
        lastFix.current = { coords: fix, at: Date.now() };
        setPermission('granted');
        setGeoError('');
        setLocating(false);
        setPosition(fix);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setPermission('denied');
          setGeoError('');
        } else {
          setGeoError('We could not read your location just now. Clocking in will try again.');
        }
      },
      // Coarse on purpose: this feeds the dot on the map, and the server allows
      // for the accuracy anyway. High accuracy here is a slow scan for a
      // precision no desktop can deliver.
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 25000 },
    );
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setLocating(false);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  const act = async (direction) => {
    setBusy(true); setError(''); setRefusal('');
    try {
      // Re-read rather than reuse the watched position: a stale fix is exactly
      // the thing a geofence must not be decided on.
      const fix = await getFix();
      setPosition(fix);
      const body = { ...fix };
      if (direction === 'in' && needsReason && reason.trim()) body.reason = reason.trim();
      if (direction === 'out' && note.trim()) body.notes = note.trim();
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

  const clinic = status && {
    name: status.clinic_name,
    latitude: status.clinic_latitude,
    longitude: status.clinic_longitude,
    radius_m: status.geofence_radius_m,
    isSet: !!status.geofence_set && status.clinic_latitude != null,
  };

  const distanceM =
    clinic?.isSet && position
      ? distanceBetween(position.latitude, position.longitude, clinic.latitude, clinic.longitude)
      : null;

  const today = status?.today || {};
  const worked = workedSince(status?.clock_in_time, status?.clock_out_time);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6 overflow-y-auto">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden my-auto">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-bold text-gray-900 leading-tight">
              {doneForDay ? 'Shift finished' : clockedIn ? 'End your shift' : 'Start your shift'}
            </h2>
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
              {/* Where you are. Hidden once the day is closed — there is
                  nothing left to measure. */}
              {!doneForDay && (
                <ClockMap
                  clinic={clinic}
                  position={position}
                  permission={permission}
                  locating={locating && !position}
                  error={geoError}
                  distanceM={distanceM}
                  onRetry={locate}
                />
              )}

              {/* The shift itself. */}
              <div className={`rounded-xl border border-gray-200 p-3.5 ${doneForDay ? '' : 'mt-4'}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {doneForDay ? 'Today' : clockedIn ? 'Current shift' : 'Not started'}
                  </p>
                  {status.clock_in_time && (
                    <p className="text-xs text-gray-500">
                      {doneForDay
                        ? `${hhmm(status.clock_in_time)} – ${hhmm(status.clock_out_time)}`
                        : `Started ${hhmm(status.clock_in_time)}`}
                    </p>
                  )}
                </div>

                {(clockedIn || doneForDay) ? (
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <Stat label="Worked" value={worked || '—'}><Clock size={11} /></Stat>
                    {/* Whichever of these the person's day actually produced.
                        A dentist is measured on who they treated, a
                        receptionist on who they booked in; showing both to
                        everyone would tell half the staff their shift was
                        empty. */}
                    {today.patients_seen > 0 && (
                      <Stat label="Seen" value={today.patients_seen}><Users size={11} /></Stat>
                    )}
                    {today.patients_registered > 0 && (
                      <Stat label="Registered" value={today.patients_registered}><UserPlus size={11} /></Stat>
                    )}
                    {today.appointments > 0
                      && !(today.patients_seen > 0 && today.patients_registered > 0) && (
                      <Stat label="Appointments" value={today.appointments}><CalendarCheck size={11} /></Stat>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">
                    You have not clocked in yet today.
                    {status.opening_time ? ` The clinic opens at ${status.opening_time}.` : ''}
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

              {clockedIn && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Anything to note about the shift?{' '}
                    <span className="font-normal text-gray-400">Optional</span>
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="Handover, something that needs picking up tomorrow…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                  />
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
              className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold border transition-colors ${
                busy
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-transparent bg-[#29828a] text-white hover:bg-[#216b71] cursor-pointer'
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
