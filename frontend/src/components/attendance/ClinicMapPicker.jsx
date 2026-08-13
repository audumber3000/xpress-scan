import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search, Crosshair } from 'lucide-react';
import { loadGoogleMaps, mapsApiKey } from '../../utils/googleMaps';

/**
 * Drop a pin on the clinic, and see the geofence you are drawing.
 *
 * The circle is the whole point. A radius picked from a list of numbers is an
 * abstraction — 150 m means nothing until you can see whether it reaches the
 * car park. Drawing it on the map turns "how far is far enough" from a guess
 * into a look.
 *
 * Three ways in, because owners arrive from different places: search for the
 * clinic by name or address, tap the map, or drag the pin. All three write the
 * same two numbers, and nothing is saved until the parent's Save is pressed —
 * this component reports, it does not persist.
 *
 * Props:
 *   value    { latitude, longitude } | null
 *   radius   metres, drawn as a circle
 *   onChange ({ latitude, longitude }) => void
 */

// Central Mumbai, only ever used when there is no pin and no address to find.
// Any default is arbitrary; this one at least puts most Indian clinics a short
// scroll away rather than in the middle of an ocean.
const FALLBACK = { lat: 19.0760, lng: 72.8777 };

const ClinicMapPicker = ({ value, radius = 150, onChange }) => {
  const mapEl = useRef(null);
  const searchEl = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const circle = useRef(null);
  const [status, setStatus] = useState('loading');   // loading | ready | error
  const [error, setError] = useState('');

  // Kept in a ref so the map's own listeners always call the newest handler
  // without the map having to be torn down and rebuilt on every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const place = useCallback((lat, lng, panTo = false) => {
    if (!map.current) return;
    const pos = { lat, lng };
    marker.current?.setPosition(pos);
    circle.current?.setCenter(pos);
    if (panTo) map.current.panTo(pos);
    onChangeRef.current?.({ latitude: lat, longitude: lng });
  }, []);

  // Built once. Everything after this is mutation of the existing objects,
  // because re-creating a Map on each render is both slow and billable.
  useEffect(() => {
    let cancelled = false;

    if (!mapsApiKey()) {
      setStatus('error');
      setError('Google Maps is not configured for this site. Enter the coordinates by hand below.');
      return;
    }

    loadGoogleMaps(['places'])
      .then((maps) => {
        if (cancelled || !mapEl.current) return;

        const start = value
          ? { lat: Number(value.latitude), lng: Number(value.longitude) }
          : FALLBACK;

        map.current = new maps.Map(mapEl.current, {
          center: start,
          zoom: value ? 18 : 12,          // tight on a known clinic, wide when guessing
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,          // tapping a restaurant should not move the pin
        });

        marker.current = new maps.Marker({
          map: map.current, position: start, draggable: true,
        });

        circle.current = new maps.Circle({
          map: map.current, center: start, radius,
          strokeColor: '#29828a', strokeOpacity: 0.9, strokeWeight: 2,
          fillColor: '#29828a', fillOpacity: 0.12,
          clickable: false,               // the circle must not swallow map clicks
        });

        marker.current.addListener('dragend', (e) => place(e.latLng.lat(), e.latLng.lng()));
        map.current.addListener('click', (e) => place(e.latLng.lat(), e.latLng.lng()));

        if (searchEl.current) {
          const box = new maps.places.Autocomplete(searchEl.current, {
            fields: ['geometry'],
          });
          box.addListener('place_changed', () => {
            const loc = box.getPlace()?.geometry?.location;
            if (!loc) return;
            map.current.setZoom(18);
            place(loc.lat(), loc.lng(), true);
          });
        }

        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
        setError('Could not load Google Maps. Check your connection, or enter the coordinates by hand below.');
      });

    return () => { cancelled = true; };
    // Deliberately once: the pin and circle are moved by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Radius chips change the drawn circle without rebuilding the map.
  useEffect(() => { circle.current?.setRadius(radius); }, [radius]);

  // The parent can move the pin too (the "use my location" button), so follow it.
  useEffect(() => {
    if (!value || !map.current) return;
    const pos = { lat: Number(value.latitude), lng: Number(value.longitude) };
    marker.current?.setPosition(pos);
    circle.current?.setCenter(pos);
  }, [value?.latitude, value?.longitude]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => { map.current?.setZoom(18); place(p.coords.latitude, p.coords.longitude, true); },
      () => setError('Your browser would not share a location. Search for the clinic instead.'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  if (status === 'error') {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={searchEl}
            placeholder="Search your clinic by name or address"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#29828a]"
          />
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          className="inline-flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 whitespace-nowrap"
        >
          <Crosshair size={15} className="text-gray-400" /> Use my location
        </button>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-gray-200">
        <div ref={mapEl} className="w-full h-[340px] bg-gray-100" />
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <Loader2 size={22} className="animate-spin text-gray-300" />
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Tap the map or drag the pin to move it. The shaded circle is how far a staff member can be
        and still clock in.
      </p>
      {!!error && <p className="text-xs text-amber-700 mt-1">{error}</p>}
    </div>
  );
};

export default ClinicMapPicker;
