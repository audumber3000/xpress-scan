import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Globe, ShieldOff, ShieldCheck, Trash2, RefreshCw, Loader2, Search, AlertTriangle,
} from 'lucide-react';
import { FaApple, FaWindows, FaAndroid, FaLinux } from 'react-icons/fa6';
import { notify } from '../../../utils/notify';
import { api } from '../../../utils/api';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateTime } from '../../../utils/datetime';
import EmptyState from '../../../components/common/EmptyState';
import PageShell from '../../../components/common/PageShell';
import { noData } from '../../../assets/illustrations';

/**
 * Device Security — every device signed in across the clinic, with the ability
 * to block or remove one.
 *
 * Block vs Remove is a real distinction, not two words for the same thing:
 *  - Block (is_active=false) is durable. The device is refused at every future
 *    sign-in until someone unblocks it.
 *  - Remove (DELETE) just forgets the record. The device re-enrols the next
 *    time that person signs in, so it is for tidying the list, not for security.
 *
 * Both take effect at the NEXT sign-in — tokens are not device-bound, so a
 * session that is already open keeps working until its token expires. The UI
 * says so rather than implying an instant kick.
 *
 * Rendered as the Devices tab of Access & Activity. `embedded` drops the page
 * chrome (scroll container, heading, Refresh) because the host supplies it;
 * `reloadKey` is how that host's Refresh button reaches in here.
 */

/**
 * The operating system, drawn as its own mark. `device_platform` is written by
 * the enrolment code as one of Windows / macOS / iOS / Android / Linux, or
 * Unknown when the user agent gives nothing away — matched loosely so a value
 * like "Mac OS X" still lands on Apple rather than the fallback.
 */
const PLATFORM_MARKS = [
  { match: /mac|ios|ipad|iphone|darwin/i, Icon: FaApple,   label: 'Apple',   cls: 'bg-gray-100 text-gray-700' },
  { match: /windows|win32|win64/i,        Icon: FaWindows, label: 'Windows', cls: 'bg-sky-50 text-sky-600' },
  { match: /android/i,                    Icon: FaAndroid, label: 'Android', cls: 'bg-emerald-50 text-emerald-600' },
  { match: /linux|ubuntu|debian|fedora/i, Icon: FaLinux,   label: 'Linux',   cls: 'bg-amber-50 text-amber-700' },
];

const platformMark = (platform) =>
  PLATFORM_MARKS.find((p) => p.match.test(platform || '')) || {
    Icon: Globe, label: 'Unknown', cls: 'bg-gray-100 text-gray-400',
  };

