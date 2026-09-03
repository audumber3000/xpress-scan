import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Search, Loader2, Pencil, Check } from 'lucide-react';
import { loadGoogleMaps, mapsApiKey } from '../../utils/googleMaps';

/**
 * The clinic's address, found on a map instead of typed into a box.
 *
 * Signup used to ask for the address as a bare textarea, which is the single
 * slowest field in the wizard: it is long, it is easy to get wrong, and it is
 * the one people stall on. Searching for the clinic by name and confirming a
 * pin is three taps, and it comes back with the city, state and postcode that
 * a typed line never gives us.
 *
 * It reports, it does not persist — the parent owns the value and submits it.
 *
 * Two rules this component will not break:
 *
 *  1. It NEVER blocks signup. No API key, a blocked script, a Maps outage, a
 *     country the search has nothing for: every one of those falls through to
 *     a plain textarea that behaves exactly like the old field. An address
 *     picker that can fail closed would turn a Google outage into a signup
 *     outage, and this screen is the last thing standing between a new clinic
 *     and the product.
 *  2. The typed value always wins. The map fills the box; it never locks it.
 *     Plenty of real clinics sit at an address Google has slightly wrong, and
 *     arguing with the owner about where their own practice is would be a
 *     strange way to begin.
 *
 * Props:
 *   value       the address string (owned by the parent)
 *   country     ISO-2, biases the search
 *   onChange    (address: string) => void
 *   onPlace     (details) => void  city/state/postal_code/latitude/longitude/google_place_id
 *   onManual    () => void         fired once, when they choose to type instead
 *   inputId     for the label's htmlFor
 */

const FIELD =
  'w-full px-4 py-3 border border-gray-300 rounded-lg text-sm transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent';

/** Pull the parts we have columns for out of a Places result. */
const readComponents = (place) => {
  const out = { city: '', state: '', postal_code: '' };
  for (const c of place?.address_components || []) {
    const t = c.types || [];
    // postal_town covers the UK, where `locality` is often absent.
    if (t.includes('locality') || t.includes('postal_town')) out.city = c.long_name;
    else if (t.includes('administrative_area_level_1')) out.state = c.long_name;
    else if (t.includes('postal_code')) out.postal_code = c.long_name;
  }
  return out;
};

