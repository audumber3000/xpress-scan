import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import TeamTabs from '../components/team/TeamTabs';
import ClinicMapPicker from '../components/attendance/ClinicMapPicker';
import InlineFeedback from '../components/common/InlineFeedback';
import { api } from '../utils/api';
import { notify } from '../utils/notify';
import { useAuth } from '../contexts/AuthContext';

/**
 * Team → Location. Where the clinic is, and how far from it still counts as
 * being at work.
 *
 * Its own tab rather than a card stacked on top of the attendance grid: this is
 * a map and a decision, set once and rarely revisited, while the grid is a
 * thing you read every week. Putting them on one screen made the week you came
 * to look at start 400px down the page.
 *
 * Until the pin is set, the backend lets every clock-in through from anywhere.
 * That is stated on the page rather than implied, because a geofence people
 * believe in but which is not running is worse than no geofence at all.
 */

// 10m is the tightest that behaves: phones rarely resolve better, but the
// server adds the device's own error estimate on top, so a 10m fence with a
// good fix acts like ~18m. Past a few hundred metres this stops being a
// geofence and becomes a postcode.
const RADII = [10, 50, 100, 150, 300, 500];

const ClinicLocation = () => {
  const { user } = useAuth();
  const [fence, setFence] = useState(null);
  const [pin, setPin] = useState(null);          // { latitude, longitude }, unsaved
  const [radius, setRadius] = useState(150);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isOwner = user?.role === 'clinic_owner';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const g = await api.get('/attendance-mobile/geofence');
      setFence(g);
      setRadius(g.radius_m || 150);
      if (g.is_set) setPin({ latitude: g.latitude, longitude: g.longitude });
    } catch (e) {
      setError('Could not load the clinic location.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!pin) { setError('Drop a pin on your clinic first.'); return; }
    setSaving(true);
    setError('');
    try {
      const g = await api.put('/attendance-mobile/geofence', {
        latitude: pin.latitude, longitude: pin.longitude, radius_m: radius,
      });
      setFence(g);
      notify.done('Clinic location saved');
    } catch (e) {
      setError(e?.detail || 'Could not save the clinic location.');
    } finally {
      setSaving(false);
    }
  };

  const isSet = !!fence?.is_set;
  // Something to save if the pin moved, the radius changed, or there was
  // never a pin to begin with.
  const dirty = !!pin && (
    !isSet
    || Number(pin.latitude) !== Number(fence.latitude)
    || Number(pin.longitude) !== Number(fence.longitude)
    || radius !== fence.radius_m
  );

  return (
    <TeamTabs active="location">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-gray-300" size={24} />
        </div>
      ) : (
        <div className="max-w-3xl">
          {/* Where it stands */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`p-2.5 rounded-lg ${isSet ? 'bg-emerald-50 text-emerald-600' : 'bg-[#29828a]/10 text-[#29828a]'}`}>
                  <MapPin size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {isSet ? 'Clinic location is set' : 'Clinic location is not set'}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {isSet
                      ? `Staff must be within ${fence.radius_m} m of this spot to clock in from the app.`
                      : 'Staff can currently clock in from anywhere.'}
                  </p>
                  {isSet && (
                    <p className="text-xs text-gray-400 mt-1 font-mono">
                      {Number(fence.latitude).toFixed(5)}, {Number(fence.longitude).toFixed(5)}
                    </p>
                  )}
                </div>
              </div>
              <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                isSet ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                {isSet ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {isSet ? 'On' : 'Off'}
              </span>
            </div>
          </div>

          {!isOwner ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <p className="text-sm text-gray-500">
                Only the clinic owner can change where the clinic is.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-1">Put the pin on your clinic</p>
              <p className="text-sm text-gray-500 mb-4">
                Search for it, tap the map, or drag the pin. The circle shows how far a staff member
                can be and still clock in.
              </p>

              <ClinicMapPicker value={pin} radius={radius} onChange={setPin} />

              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-5 mb-2">
                How far from the clinic still counts
              </p>
              <div className="flex flex-wrap gap-2">
                {RADII.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadius(r)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                      radius === r
                        ? 'bg-[#29828a] text-white border-[#29828a]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  >
                    {r} m
                  </button>
                ))}
              </div>

              {error && <InlineFeedback tone="error" className="mt-4">{error}</InlineFeedback>}

              <div className="flex items-center gap-3 mt-5">
                <button
                  onClick={save}
                  disabled={saving || !dirty}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#29828a] hover:bg-[#216b71] disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  {saving ? 'Saving…' : isSet ? 'Update location' : 'Save location'}
                </button>
                {dirty && !saving && (
                  <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
                )}
              </div>

              <p className="text-xs text-gray-400 mt-5 leading-relaxed">
                Clocking out is never blocked by distance. Someone who has finished their shift and
                walked to the car park still needs to close it, and a fence that traps them
                clocked-in overnight would be a bug rather than a safeguard.
              </p>
            </div>
          )}
        </div>
      )}
    </TeamTabs>
  );
};

export default ClinicLocation;
