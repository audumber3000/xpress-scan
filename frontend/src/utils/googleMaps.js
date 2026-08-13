/**
 * Loading the Google Maps JavaScript API once, for whoever asks first.
 *
 * The loader used to live inside GoogleReviews.jsx, which meant any second
 * screen wanting a map had to copy forty lines of script-tag bookkeeping. It is
 * fiddlier than it looks: the tag may already be in the DOM from another screen
 * with its load event long since fired, so attaching a fresh `onload` waits for
 * something that will never happen again. Polling for the global is the only
 * reliable read of "is it ready".
 *
 * The promise is cached, so ten components mounting at once share one download.
 */

let loadPromise = null;

export const mapsApiKey = () => import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

/**
 * @param {string[]} libraries e.g. ['places']
 * @returns {Promise<typeof google.maps>}
 */
export function loadGoogleMaps(libraries = ['places']) {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return; }

    const key = mapsApiKey();
    if (!key) { reject(new Error('Google Maps is not configured')); return; }

    const ready = () => window.google?.maps
      && (!libraries.includes('places') || window.google.maps.places);

    // Somebody else already injected it. Poll rather than listen: if the script
    // finished loading before we got here, its load event is gone for good.
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      let attempts = 0;
      const poll = setInterval(() => {
        if (ready()) { clearInterval(poll); resolve(window.google.maps); return; }
        if (++attempts > 100) { clearInterval(poll); loadPromise = null; reject(new Error('Google Maps timed out')); }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    // Deliberately not `loading=async`: classic loading guarantees the
    // sub-libraries are populated by the time onload fires.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=${libraries.join(',')}`;
    script.async = true;
    script.defer = true;
    script.onload = () => (ready() ? resolve(window.google.maps) : reject(new Error('Google Maps loaded without its libraries')));
    script.onerror = () => { loadPromise = null; reject(new Error('Could not load Google Maps')); };
    document.head.appendChild(script);
  });

  return loadPromise;
}
