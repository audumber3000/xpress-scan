import React from 'react';
import { AlertTriangle, Check, CalendarClock, Sparkles, Info } from 'lucide-react';
import {
  CONDITIONS_BY_ID, activeSafetyFlags, warningsFor, sessionDefaultFor,
} from './dermProtocols';
import { TextField, Label } from './DermControls';

/**
 * The plan, and the three things that make it a tool rather than a text box.
 *
 * ── 1. A shortlist, not a menu ───────────────────────────────────────────────
 *
 * The clinic offers twenty-two procedures and a pharmacopoeia. For grade III
 * acne about twelve things are worth considering, and they group into topical,
 * oral and procedural. Showing those twelve is not a restriction — everything
 * else is still reachable in the prescription and the free-text below — it is
 * the difference between a screen that answers "what are my options here" and
 * one that makes you remember them.
 *
 * Each option carries one line saying where it sits: strongly recommended,
 * conditional, first line, last resort. That line is the reason to prefer this
 * over a blank box, and it comes from published guidance, not from us.
 *
 * ── 2. Safety rails ──────────────────────────────────────────────────────────
 *
 * The flags read patient factors already on the case paper — pregnancy status,
 * Fitzpatrick type, what she has already taken — and mark the specific
 * treatments those factors bear on. Isotretinoin in a pregnant patient is not
 * hidden or blocked; it is marked, with the reason, because the decision is the
 * doctor's and the screen's job is to make sure it was a decision.
 *
 * ── 3. A course, not an appointment ──────────────────────────────────────────
 *
 * Nobody has one peel. Picking a procedural treatment offers its usual course —
 * six sessions three weeks apart — and works out when they fall, so the next
 * visit can be booked against a plan instead of a guess. The numbers are
 * editable starting points, not protocol.
 *
 * Nothing here writes a prescription. It records what was decided; the
 * prescription is written from the action bar as it always was.
 */

const TONE = {
  high: {
    box: 'border-red-200 bg-red-50/70',
    icon: 'text-red-600',
    title: 'text-red-900',
    body: 'text-red-800',
  },
  medium: {
    box: 'border-amber-200 bg-amber-50/70',
    icon: 'text-amber-600',
    title: 'text-amber-900',
    body: 'text-amber-800',
  },
};