const Devices = ({ embedded = false, reloadKey = 0 }) => {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [showBlocked, setShowBlocked] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/devices');
      setDevices(Array.isArray(data) ? data : []);
    } catch (e) {
      notify.problem('Could not load devices');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, reloadKey]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices
      .filter((d) => (showBlocked ? true : d.is_active))
      .filter((d) => {
        if (!q) return true;
        return [d.device_name, d.user_name, d.user_email, d.device_platform, d.location]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => {
        // Blocked first (they need attention), then most recently seen.
        if (a.is_active !== b.is_active) return a.is_active ? 1 : -1;
        return new Date(b.last_seen || 0) - new Date(a.last_seen || 0);
      });
  }, [devices, query, showBlocked]);

  const blockedCount = devices.filter((d) => !d.is_active).length;

  const patchDevice = async (device, body, successMsg) => {
    setBusyId(device.id);
    try {
      await api.put(`/devices/${device.id}`, body);
      notify.done(successMsg);
      await load();
    } catch (e) {
      notify.problem(e, 'Could not update this device');
    } finally {
      setBusyId(null);
    }
  };

  const toggleBlock = (device) => {
    if (device.is_active) {
      const who = device.user_name || 'this user';
      if (!window.confirm(
        `Block "${device.device_name}"?\n\n${who} will be refused on this device at their next sign-in. Any session they already have open keeps working until it expires.`
      )) return;
      patchDevice(device, { is_active: false }, 'Device blocked');
    } else {
      patchDevice(device, { is_active: true }, 'Device unblocked');
    }
  };

  const removeDevice = async (device) => {
    if (!window.confirm(
      `Remove "${device.device_name}" from the list?\n\nThis only forgets the device — it will appear again the next time ${device.user_name || 'this user'} signs in from it. To stop access, block it instead.`
    )) return;
    setBusyId(device.id);
    try {
      await api.delete(`/devices/${device.id}`);
      notify.done('Device removed');
      await load();
    } catch (e) {
      notify.problem(e, 'Could not remove this device');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageShell embedded={embedded}>
      {!embedded && (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Devices</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Every device your team has signed in from. Block one to stop it being used.
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 mb-5 flex items-start gap-2.5 max-w-3xl">
        <AlertTriangle size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800 leading-relaxed">
          Blocking takes effect at the next sign-in. Someone already signed in on that device stays
          signed in until their session expires, so for an urgent case ask them to sign out, or reset
          their password as well.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by person, device or place"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#29828a]/20 focus:border-[#29828a] outline-none transition-all"
          />
        </div>
        {blockedCount > 0 && (
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showBlocked}
              onChange={(e) => setShowBlocked(e.target.checked)}
              className="rounded border-gray-300 text-[#29828a] focus:ring-[#29828a]/30"
            />
            Show blocked ({blockedCount})
          </label>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] divide-y divide-gray-200">
              <thead className="bg-[#f8fafc]">
                <tr>
                  {['Device', 'Person', 'Location', 'Last Seen'].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8">
                      <EmptyState
                        image={noData}
                        title={devices.length === 0 ? 'No devices yet' : 'Nothing matches that search'}
                        subtitle={devices.length === 0
                          ? 'Devices show up here once your team signs in from them.'
                          : 'Try a different name or place.'}
                      />
                    </td>
                  </tr>
                ) : visible.map((device) => {
                  const mark = platformMark(device.device_platform);
                  const isSelf = device.user_id === user?.id;
                  const busy = busyId === device.id;

                  return (
                    <tr
                      key={device.id}
                      className={`transition-colors duration-150 group ${
                        device.is_active ? 'hover:bg-indigo-50/30' : 'bg-red-50/40 hover:bg-red-50/60'
                      }`}
                    >
                      {/* Device — the OS mark carries the identity at a glance */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            device.is_active ? mark.cls : 'bg-red-100 text-red-500'
                          }`}>
                            <mark.Icon size={19} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900 truncate">
                                {device.device_name || 'Unnamed device'}
                              </span>
                              {/* Blocked stays — it changes what the row means. */}
                              {!device.is_active && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                                  Blocked
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {[device.device_platform, device.device_os]
                                .filter((v, i, a) => v && a.indexOf(v) === i)
                                .join(' · ') || 'Unknown platform'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900 truncate">{device.user_name || '—'}</p>
                        {device.user_email && (
                          <p className="text-xs text-gray-400 truncate">{device.user_email}</p>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-700">{device.location || '—'}</p>
                        {device.ip_address && (
                          <p className="text-xs text-gray-400 font-mono">{device.ip_address}</p>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 whitespace-nowrap">
                          {device.last_seen ? formatDateTime(device.last_seen) : 'Never'}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleBlock(device)}
                            disabled={busy || (isSelf && device.is_active)}
                            title={isSelf && device.is_active ? "You can't block your own device" : undefined}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                              device.is_active
                                ? 'text-red-600 border-red-200 hover:bg-red-50'
                                : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                            }`}
                          >
                            {busy ? <Loader2 size={13} className="animate-spin" />
                              : device.is_active ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                            {device.is_active ? 'Block' : 'Unblock'}
                          </button>
                          <button
                            onClick={() => removeDevice(device)}
                            disabled={busy}
                            title="Remove from list"
                            className="p-2 rounded-lg text-gray-400 border border-gray-200 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  );
};

export default Devices;
