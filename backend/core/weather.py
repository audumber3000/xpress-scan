"""Today's weather for a clinic, for the dashboard's ambient strip.

─── Why weather is on a dental dashboard at all ────────────────────────────

Not as decoration. In monsoon a wet afternoon measurably thins a walk-in list,
and a clinic that can see it coming can call ahead instead of watching four
chairs sit empty. The strip is there to be glanced at, so it says the one thing
the sky is about to do and nothing else.

─── Provider ───────────────────────────────────────────────────────────────

Open-Meteo, chosen because it needs no API key, which means no secret to
provision per environment and nothing to leak. ⚠ Its free tier is licensed for
non-commercial use; a commercial deployment needs their paid plan or a
different provider. WEATHER_API_BASE is an env var precisely so swapping is a
config change, not a code change.

─── Failure is silent, always ──────────────────────────────────────────────

A third party being slow must never be something a doctor experiences. Two
second timeout, every exception swallowed, None on the way out, and the strip
renders without a weather half. The dashboard does not wait on this and does
not report it.
"""
import os
import time
import threading
from typing import Optional

import httpx

API_BASE = os.environ.get("WEATHER_API_BASE", "https://api.open-meteo.com/v1/forecast")

# An hour. The forecast does not move faster than that, and this keeps a clinic
# with ten staff refreshing the dashboard down to one call.
_TTL_SECONDS = 3600
_TIMEOUT_SECONDS = 2.0

# Keyed by coordinates rounded to ~1km, so every clinic in one town shares a
# single upstream call. A dict plus a lock rather than Redis: the payload is
# tiny, losing it on restart costs one request, and this must not become a
# reason the dashboard needs a cache to be up.
_cache: dict = {}
_lock = threading.Lock()

# Distinguishes "not in the cache" from "cached, and the answer was None".
_MISS = object()


# WMO weather codes → the illustration key and the word on screen.
# Grouped, not enumerated: "light drizzle" and "moderate rain" are the same
# decision for a clinic, which is whether people will want to come out.
_CODES = [
    ({0}, "clear", "Clear"),
    ({1}, "clear", "Mostly clear"),
    ({2}, "partly", "Partly cloudy"),
    ({3}, "cloud", "Cloudy"),
    ({45, 48}, "fog", "Fog"),
    ({51, 53, 55, 56, 57}, "rain", "Drizzle"),
    ({61, 63, 66, 80, 81}, "rain", "Rain"),
    ({65, 67, 82}, "rain", "Heavy rain"),
    ({71, 73, 75, 77, 85, 86}, "snow", "Snow"),
    ({95}, "storm", "Thunderstorm"),
    ({96, 99}, "storm", "Thunderstorm"),
]


def describe(code: Optional[int]) -> tuple:
    for codes, icon, label in _CODES:
        if code in codes:
            return icon, label
    # An unmapped code is still weather. Better a neutral cloud than a blank.
    return "cloud", "—"


def _fetch(lat: float, lon: float) -> Optional[dict]:
    params = {
        "latitude": round(lat, 3),
        "longitude": round(lon, 3),
        "daily": "weather_code,temperature_2m_max,temperature_2m_min",
        "timezone": "auto",
        "forecast_days": 1,
    }
    with httpx.Client(timeout=_TIMEOUT_SECONDS) as client:
        res = client.get(API_BASE, params=params)
        res.raise_for_status()
        daily = (res.json() or {}).get("daily") or {}

    codes = daily.get("weather_code") or []
    highs = daily.get("temperature_2m_max") or []
    lows = daily.get("temperature_2m_min") or []
    if not codes or not highs:
        return None

    icon, label = describe(codes[0])
    return {
        "icon": icon,
        "label": label,
        "high": round(float(highs[0])),
        "low": round(float(lows[0])) if lows else None,
    }


def for_clinic(clinic) -> Optional[dict]:
    """Today's weather where the clinic is, or None for any reason at all.

    None covers: no coordinates on file, the provider being down, the provider
    being slow, and a malformed payload. The caller does not distinguish
    between them, because the strip's behaviour is the same in every case.
    """
    lat = getattr(clinic, "latitude", None)
    lon = getattr(clinic, "longitude", None)
    if lat is None or lon is None:
        return None

    key = (round(float(lat), 2), round(float(lon), 2))
    now = time.monotonic()

    with _lock:
        hit = _cache.get(key)
        value = hit["value"] if hit and now - hit["at"] < _TTL_SECONDS else _MISS

    if value is _MISS:
        try:
            value = _fetch(float(lat), float(lon))
        except Exception:
            # Deliberately bare. Nothing upstream is worth a doctor's
            # attention, and a failed forecast is not an error condition for
            # this product.
            value = None
        with _lock:
            _cache[key] = {"at": now, "value": value}

    # The city is attached on the way out, never cached with the forecast. Two
    # clinics in one town share a cache entry under the rounded coordinates,
    # and the first one to ask would otherwise stamp its own name on the
    # second one's strip. (It is also what the doctor calls the place, which is
    # why it comes off the clinic record rather than a reverse-geocode.)
    if value:
        return dict(value, city=getattr(clinic, "city", None) or None)
    return None
