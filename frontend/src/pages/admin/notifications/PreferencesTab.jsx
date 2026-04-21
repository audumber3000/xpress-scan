import React from 'react';
import { Loader2, Send } from 'lucide-react';
import { EVENT_LABELS, EVENT_AUDIENCE, CHANNEL_META } from './constants';

const AUTOMATED_EVENTS = [
  { event_type: 'molarplus_app_welcome',            channels: ['whatsapp', 'email'] },
  { event_type: 'molarplus_subscription_confirmed', channels: ['whatsapp', 'email'] },
  { event_type: 'molarplus_topup_success',          channels: ['whatsapp', 'email'] },
  { event_type: 'molarplus_weekly_report_mk',       channels: ['whatsapp'] },
  { event_type: 'molarplus_monthly_report_mk',      channels: ['whatsapp'] },
  { event_type: 'molarplus_review_report_mk',       channels: ['whatsapp'] },
  { event_type: 'molarplus_lab_due_tomorrow_mk',    channels: ['whatsapp'] },
  { event_type: 'molarplus_trial_started_mk',       channels: ['whatsapp'] },
  { event_type: 'molarplus_trial_mid_mk',           channels: ['whatsapp'] },
  { event_type: 'molarplus_trial_ending_mk',        channels: ['whatsapp'] },
  { event_type: 'molarplus_trial_ended_mk',         channels: ['whatsapp'] },
];

const AudienceBadge = ({ audience }) => {
  if (audience === 'doctor')
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">👨‍⚕️ Doctor</span>;
  if (audience === 'owner')
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100">🤖 Auto</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">🧑‍🦷 Patient</span>;
};

const PreferencesTab = ({ preferences, savingPrefs, handleSavePreferences, updatePref, openTestDrawer }) => (
  <>
    {/* Clinic event preferences */}
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-gray-50">
        <div>
          <h3 className="font-semibold text-gray-900">Notification Preferences</h3>
          <p className="text-xs text-gray-400 mt-0.5">Choose channel, enable/disable, and test each event.</p>
        </div>
        <button
          onClick={handleSavePreferences}
          disabled={savingPrefs}
          className="flex items-center gap-2 px-4 py-2 bg-[#29828a] hover:bg-[#1f6b72] disabled:bg-gray-200 text-white text-sm font-semibold rounded-lg transition-all"
        >
          {savingPrefs ? <Loader2 size={14} className="animate-spin" /> : null}
          Save Preferences
        </button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-6 gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Event</div>
        {['whatsapp', 'email', 'sms'].map(ch => (
          <div key={ch} className={`text-xs font-semibold uppercase tracking-wider text-center ${ch === 'sms' ? 'text-gray-300' : CHANNEL_META[ch].color}`}>
            {CHANNEL_META[ch].label}
            {ch === 'sms' && <span className="ml-1 text-[9px] font-semibold bg-gray-100 text-gray-400 border border-gray-200 rounded px-1 py-0.5 normal-case">Soon</span>}
          </div>
        ))}
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Test</div>
      </div>

      <div className="divide-y divide-gray-50">
        {preferences.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading preferences...</div>
        ) : (
          preferences.map(pref => {
            const audience = EVENT_AUDIENCE[pref.event_type] || 'patient';
            return (
              <div key={pref.event_type} className="grid grid-cols-6 gap-3 px-5 py-4 hover:bg-gray-50/50 transition-colors items-center">
                <div className="col-span-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-800">{EVENT_LABELS[pref.event_type] || pref.event_type}</p>
                    <AudienceBadge audience={audience} />
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={pref.is_enabled}
                        onChange={e => updatePref(pref.event_type, 'is_enabled', e.target.checked)}
                      />
                      <div className="w-8 h-4 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#29828a]/20 rounded-full peer peer-checked:bg-[#29828a] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 transition-all" />
                    </label>
                    <span className="text-xs text-gray-400">{pref.is_enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
                {['whatsapp', 'email', 'sms'].map(ch => {
                  const checked = (pref.channels || []).includes(ch);
                  const isSmsLocked = ch === 'sms';
                  return (
                    <div key={ch} className="flex items-center justify-center">
                      {isSmsLocked ? (
                        <div title="SMS coming soon" className="w-5 h-5 rounded flex items-center justify-center border-2 border-gray-200 bg-gray-50 cursor-not-allowed opacity-40">
                          <svg width="9" height="12" viewBox="0 0 9 12" fill="none">
                            <rect x="1" y="5" width="7" height="6" rx="1" stroke="#9ca3af" strokeWidth="1.4"/>
                            <path d="M2.5 5V3.5a2 2 0 014 0V5" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round"/>
                          </svg>
                        </div>
                      ) : (
                        <button
                          onClick={() => updatePref(pref.event_type, 'toggleChannel', ch)}
                          disabled={!pref.is_enabled}
                          className={`w-5 h-5 rounded flex items-center justify-center transition-all disabled:opacity-30 border-2 ${
                            checked ? 'border-[#29828a] bg-[#29828a]' : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {checked && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => openTestDrawer(pref)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#29828a] border border-[#29828a]/30 bg-[#29828a]/5 hover:bg-[#29828a]/10 rounded-lg transition-all"
                  >
                    <Send size={11} /> Test
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>

    {/* Automated / Platform Notifications */}
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mt-6">
      <div className="p-5 border-b border-gray-50">
        <h3 className="font-semibold text-gray-900">Automated Notifications</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          System-sent messages to clinic owners — triggered automatically. Use Test to preview and send a sample.
        </p>
      </div>

      <div className="grid grid-cols-6 gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="col-span-5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Event</div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Test</div>
      </div>

      <div className="divide-y divide-gray-50">
        {AUTOMATED_EVENTS.map(pref => (
          <div key={pref.event_type} className="grid grid-cols-6 gap-3 px-5 py-4 hover:bg-gray-50/50 transition-colors items-center">
            <div className="col-span-5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-gray-800">{EVENT_LABELS[pref.event_type] || pref.event_type}</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100">🤖 Auto</span>
                <span className="text-[10px] font-mono text-gray-300">{pref.event_type}</span>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <button
                onClick={() => openTestDrawer({ ...pref, is_enabled: true })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#29828a] border border-[#29828a]/30 bg-[#29828a]/5 hover:bg-[#29828a]/10 rounded-lg transition-all"
              >
                <Send size={11} /> Test
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </>
);

export default PreferencesTab;
