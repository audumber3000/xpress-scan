import React from "react";
import { Smartphone, UserCheck, MapPin, Timer, AlertTriangle, LogIn, LogOut } from "lucide-react";

/**
 * Everything the phone recorded for one day.
 *
 * ── Why these fields ─────────────────────────────────────────────────────────
 *
 * The complaint this answers is that a clock-in from the phone left no trace
 * an owner could see: the web grid showed a green cell and nothing else. What
 * an owner actually wants to know, in the order they want to know it:
 *
 *   1. When did they arrive and leave, and how long was that?
 *   2. Were they late, measured against when this clinic opens that day?
 *   3. Did THEY clock in, or did somebody mark it for them? This is the
 *      question the whole feature exists for, so it is stated in words rather
 *      than left to an icon.
 *   4. Were they where they said they were? Distance from the clinic, with the
 *      GPS accuracy beside it, because a distance without its error bar is not
 *      evidence of anything.
 *
 * Rendered as nothing at all when there is no record. An empty panel of dashes
 * on an unmarked day is noise, and this sits above a form somebody is about to
 * fill in.
 */

const fmtDuration = (minutes) => {
  if (!minutes) return null;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
};

const Row = ({ Icon, label, children, tone = "text-gray-400" }) => (
  <div className="flex items-start gap-2.5">
    <Icon size={14} className={`${tone} mt-0.5 shrink-0`} />
    <div className="min-w-0 flex-1">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">{label}</span>
      <div className="text-xs text-gray-700 mt-0.5">{children}</div>
    </div>
  </div>
);

const ClockInDetail = ({ day }) => {
  const marked = day && Object.keys(day).length > 0;
  if (!marked) return null;

  const worked = fmtDuration(day.worked_minutes);
  const fromPhone = day.source === "mobile";
  const ci = day.clock_in;
  const co = day.clock_out;
  const hasTimes = day.check_in || day.check_out || day.is_open_shift;

  // Nothing was clocked; this is a purely hand-marked day with no times on it.
  // Say so in one line rather than rendering a panel of blanks.
  if (!hasTimes && !ci) {
    return (
      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-2.5">
        <UserCheck size={14} className="text-gray-400 shrink-0" />
        <p className="text-xs text-gray-600">
          Marked by hand{day.marked_by_name ? ` by ${day.marked_by_name}` : ""}. No clock-in recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-900">Recorded for this day</p>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            fromPhone ? "bg-[#29828a]/10 text-[#29828a]" : "bg-amber-50 text-amber-700"
          }`}
        >
          {fromPhone ? <Smartphone size={10} /> : <UserCheck size={10} />}
          {fromPhone ? "From phone" : "Marked by hand"}
        </span>
      </div>

      {hasTimes && (
        <div className="grid grid-cols-2 gap-3">
          <Row Icon={LogIn} label="Clocked in" tone="text-emerald-500">
            <span className="font-semibold tabular-nums">{day.check_in || "—"}</span>
            {day.expected_open && (
              <span className="text-gray-400"> · opens {day.expected_open}</span>
            )}
            {day.late_by_minutes > 0 && (
              <span className="block text-amber-600 font-semibold">{day.late_by_minutes} min late</span>
            )}
          </Row>
          <Row Icon={LogOut} label="Clocked out" tone="text-gray-400">
            {day.check_out ? (
              <span className="font-semibold tabular-nums">{day.check_out}</span>
            ) : day.is_open_shift ? (
              <span className="text-amber-600 font-semibold">Still clocked in</span>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </Row>
        </div>
      )}

      {worked && (
        <Row Icon={Timer} label="Time on shift">
          <span className="font-semibold">{worked}</span>
        </Row>
      )}

      {ci && (
        <Row
          Icon={ci.outside_geofence ? AlertTriangle : MapPin}
          label="Where they clocked in"
          tone={ci.outside_geofence ? "text-amber-500" : "text-gray-400"}
        >
          {ci.distance_m != null ? (
            <span className={ci.outside_geofence ? "text-amber-700 font-semibold" : ""}>
              {Math.round(ci.distance_m)} m from the clinic
              {ci.outside_geofence ? " — outside the clinic area" : ""}
            </span>
          ) : (
            <span className="text-gray-500">Location recorded, no clinic pin set to measure against</span>
          )}
          {/* The accuracy is not a footnote. 40 m out on a +/- 5 m fix and 40 m
              out on a +/- 200 m fix are different findings, and only one of
              them is worth asking somebody about. */}
          {ci.accuracy_m != null && (
            <span className="block text-gray-400">GPS accurate to about {Math.round(ci.accuracy_m)} m</span>
          )}
          {ci.address && <span className="block text-gray-500 mt-0.5">{ci.address}</span>}
        </Row>
      )}

      {co?.outside_geofence && (
        <Row Icon={AlertTriangle} label="Clocked out from" tone="text-gray-400">
          <span className="text-gray-600">
            {Math.round(co.distance_m)} m away. Clocking out is never blocked by distance.
          </span>
        </Row>
      )}

      {!fromPhone && day.marked_by_name && (
        <p className="text-[11px] text-gray-500 pt-1 border-t border-gray-200">
          Marked by {day.marked_by_name}
        </p>
      )}
    </div>
  );
};

export default ClockInDetail;
