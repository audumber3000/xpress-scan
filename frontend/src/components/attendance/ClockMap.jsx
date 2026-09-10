import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, ShieldCheck, ShieldAlert, Navigation } from 'lucide-react';
import { loadGoogleMaps, mapsApiKey } from '../../utils/googleMaps';

/**
 * Where you are, against where the clinic says it is.
 *
 * The clock modal used to be two lines of text and a button: you pressed it,
 * and either it worked or the server told you that you were too far away. This
 * shows the same fact before you press anything — the clinic's pin, its radius,
 * and your own dot inside or outside it.
 *
 * ─── What this component does NOT do ────────────────────────────────────────
 *
 * It does not decide anything. The chip it draws is a preview of the server's
 * answer, computed from the same two coordinates, and it is deliberately
 * advisory: a page that decided for itself whether it was close enough would be
 * defeated by anyone willing to edit a coordinate in the console, which is most
 * of the point of recording one. The server re-measures on every clock-in and
 * refuses on its own authority.
 *
 * ─── Degrading ──────────────────────────────────────────────────────────────
 *
 * Four things can be missing and none of them may block a shift:
 *   - no Maps API key, or the script is blocked  -> coordinates in text
 *   - the clinic has never set its location      -> "nothing is being checked"
 *   - location permission denied                 -> what to change, and where
 *   - a fix that never arrives                   -> retry, and clock out anyway
 *
 * Somebody standing in the clinic at 8am with a blocked script still has to be
 * able to start their day.
 *
 * Props:
 *   clinic     { name, latitude, longitude, radius_m, isSet }
 *   position   { latitude, longitude, accuracy } | null
 *   permission 'prompt' | 'granted' | 'denied' | 'unsupported'
 *   locating   boolean
 *   error      string
 *   distanceM  number | null   how far the dot is from the pin
 *   onRetry    () => void
 */

const ClockMap = ({
  clinic,
  position,
  permission,
  locating,
  error,
  distanceM,
  onRetry,
}) => {
  const mapEl = useRef(null);
  const map = useRef(null);
  const clinicMarker = useRef(null);
  const radius = useRef(null);
  const meMarker = useRef(null);
  const [mapsState, setMapsState] = useState('loading'); // loading | ready | off

  // Load once, and only when there is actually a pin to draw.
  useEffect(() => {
    let cancelled = false;
    if (!clinic?.isSet || !mapsApiKey()) { setMapsState('off'); return undefined; }
    loadGoogleMaps([])
      .then(() => { if (!cancelled) setMapsState('ready'); })
      .catch(() => { if (!cancelled) setMapsState('off'); });
    return () => { cancelled = true; };
  }, [clinic?.isSet]);

  // Build the map, the pin and the radius ring.
  useEffect(() => {
    if (mapsState !== 'ready' || !mapEl.current || map.current) return;
    const maps = window.google.maps;
    const centre = { lat: Number(clinic.latitude), lng: Number(clinic.longitude) };

    map.current = new maps.Map(mapEl.current, {
      center: centre,
      zoom: 17,
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
    });

    clinicMarker.current = new maps.Marker({
      map: map.current,
      position: centre,
      title: clinic.name || 'Clinic',
    });

    radius.current = new maps.Circle({
      map: map.current,
      center: centre,
      radius: Number(clinic.radius_m) || 150,
      strokeColor: '#29828a',
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: '#29828a',
      fillOpacity: 0.12,
    });
  }, [mapsState, clinic]);

  // Move the "you" dot, and keep both it and the ring in view.
  useEffect(() => {
    if (mapsState !== 'ready' || !map.current || !position) return;
    const maps = window.google.maps;
    const me = { lat: position.latitude, lng: position.longitude };

    if (!meMarker.current) {
      meMarker.current = new maps.Marker({
        map: map.current,
        title: 'You',
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#2a276e',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });
    }
    meMarker.current.setPosition(me);

    // Both things matter, so frame both rather than centring on one.
    const bounds = new maps.LatLngBounds();
    bounds.extend(me);
    if (radius.current?.getBounds()) bounds.union(radius.current.getBounds());
    map.current.fitBounds(bounds, 32);
  }, [mapsState, position]);

  /**
   * The same sum the server does, including the accuracy allowance.
   *
   * Comparing the raw distance against the bare radius made the chip disagree
   * with the server: is_within_clinic_radius widens the circle by whatever
   * error the device reports (capped at 200m), precisely because a desktop or
   * an indoor phone routinely reads +/-60m. Without that here, somebody
   * standing in reception saw "Outside zone" and then clocked in fine — which
   * teaches people to ignore the chip.
   */
  const slack = Math.min(Number(position?.accuracy) || 0, 200);
  const allowed = (Number(clinic?.radius_m) || 150) + slack;
  const inside =
    clinic?.isSet && distanceM != null ? distanceM <= allowed : null;

  return (
    <div>
      {/* The chip, above the map, because it is the answer and the map is the
          evidence. */}
      <div className="flex items-center justify-between gap-2 mb-2">
        {inside === null ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            <MapPin size={13} /> {locating ? 'Finding you…' : 'Location not checked'}
          </span>
        ) : inside ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs font-semibold">
            <ShieldCheck size={13} /> Within zone
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 px-2.5 py-1 text-xs font-semibold">
            <ShieldAlert size={13} /> Outside zone
          </span>
        )}

        {distanceM != null && (
          <span className="text-xs text-gray-500 tabular-nums">
            {distanceM < 1000
              ? `${Math.round(distanceM)} m away`
              : `${(distanceM / 1000).toFixed(1)} km away`}
            {slack >= 25 ? ` \u00b1${Math.round(slack)} m` : ''}
          </span>
        )}
      </div>

      <div className="relative h-40 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
        {mapsState === 'ready' ? (
          <div ref={mapEl} className="absolute inset-0" />
        ) : (
          /* No map is not no information. */
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <MapPin size={20} className="text-gray-300" />
            <p className="mt-2 text-xs font-semibold text-gray-600">
              {clinic?.isSet ? 'Map unavailable' : 'No clinic location set'}
            </p>
            <p className="mt-0.5 text-[11px] text-gray-400 leading-relaxed">
              {clinic?.isSet
                ? 'Your location is still recorded and checked.'
                : 'Nothing is being checked against a location yet.'}
            </p>
          </div>
        )}

        {locating && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center gap-2 text-xs font-semibold text-gray-600">
            <Loader2 size={14} className="animate-spin" /> Finding your location…
          </div>
        )}
      </div>

      {clinic?.isSet && clinic?.name && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
          <MapPin size={11} className="shrink-0" />
          Measured against {clinic.name}
          {clinic.radius_m ? `, ${clinic.radius_m} m radius` : ''}
        </p>
      )}

      {/* Permission and fix problems, with the fix rather than the symptom. */}
      {permission === 'denied' && (
        <p className="mt-2 text-[11px] text-amber-700 leading-relaxed">
          Location is blocked for this site. Allow it from the padlock in the
          address bar, then try again. You can still clock out without it.
        </p>
      )}
      {permission === 'unsupported' && (
        <p className="mt-2 text-[11px] text-amber-700 leading-relaxed">
          This browser cannot share a location. Use the mobile app to clock in.
        </p>
      )}
      {error && permission !== 'denied' && (
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-[11px] text-amber-700 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 shrink-0 text-[11px] font-semibold text-[#29828a] hover:text-[#216b71]"
          >
            <Navigation size={11} /> Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default ClockMap;