const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const PlanBuilder = ({ derm, onDermChange, patientContext }) => {
  const treatment = derm.treatment || { selected: [], sessions: {}, notes: '' };
  const conditions = (derm.conditions || []).map((id) => CONDITIONS_BY_ID[id]).filter(Boolean);

  const flags = activeSafetyFlags(patientContext);
  const flagIds = flags.map((f) => f.id);

  const setTreatment = (patch) =>
    onDermChange({ ...derm, treatment: { ...treatment, ...patch } });

  const toggle = (label) => {
    const on = treatment.selected.includes(label);
    const selected = on
      ? treatment.selected.filter((x) => x !== label)
      : [...treatment.selected, label];

    // Selecting a procedural treatment proposes its usual course. Deselecting
    // takes the schedule with it, so a plan cannot keep sessions for something
    // that is no longer being done.
    const sessions = { ...treatment.sessions };
    if (on) {
      delete sessions[label];
    } else {
      const preset = sessionDefaultFor(label);
      if (preset) sessions[label] = { ...preset };
    }
    setTreatment({ selected, sessions });
  };

  const setSession = (label, patch) =>
    setTreatment({
      sessions: { ...treatment.sessions, [label]: { ...treatment.sessions[label], ...patch } },
    });

  const scheduled = Object.entries(treatment.sessions || {})
    .filter(([label]) => treatment.selected.includes(label));

  return (
    <section className="border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-1">
        <span className="w-7 h-7 rounded-lg bg-[#2a276e]/5 flex items-center justify-center text-[#2a276e] shrink-0">
          <Sparkles size={15} />
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-900">Plan</h3>
          <p className="text-xs text-gray-500">
            Options for what you are treating. Pick what you are doing — this records the
            decision, it does not prescribe.
          </p>
        </div>
        {treatment.selected.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-[#2a276e] text-white text-[10px] font-bold tabular-nums shrink-0">
            {treatment.selected.length}
          </span>
        )}
      </div>

      {/* Safety first, and above the options rather than beside them, because a
          warning nobody scrolls to is decoration. */}
      {flags.length > 0 && (
        <div className="mt-4 space-y-2">
          {flags.map((f) => {
            const tone = TONE[f.severity] || TONE.medium;
            return (
              <div key={f.id} className={`flex gap-2.5 p-3 rounded-xl border ${tone.box}`}>
                <AlertTriangle size={15} className={`${tone.icon} shrink-0 mt-0.5`} />
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${tone.title}`}>{f.title}</p>
                  <p className={`text-[11px] mt-0.5 leading-relaxed ${tone.body}`}>{f.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {conditions.length === 0 ? (
        <p className="text-xs text-gray-400 mt-5">
          Pick what you are treating above and the options for it appear here.
        </p>
      ) : (
        <div className="mt-5 space-y-6">
          {conditions.map((condition) => (
            <div key={condition.id}>
              <p className="text-xs font-bold text-gray-900 mb-3">{condition.label}</p>
              <div className="space-y-4">
                {condition.plan.map((group) => (
                  <div key={group.group}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      {group.group}
                    </p>
                    <div className="space-y-1.5">
                      {group.items.map((item) => {
                        const on = treatment.selected.includes(item.label);
                        const warns = warningsFor(item, flagIds);
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => toggle(item.label)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                              on
                                ? 'border-[#2a276e] bg-[#2a276e]/5'
                                : warns.length
                                  ? 'border-amber-200 bg-white hover:border-amber-300'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <span className="flex items-start gap-2">
                              <span
                                className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                  on ? 'bg-[#2a276e] border-[#2a276e]' : 'border-gray-300'
                                }`}
                              >
                                {on && <Check size={11} className="text-white" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-xs font-semibold ${on ? 'text-[#2a276e]' : 'text-gray-800'}`}>
                                    {item.label}
                                  </span>
                                  {warns.length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-wide">
                                      <AlertTriangle size={8} /> check
                                    </span>
                                  )}
                                </span>
                                {item.note && (
                                  <span className="block text-[11px] text-gray-400 mt-0.5 leading-snug">
                                    {item.note}
                                  </span>
                                )}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* The course. Only appears once something with sessions is chosen. */}
      {scheduled.length > 0 && (
        <div className="mt-6 pt-5 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock size={14} className="text-[#2a276e]" />
            <p className="text-xs font-bold text-gray-900">Course</p>
            <span className="text-[11px] text-gray-400">Usual starting points, edit as needed</span>
          </div>
          <div className="space-y-2">
            {scheduled.map(([label, s]) => (
              <div key={label} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-gray-200">
                <span className="text-xs font-semibold text-gray-800 flex-1 min-w-[140px]">{label}</span>
                <label className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <input
                    type="number"
                    min={1}
                    value={s.sessions ?? ''}
                    onChange={(e) => setSession(label, { sessions: Number(e.target.value) })}
                    className="w-14 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center tabular-nums focus:border-[#2a276e] outline-none"
                  />
                  sessions
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  every
                  <input
                    type="number"
                    min={1}
                    value={s.intervalDays ?? ''}
                    onChange={(e) => setSession(label, { intervalDays: Number(e.target.value) })}
                    className="w-14 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center tabular-nums focus:border-[#2a276e] outline-none"
                  />
                  days
                </label>
                {s.intervalDays > 0 && s.sessions > 0 && (
                  <span className="text-[11px] text-gray-500">
                    next <strong className="text-gray-800">{addDays(s.intervalDays)}</strong>
                    <span className="text-gray-400">
                      {' '}· ends about {addDays(s.intervalDays * (s.sessions - 1))}
                    </span>
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-gray-400 mt-3">
            <Info size={11} className="mt-0.5 shrink-0" />
            Book the next one from Next Visit in the bar below.
          </p>
        </div>
      )}

      <div className="mt-6 pt-5 border-t border-gray-100">
        <TextField
          label="Anything else in the plan"
          value={treatment.notes}
          onChange={(v) => setTreatment({ notes: v })}
          placeholder="Doses, review interval, what to do if it flares..."
          rows={3}
        />
      </div>
    </section>
  );
};

export default PlanBuilder;
