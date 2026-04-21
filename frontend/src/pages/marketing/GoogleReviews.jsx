import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../utils/api';
import { toast } from 'react-toastify';
import {
  Smile, Meh, Frown, Search, MapPin,
  RefreshCw, Link2, Link2Off, Star, TrendingUp, Users, Award
} from 'lucide-react';

// Official Google G Logo SVG
const GoogleIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const StarRating = ({ rating = 0 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} size={14} className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
    ))}
  </div>
);

const SentimentBadge = ({ rating }) => {
  if (rating >= 4) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      <Smile size={12} /> Excellent
    </span>
  );
  if (rating === 3) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
      <Meh size={12} /> Good
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600">
      <Frown size={12} /> Critical
    </span>
  );
};

const fmt = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const boldMatch = (text, matches = []) => {
  if (!text || !matches.length) return text;
  const str = text.toString();
  const parts = [];
  let cursor = 0;
  for (const matchObj of matches) {
    const start = matchObj.startOffset !== undefined ? matchObj.startOffset : matchObj.offset;
    const end = matchObj.endOffset !== undefined ? matchObj.endOffset : (matchObj.offset + matchObj.length);
    if (start === undefined || end === undefined) continue;
    
    if (start > cursor) parts.push(<span key={cursor}>{str.slice(cursor, start)}</span>);
    parts.push(<strong key={start} className="font-bold text-gray-900">{str.slice(start, end)}</strong>);
    cursor = end;
  }
  if (cursor < str.length) parts.push(<span key={cursor}>{str.slice(cursor)}</span>);
  return parts;
};