const ClinicAddressField = ({
  value,
  country,
  onChange,
  onPlace,
  onManual,
  inputId = 'ob-address',
}) => {
  const searchEl = useRef(null);
  const mapEl = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const autocomplete = useRef(null);

  const [status, setStatus] = useState('loading');  // loading | ready | off
  const [manual, setManual] = useState(false);
  const [pinned, setPinned] = useState(false);

  // Held in refs so the Autocomplete listener, which is attached exactly once,
  // always calls the newest handlers instead of the ones from first render.
  const cbs = useRef({ onChange, onPlace });
  cbs.current = { onChange, onPlace };

  const showMap = status === 'ready' && pinned && !manual;

  const dropPin = useCallback((lat, lng) => {
    if (!map.current) return;
    const pos = { lat, lng };
    map.current.setCenter(pos);
    map.current.setZoom(17);
    marker.current?.setPosition(pos);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!mapsApiKey()) { setStatus('off'); return undefined; }

    loadGoogleMaps(['places'])
      .then((maps) => {
        if (cancelled || !searchEl.current) return;

        autocomplete.current = new maps.places.Autocomplete(searchEl.current, {
          fields: ['formatted_address', 'address_components', 'geometry', 'place_id', 'name'],
          types: ['establishment', 'geocode'],
        });

        autocomplete.current.addListener('place_changed', () => {
          const place = autocomplete.current.getPlace();
          const loc = place?.geometry?.location;
          if (!place?.formatted_address && !loc) return;

          // A clinic found by name gets its name prepended, because
          // "Sharma Dental, MG Road…" is what belongs on an invoice and
          // "MG Road…" alone is what Google hands back.
          const named = place.name && !place.formatted_address?.startsWith(place.name)
            ? `${place.name}, ${place.formatted_address}`
            : place.formatted_address || '';

          cbs.current.onChange?.(named);
          cbs.current.onPlace?.({
            ...readComponents(place),
            google_place_id: place.place_id || '',
            latitude: loc ? loc.lat() : null,
            longitude: loc ? loc.lng() : null,
          });

          setPinned(true);
          // The search box has served its purpose; clear it so it does not sit
          // there looking like a second, disagreeing copy of the address.
          if (searchEl.current) searchEl.current.value = '';
          if (loc) dropPin(loc.lat(), loc.lng());
        });

        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('off'); });

    return () => { cancelled = true; };
    // Once. Country changes are pushed into the live instance below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bias results to the clinic's country as soon as it is known, and again if
  // they change it on the same screen.
  useEffect(() => {
    if (!autocomplete.current || !country) return;
    try {
      autocomplete.current.setComponentRestrictions({ country: String(country).toLowerCase() });
    } catch { /* an unsupported code just means unbiased results, not a failure */ }
  }, [country, status]);

  // The map is built only once something has been pinned, so a signup that
  // never touches the address never pays for a Map instance.
  useEffect(() => {
    if (!showMap || map.current || !mapEl.current || !window.google?.maps) return;
    const maps = window.google.maps;
    map.current = new maps.Map(mapEl.current, {
      center: { lat: 0, lng: 0 },
      zoom: 17,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: 'cooperative',
    });
    marker.current = new maps.Marker({ map: map.current, draggable: true });
    marker.current.addListener('dragend', (e) => {
      cbs.current.onPlace?.({ latitude: e.latLng.lat(), longitude: e.latLng.lng() });
    });
  }, [showMap]);

  const goManual = () => {
    setManual(true);
    onManual?.();
  };

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-gray-700">
        <span className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-gray-400" /> Clinic address *
        </span>
      </label>

      {/* Search. Hidden once they have chosen to type it themselves, and never
          rendered at all when Maps is unavailable. */}
      {status !== 'off' && !manual && (
        <div className="relative mb-2">
          {status === 'loading' ? (
            <Loader2
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 animate-spin text-gray-300"
            />
          ) : (
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          )}
          <input
            ref={searchEl}
            id={inputId}
            type="text"
            disabled={status === 'loading'}
            placeholder={
              status === 'loading' ? 'Loading map…' : 'Search your clinic by name or address'
            }
            className={`${FIELD} pl-10 disabled:bg-gray-50 disabled:text-gray-400`}
            // Enter would otherwise submit the step out from under the
            // autocomplete dropdown before a suggestion can be chosen.
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          />
        </div>
      )}

      {/* The address itself: always editable, always the thing we submit. */}
      <div className="relative">
        <textarea
          id={status === 'off' || manual ? inputId : `${inputId}-text`}
          value={value}
          // `typed` is what tells the parent to drop the pin this text no
          // longer describes. Without it the only difference between "Google
          // resolved this" and "they rewrote it by hand" would be the order
          // two setState calls happen to land in.
          onChange={(e) => onChange?.(e.target.value, { typed: true })}
          rows={2}
          placeholder={
            status === 'off' || manual
              ? 'Suite, building, street, city'
              : 'Pick a result above, or type it here'
          }
          className={`${FIELD} resize-none ${pinned ? 'pr-10' : ''}`}
        />
        {pinned && !manual && (
          <Check
            size={16}
            className="absolute right-3.5 top-3.5 text-green-500 animate-ob-done"
            aria-hidden="true"
          />
        )}
      </div>

      {/* The confirmation. Seeing the pin is what turns "I typed an address"
          into "that is my clinic". */}
      {showMap && (
        <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 animate-ob-rise">
          <div ref={mapEl} className="h-[168px] w-full bg-gray-100" />
        </div>
      )}

      <div className="mt-1.5 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          {status === 'off'
            ? 'Prints at the top of every invoice and prescription.'
            : showMap
            ? 'Drag the pin if it is not exactly right.'
            : 'Prints on invoices and prescriptions. Search saves you typing it out.'}
        </p>
        {status === 'ready' && !manual && (
          <button
            type="button"
            onClick={goManual}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600"
          >
            <Pencil size={11} /> Type it instead
          </button>
        )}
      </div>
    </div>
  );
};

export default ClinicAddressField;