const GoogleReviews = () => {
  const [state, setState] = useState('LOADING'); // LOADING | NOT_LINKED | LINKED
  const [activeTab, setActiveTab] = useState('reviews'); // reviews | competitors
  const [placeInfo, setPlaceInfo] = useState(null);

  // ── Search & Selected Place ──
  const [query, setQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [linking, setLinking] = useState(false);
  
  // Reviews
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [reviewSearch, setReviewSearch] = useState('');
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Competitors
  const [competitors, setCompetitors] = useState([]);
  const [loadingComp, setLoadingComp] = useState(false);
  const [compScope, setCompScope] = useState('5km'); // '5km' | 'city'
  const [compSyncedAt, setCompSyncedAt] = useState(null);

  // Sync
  const [syncing, setSyncing] = useState(false);

  const initialized = useRef(false);
  const [mapsReady, setMapsReady] = useState(false);
  const inputRef = useRef(null);
  const acRef = useRef(null);

  // ── Load Google Maps JS (classic loader) ──────────────────────────
  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    if (!key) return;

    const loadScript = () => new Promise((resolve, reject) => {
      if (window.google?.maps?.places) { resolve(); return; }
      const existing = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existing) {
        // Script tag is already in the DOM — might already be loaded (load event already fired)
        // so polling is more reliable than attaching a load listener that may never fire.
        let attempts = 0;
        const poll = setInterval(() => {
          if (window.google?.maps?.places) { clearInterval(poll); resolve(); return; }
          if (++attempts > 100) { clearInterval(poll); reject(new Error('Google Maps timeout')); }
        }, 100);
        return;
      }
      const script = document.createElement('script');
      // No loading=async — classic loading guarantees window.google.maps.places is populated on onload
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    loadScript()
      .then(() => setMapsReady(true))
      .catch((e) => console.error('[Places] Failed to load Google Maps:', e));
  }, []);

  // ── Attach classic Autocomplete once input is in DOM ──────────────
  useEffect(() => {
    if (!mapsReady || state !== 'NOT_LINKED' || !inputRef.current || acRef.current) return;

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['establishment'],
      fields: ['place_id', 'name', 'formatted_address'],
    });

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (place && place.place_id) {
        setSelectedPlace({
          place_id: place.place_id,
          name: place.name,
          address: place.formatted_address,
        });
      }
    });

    acRef.current = ac;
    return () => {
      window.google.maps.event.clearInstanceListeners(ac);
      acRef.current = null;
    };
  }, [mapsReady, state]);

  // ── Initial status check ─────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setState('LOADING');
    try {
      const res = await api.get('/google-places/status');
      if (res.linked) {
        setPlaceInfo(res);
        setState('LINKED');
        fetchReviews();
      } else {
        setState('NOT_LINKED');
      }
    } catch {
      setState('NOT_LINKED');
    }
  };

  // ── Link place ────────────────────────────────────────────────────
  const handleLink = async () => {
    if (!selectedPlace) return;
    setLinking(true);
    try {
      const res = await api.post(`/google-places/link?place_id=${encodeURIComponent(selectedPlace.place_id)}`);
      toast.success(`Linked to "${res.place_name}" — ${res.new_reviews} review(s) synced`);
      setPlaceInfo({ ...res, linked: true });
      setState('LINKED');
      setQuery('');
      setSelectedPlace(null);
      fetchReviews();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to link place');
    } finally {
      setLinking(false);
    }
  };

  // ── Unlink ────────────────────────────────────────────────────────
  const handleUnlink = async () => {
    toast.info(
      <div className="flex flex-col gap-2">
        <span className="font-semibold text-sm">Unlink clinic from Google Places?</span>
        <span className="text-xs text-gray-600">Accumulated reviews will be kept.</span>
        <div className="flex gap-2 mt-1">
          <button
            className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 transition"
            onClick={async () => {
              toast.dismiss('unlink-confirm');
              await api.delete('/google-places/unlink');
              setPlaceInfo(null);
              setReviews([]);
              setSummary(null);
              setCompetitors([]);
              setState('NOT_LINKED');
              toast.success('Unlinked successfully');
            }}
          >Yes, Unlink</button>
          <button
            className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded hover:bg-gray-200 transition"
            onClick={() => toast.dismiss('unlink-confirm')}
          >Cancel</button>
        </div>
      </div>,
      { toastId: 'unlink-confirm', autoClose: false, closeOnClick: false }
    );
  };


  // ── Fetch reviews ─────────────────────────────────────────────────
  const fetchReviews = useCallback(async () => {
    setLoadingReviews(true);
    try {
      const res = await api.get('/google-places/reviews?limit=100');
      setReviews(res.reviews || []);
      setSummary(res.summary);
    } catch {
      toast.error('Failed to load reviews');
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  // ── Manual sync ───────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/google-places/sync');
      toast.success(res.new_reviews > 0
        ? `${res.new_reviews} new review(s) discovered!`
        : 'Already up to date');
      const statusRes = await api.get('/google-places/status');
      setPlaceInfo(statusRes);
      fetchReviews();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // ── Competitors ───────────────────────────────────────────────────
  const fetchCompetitors = useCallback(async () => {
    setLoadingComp(true);
    try {
      const res = await api.get(`/google-places/competitors?scope=${compScope}`);
      setCompetitors(res.competitors || []);
      setCompSyncedAt(res.synced_at);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to load competitors');
    } finally {
      setLoadingComp(false);
    }
  }, [compScope]);

  useEffect(() => {
    if (state === 'LINKED' && activeTab === 'competitors') fetchCompetitors();
  }, [activeTab, state, compScope, fetchCompetitors]);

  const filteredReviews = reviews.filter(r => {
    if (!reviewSearch.trim()) return true;
    const term = reviewSearch.toLowerCase();
    return (r.author_name || '').toLowerCase().includes(term) ||
           (r.text || '').toLowerCase().includes(term);
  });

  // ── LOADING ───────────────────────────────────────────────────────
  if (state === 'LOADING') {
    return (
      <div className="p-8 flex items-center justify-center min-h-[40vh]">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw size={18} className="animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // ── NOT LINKED ────────────────────────────────────────────────────
  if (state === 'NOT_LINKED') {
    return (
      <div className="p-6 md:p-8 space-y-6 bg-[#f8fafc] min-h-screen">
        <div className="flex items-center gap-3">
          <h1 className="text-[28px] font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <GoogleIcon className="w-8 h-8" />
            Google Reviews
          </h1>
        </div>

        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-8 max-w-2xl">
          <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
              <Link2 size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Link Your Clinic</h2>
              <p className="text-sm text-gray-500 mt-1">
                Search for your clinic on Google to start tracking reviews. No OAuth required — we use the Places API.
              </p>
            </div>
          </div>

          <div className="mb-6">
            <input
              ref={inputRef}
              type="text"
              placeholder={mapsReady ? "Type clinic name + city..." : "Loading map search..."}
              disabled={!mapsReady}
              onChange={() => { if (selectedPlace) setSelectedPlace(null); }}
              style={{
                width: '100%',
                height: '42px',
                padding: '0 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                backgroundColor: mapsReady ? '#fff' : '#f3f4f6',
                color: '#111827',
              }}
              onFocus={e => { e.target.style.borderColor = '#2a276e'; e.target.style.boxShadow = '0 0 0 3px rgba(42,39,110,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Selected place confirmation chip */}
          {selectedPlace && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-[#2a276e]/5 border border-[#2a276e]/20 rounded-xl">
              <MapPin size={14} className="text-[#2a276e] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#2a276e] truncate">{selectedPlace.name}</div>
                <div className="text-xs text-gray-500 truncate">{selectedPlace.address}</div>
              </div>
              <button
                onClick={() => { setSelectedPlace(null); setQuery(''); }}
                className="text-gray-400 hover:text-gray-600 text-xs shrink-0"
              >✕</button>
            </div>
          )}

          <button
            onClick={handleLink}
            disabled={!selectedPlace || linking}
            className="w-full py-3 text-sm font-bold text-white bg-[#2a276e] hover:bg-[#1f1d52] rounded-xl shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {linking ? <><RefreshCw size={15} className="animate-spin" /> Linking...</> : <><Link2 size={15} /> Link & Start Tracking</>}
          </button>

          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 leading-relaxed">
            <strong>How it works:</strong> After linking, we'll sync up to 5 Google reviews now. Every day our system silently checks for new reviews and saves them to your database — so over time you'll accumulate a growing history that Google's API alone can't give you.
          </div>
        </div>
      </div>
    );
  }

  // ── LINKED ────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 space-y-6 bg-[#f8fafc] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <GoogleIcon className="w-8 h-8" />
            Google Reviews
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <MapPin size={13} className="text-gray-400" />
            <span className="text-sm text-gray-500">{placeInfo?.place_name}</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400 truncate max-w-[280px]">{placeInfo?.place_address}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            Sync Now
          </button>
          <button
            onClick={handleUnlink}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors shadow-sm"
          >
            <Link2Off size={14} />
            Unlink
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-2">
            <Star size={13} className="text-yellow-400 fill-yellow-400" /> Live Rating
          </div>
          <div className="text-3xl font-bold text-gray-900">{placeInfo?.current_rating?.toFixed(1) ?? '—'}</div>
          <div className="text-xs text-gray-400 mt-0.5">{(placeInfo?.total_review_count || 0).toLocaleString()} on Google</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-2">
            <Award size={13} className="text-[#2a276e]" /> Accumulated
          </div>
          <div className="text-3xl font-bold text-gray-900">{placeInfo?.accumulated_count ?? 0}</div>
          <div className="text-xs text-gray-400 mt-0.5">Saved in your DB</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-2">
            <Smile size={13} className="text-green-500" /> Excellent (4-5★)
          </div>
          <div className="text-3xl font-bold text-gray-900">{summary?.excellent_pct ?? 0}%</div>
          <div className="text-xs text-gray-400 mt-0.5">{summary?.excellent ?? 0} reviews</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-2">
            <TrendingUp size={13} className="text-blue-500" /> Last Synced
          </div>
          <div className="text-sm font-semibold text-gray-800 mt-1">
            {placeInfo?.last_synced_at ? fmt(placeInfo.last_synced_at) : 'Never'}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">Auto-syncs daily</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {['reviews', 'competitors'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors capitalize ${
              activeTab === tab ? 'bg-white text-[#2a276e] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'reviews' ? `Reviews (${reviews.length})` : 'Competitors'}
          </button>
        ))}
      </div>

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          
          {/* Latest 5 Reviews Header & Grid */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Star size={18} className="text-yellow-400 fill-yellow-400" />
                  Latest 5 Reviews
                </h2>
                <p className="text-sm text-gray-500 mt-1">The most recent reviews recorded from Google.</p>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={14} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Filter reviews..."
                  value={reviewSearch}
                  onChange={e => setReviewSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] w-full md:w-56 transition-all shadow-inner"
                />
              </div>
            </div>

            {loadingReviews ? (
              <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                <RefreshCw size={22} className="animate-spin mb-3" />
                <p className="text-sm">Loading reviews...</p>
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                  <GoogleIcon className="w-6 h-6 grayscale opacity-40" />
                </div>
                <p className="text-sm font-medium text-gray-500">No reviews accumulated yet</p>
                <button onClick={handleSync} className="text-xs text-[#2a276e] font-semibold mt-2 hover:underline">Sync now</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredReviews.slice(0, 5).map(r => (
                  <div key={r.id} className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <GoogleIcon className="w-10 h-10" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-3 relative z-10">
                        {r.profile_photo_url
                          ? <img src={r.profile_photo_url} alt="" className="w-10 h-10 rounded-full object-cover shadow-sm" />
                          : <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 shadow-sm">{(r.author_name || '?')[0].toUpperCase()}</div>
                        }
                        <div>
                          <div className="text-sm font-bold text-gray-900">{r.author_name || 'Anonymous'}</div>
                          <div className="text-xs text-gray-500">{fmt(r.review_time)}</div>
                        </div>
                      </div>
                      <div className="mb-3 relative z-10">
                        <StarRating rating={r.rating} />
                      </div>
                      <p className="text-sm text-gray-700 italic line-clamp-4 relative z-10 bg-white/50 p-3 rounded-lg border border-white">
                        "{r.text || 'No comment provided.'}"
                      </p>
                    </div>
                    <div className="mt-4 flex justify-between items-end relative z-10">
                       <SentimentBadge rating={r.rating} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Accumulated History Table (if more than 5 exist) */}
          {filteredReviews.length > 5 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-[#2a276e] flex items-center gap-2">
                  <Award size={18} />
                  Complete Accumulated History ({reviews.length} total)
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Older reviews safely archived in your database, bypassing Google's 5-review API limit.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-100">
                      <th className="py-3 px-6 text-[12px] font-semibold text-gray-400 uppercase tracking-wider w-10">#</th>
                      <th className="py-3 px-6 text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="py-3 px-6 text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Reviewer</th>
                      <th className="py-3 px-6 text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Rating</th>
                      <th className="py-3 px-6 text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Review</th>
                      <th className="py-3 px-6 text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Sentiment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredReviews.slice(5).map((r, idx) => (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6 text-sm text-gray-400">{idx + 6}</td>
                        <td className="py-4 px-6 text-sm text-gray-600 whitespace-nowrap">{fmt(r.review_time)}</td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            {r.profile_photo_url
                              ? <img src={r.profile_photo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                              : <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">{(r.author_name || '?')[0].toUpperCase()}</div>
                            }
                            <span className="text-sm font-medium text-gray-900">{r.author_name || 'Anonymous'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6"><StarRating rating={r.rating} /></td>
                        <td className="py-4 px-6 text-sm text-gray-600 max-w-xs">
                          <p className="line-clamp-2">{r.text || <span className="italic text-gray-400">No comment</span>}</p>
                        </td>
                        <td className="py-4 px-6"><SentimentBadge rating={r.rating} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Competitors Tab */}
      {activeTab === 'competitors' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#2a276e]">Local Competitors</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Dental clinics {compScope === '5km' ? 'within 5 km' : 'in your entire city limits'} · sorted by popularity & rating
              </p>
              {compSyncedAt && (
                <div className="flex items-center gap-1.5 mt-2.5 text-[10px] uppercase tracking-wider font-bold text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1 w-fit">
                  <RefreshCw size={10} className="text-blue-500" />
                  Synced {fmt(compSyncedAt)} • Next update in 24h
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex bg-gray-100 p-1 rounded-lg">
                 <button
                   onClick={() => setCompScope('5km')}
                   className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${compScope === '5km' ? 'bg-white text-[#2a276e] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                 >
                   5 km Radius
                 </button>
                 <button
                   onClick={() => setCompScope('city')}
                   className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${compScope === 'city' ? 'bg-white text-[#2a276e] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                 >
                   Entire City
                 </button>
              </div>
              <div className="flex items-center gap-3 bg-[#2a276e]/5 border border-[#2a276e]/10 rounded-lg px-4 py-2">
                <div className="flex items-center gap-1.5 border-r border-[#2a276e]/10 pr-3 mr-1">
                  <Star size={13} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-sm font-semibold text-[#2a276e]">{placeInfo?.current_rating?.toFixed(1) ?? '—'}</span>
                  <span className="text-[10px] text-gray-400 font-medium ml-1">Rating</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#2a276e] text-white flex items-center justify-center text-[10px] font-bold">
                    #{competitors.findIndex(c => c.is_our_clinic) + 1}
                  </div>
                  <span className="text-sm font-semibold text-[#2a276e]">Your Rank</span>
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            {loadingComp ? (
              <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                <RefreshCw size={22} className="animate-spin mb-3" />
                <p className="text-sm">Loading nearby clinics...</p>
              </div>
            ) : competitors.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                <Users size={28} className="mb-3 opacity-30" />
                <p className="text-sm font-medium text-gray-500">No competitors found nearby</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-100">
                    <th className="py-3 px-5 text-[12px] font-semibold text-gray-400 uppercase tracking-wider w-10">#</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Clinic & Vibe</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-gray-400 uppercase tracking-wider w-32">Rating</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Historical</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Velocity</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Target Gap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {competitors.map((c, idx) => {
                    const isOurClinic = c.is_our_clinic;
                    const gap = c.review_gap || 0;
                      
                    return (
                      <tr key={c.place_id} className={`transition-colors ${isOurClinic ? 'bg-[#2a276e]/5 border-l-4 border-l-[#2a276e]' : 'hover:bg-slate-50'}`}>
                        <td className="py-4 px-5 text-sm text-gray-400 font-medium align-top">#{idx + 1}</td>
                        <td className="py-4 px-5 align-top max-w-sm">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                             <div className={`text-sm font-bold ${isOurClinic ? 'text-[#2a276e]' : 'text-gray-900'}`}>{c.name}</div>
                             {isOurClinic && <span className="px-2 py-0.5 bg-[#2a276e] text-white text-[10px] uppercase font-bold rounded-md">Your Clinic</span>}
                          </div>
                          <div className="text-xs text-gray-400 mb-2 truncate" title={c.address}>{c.address}</div>
                          
                          {/* Market Edge Badges */}
                          <div className="flex flex-wrap gap-1.5 mb-2">
                             {c.badges?.map(badge => (
                               <span key={badge} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded border border-gray-200">
                                 {badge}
                               </span>
                             ))}
                          </div>
                          
                          {/* Known For / AI Summary */}
                          {c.summary && (
                            <div className="bg-slate-50 border-l-2 border-slate-200 p-2 rounded-r-md">
                              <p className="text-[11px] text-slate-600 italic line-clamp-2">" {c.summary} "</p>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-5 align-top">
                          <div className="flex items-center gap-1.5">
                            <StarRating rating={Math.round(c.rating || 0)} />
                            <span className="text-sm font-semibold text-gray-700">{c.rating || '—'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-5 align-top">
                          <div className="text-sm text-gray-900 font-medium">{(c.review_count || 0).toLocaleString()}</div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-tight">Total Reviews</div>
                        </td>
                        <td className="py-4 px-5 align-top">
                          {c.velocity > 0 ? (
                            <div className="flex items-center gap-1 text-green-600 text-sm font-bold">
                              <TrendingUp size={14} />
                              <span>+{c.velocity}</span>
                            </div>
                          ) : (
                            <div className="text-gray-400 text-sm">—</div>
                          )}
                          <div className="text-[10px] text-gray-400 uppercase tracking-tight">Last 30 Days</div>
                        </td>
                        <td className="py-4 px-5 align-top">
                          {isOurClinic ? (
                             <span className="text-xs text-gray-400 font-medium">—</span>
                          ) : gap > 0 ? (
                            <div className="bg-amber-50 text-amber-700 border border-amber-100 rounded-lg px-2 py-1.5 inline-block">
                               <div className="text-[10px] uppercase font-bold text-amber-500 mb-0.5">Deficit</div>
                               <div className="text-xs font-black">+{gap} Reviews</div>
                            </div>
                          ) : (
                            <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg px-2 py-1.5 inline-block">
                               <div className="text-xs font-bold whitespace-nowrap">🌟 Market Leader</div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleReviews;
