import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import AppointmentCard from "./AppointmentCard";
import { computeDayLayout } from "../utils/layout";
import { getDoctorColor, UNASSIGNED_STYLE } from "../utils/doctorColors";
import useNow from "../hooks/useNow";

/**
 * The day, one column per resource.
 *
 * Two things this grid has to get right that a plain calendar does not:
 *
 * 1. The lattice is 15 minutes. At the old 80px per hour a quarter slot was
 *    20px, too fine to hit reliably and far too fine for a fingertip on an
 *    iPad at the chairside, so the scale went up. 15 is the grid, not a rule:
 *    the booking form still takes any start and any duration, and a 20 minute
 *    appointment simply renders at its true height between the lines.
 *
 * 2. Time a doctor does not work is drawn as unavailable and refuses a drop.
 *    The server enforces the same rule, so this is an affordance rather than
 *    the guard, but a grid that lets you drop somewhere it will then reject is
 *    worse than one that never offered.
 */

const HOUR_PX = 120;            // 15 minutes = 30px, comfortably tappable
const SNAP_MINUTES = 15;
const MIN_DURATION = 15;

// A column narrower than this shows a coloured sliver and a truncated name, so
// it answers nothing. Four doctors on a tablet were getting 28px each. Past
// this floor the grid scrolls sideways instead of dividing further: three
// chairs you can read and scroll beats three chairs you cannot.
// Per axis, because the columns carry different amounts. A doctor column holds
// a full name and sometimes "No hours set"; a day column holds "MON 10". Using
// the wider floor for days pushed Saturday off a 1440px screen, which is a
// silly way to lose a day of the week.
const MIN_COL_PX = { doctor: 132, chair: 132, day: 104 };
const TIME_COL_PX = 64;

const pad2 = (n) => String(n).padStart(2, "0");

const formatHourLabel = (hour) => {
  const h = hour % 24;
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${suffix}`;
};

const minutesFromMidnight = (hhmm) => {
  if (!hhmm) return 0;
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const hhmm = (mins) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;

const DayGrid = ({
  date,
  appointments,
  doctors,
  selectedDoctorIds,
  showUnassigned,
  unassignedCount,
  clinicTimings,
  onAppointmentClick,
  onReassign,
  // New in the rebuild. All optional, so the grid still renders without them.
  onResize,
  onCreate,
  dayShape,                 // { slot_minutes, chairs, doctors: { id: { configured, blocks } } }
  axis = "doctor",          // "doctor" | "chair" | "day"
  chairCount = 1,
  // Only for axis="day": the seven dates to draw as columns. Passing them in
  // rather than deriving a week here keeps the caller in charge of which week
  // is on screen.
  days = null,
}) => {
  const overlayRef = useRef(null);
  const scrollRef = useRef(null);
  const frameRef = useRef(null);
  // Measured, not guessed: the grid has to know its own width to decide
  // between fitting the columns and scrolling them.
  const [frameWidth, setFrameWidth] = useState(0);

  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setFrameWidth(entry.contentRect.width));
    ro.observe(node);
    setFrameWidth(node.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const [dragOverColIdx, setDragOverColIdx] = useState(null);
  // A drag-out on empty grid, and a drag on a card's bottom edge. Both are
  // pointer-driven rather than HTML5 drag-and-drop, because HTML5 drag has no
  // usable touch story and this has to work on an iPad.
  const [ghost, setGhost] = useState(null);      // { colIdx, startMin, endMin }
  const [resizing, setResizing] = useState(null); // { id, colIdx, startMin, endMin }
  // The slot under the cursor, so hovering shows exactly where a click lands.
  const [hoverSlot, setHoverSlot] = useState(null); // { colIdx, startMin }
  // How far below the card's own top the pointer was when the drag began.
  // Without this a drag drops the card's START at the cursor, so grabbing a
  // 60 minute card in the middle and dropping it at 8:00 booked 8:30 to 9:30.
  const grabOffsetMin = useRef(0);

  // Ticks every minute, so the now-line moves on a screen left open all day.
  const now = useNow();

  const visibleDoctors = useMemo(
    () => doctors.filter((d) => selectedDoctorIds.has(d.id)),
    [doctors, selectedDoctorIds]
  );

  const showUnassignedCol = showUnassigned && unassignedCount > 0;

  const columns = useMemo(() => {
    if (axis === "day" && days?.length) {
      // The week. Same grid, same cards, same interactions: the only thing
      // that changes is what a column means, so dragging sideways moves an
      // appointment to another DAY rather than to another dentist.
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return days.map((d) => ({
        key: `day-${d.toISOString().split("T")[0]}`,
        date: d,
        doctorId: null,
        chair: null,
        label: d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
        isToday: d.toDateString() === today.toDateString(),
        color: { dot: "bg-transparent", card: "", cardBorderLeft: "", isUnassigned: false },
      }));
    }
    if (axis === "chair") {
      // A four-chair practice wants to see rooms, not people. Same grid, same
      // cards, different question: "which chair is free" instead of "who is busy".
      const chairs = Array.from({ length: Math.max(1, chairCount) }, (_, i) => ({
        key: `chair-${i + 1}`,
        chair: String(i + 1),
        doctorId: null,
        label: `Chair ${i + 1}`,
        color: getDoctorColor(i + 1),
      }));
      // Only when something actually needs it, so a clinic that always assigns
      // a chair never sees an empty extra column. Computed from the props
      // rather than dayAppointments, which is derived from `columns` further
      // down and would still be in its temporal dead zone here.
      const dayKey = date.toISOString().split("T")[0];
      const anyChairless = appointments.some(
        (a) => !a.chair_number && a.date &&
          new Date(a.date).toISOString().split("T")[0] === dayKey
      );
      if (anyChairless) {
        chairs.push({
          key: "chair-unassigned",
          chair: null,
          doctorId: null,
          label: "No chair",
          color: UNASSIGNED_STYLE,
        });
      }
      return chairs;
    }
    const list = visibleDoctors.map((d) => ({
      key: `doc-${d.id}`,
      doctorId: d.id,
      chair: null,
      label: d.name || d.email || `Doctor #${d.id}`,
      color: getDoctorColor(d.id),
    }));
    if (showUnassignedCol) {
      list.push({ key: "unassigned", doctorId: null, chair: null, label: "Unassigned", color: UNASSIGNED_STYLE });
    }
    return list;
  }, [axis, chairCount, visibleDoctors, showUnassignedCol, days, appointments, date]);

  // Time bounds. Clinic hours set the frame, but a booking that sits outside
  // them still has to be visible, otherwise an early appointment silently
  // vanishes off the top of the grid.
  const { openHour, closeHour } = useMemo(() => {
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const t = clinicTimings?.[dayName];
    let open = Number(String(t?.open || "08:00").split(":")[0]);
    let close = Number(String(t?.close || "20:00").split(":")[0]);

    const targetDateStr = date.toISOString().split("T")[0];
    appointments.forEach((a) => {
      const d = a.date ? new Date(a.date).toISOString().split("T")[0] : null;
      if (d !== targetDateStr) return;
      open = Math.min(open, Math.floor(minutesFromMidnight(a.startTime) / 60));
      close = Math.max(close, Math.ceil(minutesFromMidnight(a.endTime) / 60));
    });
    return { openHour: Math.max(0, open), closeHour: Math.min(24, Math.max(close, open + 1)) };
  }, [date, clinicTimings, appointments]);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = openHour; h <= closeHour; h++) slots.push({ hour: h, label: formatHourLabel(h) });
    return slots;
  }, [openHour, closeHour]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    node.scrollTop = Math.max(0, ((minutes - openHour * 60) * HOUR_PX) / 60 - 200);
  }, [openHour, closeHour, date]);

  const targetDateStr = date.toISOString().split("T")[0];
  const isoOf = (a) => (a.date ? new Date(a.date).toISOString().split("T")[0] : null);

  // In week mode every column is a different day, so the grid is not filtered
  // to one date up front the way it is for a single day.
  const dayAppointments = useMemo(() => {
    if (axis === "day") {
      const wanted = new Set(columns.map((c) => c.date.toISOString().split("T")[0]));
      return appointments.filter((a) => wanted.has(isoOf(a)));
    }
    return appointments.filter((a) => isoOf(a) === targetDateStr);
  }, [appointments, targetDateStr, axis, columns]);

  const apptsByColumn = useMemo(() => {
    const map = {};
    columns.forEach((c) => (map[c.key] = []));
    dayAppointments.forEach((a) => {
      const key = axis === "day"
        ? `day-${isoOf(a)}`
        : axis === "chair"
          // A booking with no chair is not chair 1. Filing it there overstated
          // that room's load and hid the fact that nobody had assigned one.
          ? (a.chair_number ? `chair-${a.chair_number}` : "chair-unassigned")
          : (a.doctor_id ? `doc-${a.doctor_id}` : "unassigned");
      if (map[key]) map[key].push(a);
    });
    return map;
  }, [dayAppointments, columns, axis]);

  const layoutByColumn = useMemo(() => {
    const map = {};
    Object.entries(apptsByColumn).forEach(([k, list]) => { map[k] = computeDayLayout(list); });
    return map;
  }, [apptsByColumn]);

  // ─── Availability ────────────────────────────────────────────────────────
  // Ranges a doctor is NOT working, as pixel bands. A doctor with no hours
  // configured gets no bands at all: "not set up" is not the same as "off", and
  // shading a whole column for a clinic that never filled this in would look
  // broken rather than informative.
  const unavailableByColumn = useMemo(() => {
    // Shading needs a day-shape per date. Only one is fetched (for the day on
    // screen), so week mode shows no shading rather than applying one day's
    // hours to all seven, which would be confidently wrong.
    if (!dayShape?.doctors || axis === "chair" || axis === "day") return {};
    const out = {};
    columns.forEach((col) => {
      if (!col.doctorId) return;
      const info = dayShape.doctors[String(col.doctorId)];
      if (!info || !info.configured) return;
      const blocks = (info.blocks || [])
        .map((b) => [minutesFromMidnight(b.start), minutesFromMidnight(b.end)])
        .sort((a, b) => a[0] - b[0]);

      const gaps = [];
      let cursor = openHour * 60;
      blocks.forEach(([s, e]) => {
        if (s > cursor) gaps.push([cursor, s]);
        cursor = Math.max(cursor, e);
      });
      if (cursor < closeHour * 60) gaps.push([cursor, closeHour * 60]);
      out[col.key] = gaps;
    });
    return out;
  }, [dayShape, columns, openHour, closeHour, axis]);

  const isAvailableAt = useCallback((col, startMin, endMin) => {
    const gaps = unavailableByColumn[col?.key];
    if (!gaps) return true;
    return !gaps.some(([gs, ge]) => startMin < ge && gs < endMin);
  }, [unavailableByColumn]);

  // ─── Pointer geometry ────────────────────────────────────────────────────
  // offsetMin shifts the result back by however far into the card the pointer
  // was, so a drag lands the card where the user aimed it.
  const pointToGrid = useCallback((clientX, clientY, offsetMin = 0) => {
    const node = overlayRef.current;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const colIdx = Math.max(0, Math.min(
      columns.length - 1,
      Math.floor(((clientX - rect.left) / rect.width) * columns.length)
    ));
    const raw = openHour * 60 + ((clientY - rect.top) / HOUR_PX) * 60 - offsetMin;
    // Snap first, then clamp: clamping first can land on a value off the
    // lattice at the very top or bottom of the grid.
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    return {
      colIdx,
      col: columns[colIdx],
      minutes: Math.max(openHour * 60, Math.min(closeHour * 60, snapped)),
    };
  }, [columns, openHour, closeHour]);

  // ─── Existing HTML5 drag: move a card between columns and times ──────────
  const handleCardDragStart = (e, apt) => {
    if (!onReassign) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/appointmentId", String(apt.id));

    // Measure the grab point against the card the user actually took hold of,
    // then convert it to minutes so the drop can put the card's top where they
    // aimed rather than where their finger happened to be.
    const card = e.currentTarget?.closest("[data-appointment-card]") || e.currentTarget;
    const rect = card?.getBoundingClientRect?.();
    grabOffsetMin.current = rect ? ((e.clientY - rect.top) / HOUR_PX) * 60 : 0;

    setDragOverColIdx(null);
  };

  const handleOverlayDragOver = (e) => {
    if (!onReassign) return;
    const target = pointToGrid(e.clientX, e.clientY, grabOffsetMin.current);
    if (!target) return;
    // Week mode always accepts: a column is a date, and moving an appointment
    // to another day is exactly what dragging sideways should do.
    if (axis !== "day" && (axis === "chair" || target.col.doctorId === null)) {
      // The Unassigned column has no doctor to assign to, and the chair axis
      // moves rooms rather than people. Neither is a valid drop for this path.
      e.dataTransfer.dropEffect = "none";
      setDragOverColIdx(null);
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColIdx(target.colIdx);
  };

  const handleOverlayDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverColIdx(null);
  };

  const handleOverlayDrop = (e) => {
    if (!onReassign) return;
    e.preventDefault();
    const id = parseInt(e.dataTransfer.getData("text/appointmentId"), 10);
    const target = pointToGrid(e.clientX, e.clientY, grabOffsetMin.current);
    setDragOverColIdx(null);
    grabOffsetMin.current = 0;
    if (Number.isNaN(id) || !target) return;

    if (axis === "day") {
      // Keep whoever it was booked with; only the day and time move.
      const appt = dayAppointments.find((a) => a.id === id);
      onReassign(id, appt?.doctor_id ?? null, hhmm(target.minutes),
                 target.col.date.toISOString().split("T")[0]);
      return;
    }
    if (target.col.doctorId === null) return;
    onReassign(id, target.col.doctorId, hhmm(target.minutes));
  };

  // ─── Resize: drag a card's bottom edge ───────────────────────────────────
  const beginResize = (e, apt, colIdx) => {
    if (!onResize) return;
    e.stopPropagation();
    e.preventDefault();
    setResizing({
      id: apt.id,
      colIdx,
      startMin: minutesFromMidnight(apt.startTime),
      endMin: minutesFromMidnight(apt.endTime),
    });
  };

  // ─── Create: press on empty grid, optionally drag to set the length ──────
  const handleOverlayPointerDown = (e) => {
    if (!onCreate || resizing) return;
    if (e.target.closest("[data-appointment-card]")) return;  // a card, not empty grid
    const p = pointToGrid(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setGhost({ colIdx: p.colIdx, startMin: p.minutes, endMin: p.minutes + SNAP_MINUTES });
  };

  const handleOverlayPointerMove = (e) => {
    if (!resizing && !ghost) {
      // Over a booking, the booking is the target, not the quarter hour behind
      // it. Highlighting the slot there suggested a click would book on top of
      // an appointment, when it actually opens the one under the cursor.
      if (e.target?.closest?.('[data-appointment-card]')) {
        setHoverSlot(null);
        return;
      }
      const p = pointToGrid(e.clientX, e.clientY);
      if (p) {
        setHoverSlot((h) =>
          h && h.colIdx === p.colIdx && h.startMin === p.minutes
            ? h                      // same slot, skip the re-render
            : { colIdx: p.colIdx, startMin: p.minutes }
        );
      }
    }
    if (resizing) {
      const p = pointToGrid(e.clientX, e.clientY);
      if (!p) return;
      setResizing((r) => (r ? { ...r, endMin: Math.max(r.startMin + MIN_DURATION, p.minutes) } : r));
      return;
    }
    if (!ghost) return;
    const p = pointToGrid(e.clientX, e.clientY);
    if (!p) return;
    setGhost((g) => (g ? { ...g, endMin: Math.max(g.startMin + SNAP_MINUTES, p.minutes) } : g));
  };

  const handleOverlayPointerUp = (e) => {
    if (resizing) {
      const r = resizing;
      setResizing(null);
      const apt = dayAppointments.find((a) => a.id === r.id);
      if (apt && r.endMin !== minutesFromMidnight(apt.endTime)) {
        onResize(r.id, hhmm(r.endMin));
      }
      return;
    }
    if (!ghost) return;
    const g = ghost;
    setGhost(null);
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    const col = columns[g.colIdx];
    // A plain click means "book here at the default length"; a drag means the
    // length the user dragged out.
    const duration = Math.max(SNAP_MINUTES, g.endMin - g.startMin);
    onCreate({
      date: col?.date ? col.date.toISOString().split("T")[0] : targetDateStr,
      startTime: hhmm(g.startMin),
      endTime: hhmm(g.startMin + duration),
      duration,
      doctorId: axis === "doctor" ? col?.doctorId ?? null : null,
      chairNumber: axis === "chair" ? col?.chair ?? null : null,
      available: isAvailableAt(col, g.startMin, g.startMin + duration),
    });
  };

  if (columns.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-lg border-2 border-dashed border-gray-300">
        <h3 className="text-lg font-semibold text-gray-700 mb-1">No team members visible</h3>
        <p className="text-sm text-gray-500">
          Select at least one doctor, or turn on Unassigned, in the panel on the left.
        </p>
      </div>
    );
  }

  const totalHeight = (closeHour - openHour) * HOUR_PX;

  // Fit the columns if they can be read at that size, otherwise hold them at
  // the floor and let the grid scroll. Percentages stay the unit for card
  // positioning either way, so nothing downstream has to know which mode it is.
  const minCol = MIN_COL_PX[axis] ?? 132;
  const availableForCols = Math.max(0, frameWidth - TIME_COL_PX);
  const needed = columns.length * minCol;
  const scrolls = frameWidth > 0 && needed > availableForCols;
  const gridWidthPx = scrolls ? TIME_COL_PX + needed : null;
  const colWidthPct = 100 / columns.length;
  const yFor = (min) => ((min - openHour * 60) * HOUR_PX) / 60;

  return (
    <div ref={frameRef} className="border border-gray-200 rounded-lg bg-white overflow-x-auto overflow-y-hidden">
      <div
        className="grid bg-gray-50 border-b border-gray-200 sticky top-0 z-20"
        style={{
          gridTemplateColumns: `${TIME_COL_PX}px repeat(${columns.length}, ${scrolls ? `${minCol}px` : 'minmax(0, 1fr)'})`,
          width: gridWidthPx ? `${gridWidthPx}px` : undefined,
        }}
      >
        <div className="px-2 py-2.5 text-[11px] font-semibold text-gray-500 text-center border-r border-gray-200">
          Time
        </div>
        {columns.map((col) => {
          const info = col.doctorId ? dayShape?.doctors?.[String(col.doctorId)] : null;
          const count = (apptsByColumn[col.key] || []).length;

          if (col.date) {
            // A day column reads as a date, with today marked, the way a week
            // header should.
            const [dow, dayNum] = [
              col.date.toLocaleDateString(undefined, { weekday: "short" }),
              col.date.getDate(),
            ];
            return (
              <div key={col.key} className="px-2 py-2 text-center border-r border-gray-100">
                <div className="text-[11px] font-semibold text-gray-500 uppercase">{dow}</div>
                <div className={`text-base font-bold mx-auto ${
                  col.isToday
                    ? "text-white bg-[#2a276e] rounded-full w-7 h-7 flex items-center justify-center"
                    : "text-gray-900"
                }`}>
                  {dayNum}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5 h-3">
                  {count > 0 ? `${count} appt${count === 1 ? "" : "s"}` : ""}
                </div>
              </div>
            );
          }

          return (
            <div
              key={col.key}
              className={`px-2 py-2.5 text-center border-r border-gray-100 ${
                col.color.isUnassigned ? "bg-amber-50" : ""
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${col.color.dot}`}></span>
                <span className={`text-sm font-semibold truncate ${
                  col.color.isUnassigned ? "text-amber-800" : "text-gray-800"
                }`}>
                  {col.label}
                </span>
              </div>
              {info && !info.configured && (
                <div className="text-[10px] text-gray-400 mt-0.5">No hours set</div>
              )}
            </div>
          );
        })}
      </div>

      <div ref={scrollRef} className="max-h-[640px] overflow-y-auto relative">
        <div
          className="grid relative"
          style={{
            gridTemplateColumns: `${TIME_COL_PX}px repeat(${columns.length}, ${scrolls ? `${minCol}px` : 'minmax(0, 1fr)'})`,
            height: `${totalHeight}px`,
            width: gridWidthPx ? `${gridWidthPx}px` : undefined,
          }}
        >
          {/* The lattice. A labelled line on the hour, a firmer one at the half,
              and light rules at the quarters so 15 minutes is readable without
              turning the grid into graph paper. */}
          {timeSlots.map((slot) => (
            <React.Fragment key={slot.hour}>
              <div
                className="text-[11px] font-medium text-gray-500 text-right pr-2 pt-0.5 border-t border-gray-200 border-r"
                style={{ height: `${HOUR_PX}px` }}
              >
                {slot.label}
              </div>
              {columns.map((col) => (
                <div
                  key={`${col.key}-${slot.hour}`}
                  className="border-t border-gray-200 border-r border-gray-100 relative"
                  style={{ height: `${HOUR_PX}px` }}
                >
                  <div className="absolute inset-x-0 top-1/4 border-t border-gray-100 pointer-events-none" />
                  <div className="absolute inset-x-0 top-1/2 border-t border-gray-200/70 pointer-events-none" />
                  <div className="absolute inset-x-0 top-3/4 border-t border-gray-100 pointer-events-none" />
                </div>
              ))}
            </React.Fragment>
          ))}

          <div
            ref={overlayRef}
            className="absolute inset-0"
            style={{ left: `${TIME_COL_PX}px`, touchAction: "none" }}
            onDragOver={handleOverlayDragOver}
            onDragLeave={handleOverlayDragLeave}
            onDrop={handleOverlayDrop}
            onPointerDown={handleOverlayPointerDown}
            onPointerMove={handleOverlayPointerMove}
            onPointerUp={handleOverlayPointerUp}
            onPointerLeave={() => setHoverSlot(null)}
            onPointerCancel={() => { setGhost(null); setResizing(null); setHoverSlot(null); }}
          >
            {/* Unavailable time, drawn as a hatch rather than a flat grey so it
                reads as "not bookable" instead of "no data". */}
            {columns.map((col, colIndex) =>
              (unavailableByColumn[col.key] || []).map(([gs, ge], i) => (
                <div
                  key={`off-${col.key}-${i}`}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${colIndex * colWidthPct}%`,
                    width: `${colWidthPct}%`,
                    top: `${yFor(gs)}px`,
                    height: `${((ge - gs) * HOUR_PX) / 60}px`,
                    backgroundImage:
                      "repeating-linear-gradient(45deg, rgba(148,163,184,.13) 0 6px, transparent 6px 12px)",
                    backgroundColor: "rgba(248,250,252,.7)",
                  }}
                />
              ))
            )}

            {/* Now line. `now` ticks, so this advances on its own. */}
            {(() => {
              const todayIdx = axis === "day"
                ? columns.findIndex((c) => c.isToday)
                : (date.toDateString() === now.toDateString() ? 0 : -1);
              if (todayIdx < 0) return null;
              const minutes = now.getHours() * 60 + now.getMinutes();
              if (minutes < openHour * 60 || minutes > closeHour * 60) return null;
              // In week mode the marker sits over today only, otherwise a red
              // line across all seven days says nothing about any of them.
              const span = axis === "day"
                ? { left: `${todayIdx * colWidthPct}%`, width: `${colWidthPct}%` }
                : { left: 0, right: 0 };
              return (
                <div className="absolute h-0.5 bg-red-500 z-30 pointer-events-none"
                     style={{ ...span, top: `${yFor(minutes)}px` }}>
                  <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
                  <div className={`absolute -top-2 text-[11px] font-semibold text-red-500 ${
                    axis === "day" ? "left-1.5" : "-left-14"
                  }`}>
                    {pad2(now.getHours())}:{pad2(now.getMinutes())}
                  </div>
                </div>
              );
            })()}

            {/* The 15 minute slot under the cursor. Shows the snapped target
                and its time, so you know what a click will book before you
                click it. Turns amber where the doctor is not working. */}
            {hoverSlot && !ghost && !resizing && (() => {
              const col = columns[hoverSlot.colIdx];
              const end = hoverSlot.startMin + SNAP_MINUTES;
              const free = isAvailableAt(col, hoverSlot.startMin, end);
              return (
                <div
                  className={`absolute pointer-events-none border transition-colors ${
                    free
                      ? "bg-[#2a276e]/[0.07] border-[#2a276e]/25"
                      : "bg-amber-400/10 border-amber-400/40"
                  }`}
                  style={{
                    left: `${hoverSlot.colIdx * colWidthPct + 0.4}%`,
                    width: `${colWidthPct - 0.8}%`,
                    top: `${yFor(hoverSlot.startMin)}px`,
                    height: `${(SNAP_MINUTES * HOUR_PX) / 60}px`,
                    zIndex: 5,
                  }}
                >
                  <span className={`absolute left-1.5 top-0.5 text-[10px] font-bold ${
                    free ? "text-[#2a276e]/70" : "text-amber-700"
                  }`}>
                    {hhmm(hoverSlot.startMin)}
                  </span>
                </div>
              );
            })()}

            {/* Drop-target highlight */}
            {columns.map((col, colIndex) => (
              <div
                key={`zone-${col.key}`}
                className={`absolute top-0 bottom-0 transition-colors ${
                  dragOverColIdx === colIndex ? "bg-[#9B8CFF]/15 ring-1 ring-[#2a276e]/40" : ""
                }`}
                style={{ left: `${colIndex * colWidthPct}%`, width: `${colWidthPct}%`, pointerEvents: "none" }}
              />
            ))}

            {/* The slot being dragged out. Turns amber where the doctor is not
                working, so the refusal is visible before the modal opens. */}
            {ghost && (() => {
              const col = columns[ghost.colIdx];
              const free = isAvailableAt(col, ghost.startMin, ghost.endMin);
              return (
                <div
                  className={`absolute rounded-lg border-2 border-dashed pointer-events-none z-40 flex items-start px-2 py-1 ${
                    free ? "border-[#2a276e] bg-[#2a276e]/10" : "border-amber-500 bg-amber-100/60"
                  }`}
                  style={{
                    left: `${ghost.colIdx * colWidthPct + 0.4}%`,
                    width: `${colWidthPct - 0.8}%`,
                    top: `${yFor(ghost.startMin)}px`,
                    height: `${Math.max(((ghost.endMin - ghost.startMin) * HOUR_PX) / 60, 20)}px`,
                  }}
                >
                  <span className={`text-[11px] font-bold ${free ? "text-[#2a276e]" : "text-amber-800"}`}>
                    {hhmm(ghost.startMin)} to {hhmm(ghost.endMin)}
                    {!free && " · not working"}
                  </span>
                </div>
              );
            })()}

            {/* Cards */}
            {columns.map((col, colIndex) => {
              const list = apptsByColumn[col.key] || [];
              const layout = layoutByColumn[col.key] || {};
              const COL_INSET = 0.4;
              const usable = colWidthPct - 2 * COL_INSET;

              return list.map((apt) => {
                const startMin = minutesFromMidnight(apt.startTime);
                const live = resizing && resizing.id === apt.id;
                const endMin = live ? resizing.endMin : minutesFromMidnight(apt.endTime);
                const top = yFor(startMin);
                const height = Math.max(((endMin - startMin) * HOUR_PX) / 60, 22);

                const { colIndex: subIdx = 0, colCount: subCount = 1 } = layout[apt.id] || {};
                const subWidth = usable / subCount;
                const leftPct = colIndex * colWidthPct + COL_INSET + subIdx * subWidth;

                return (
                  <div
                    key={apt.id}
                    data-appointment-card
                    className="absolute"
                    style={{
                      left: `${leftPct}%`, top: `${top}px`,
                      width: `${subWidth}%`, height: `${height}px`,
                      zIndex: live ? 25 : 10,
                    }}
                  >
                    <AppointmentCard
                      appointment={apt}
                      variant="week"
                      isDraggable={!!onReassign && !resizing}
                      onDragStart={(e) => handleCardDragStart(e, apt)}
                      onDragEnd={() => setDragOverColIdx(null)}
                      style={{ position: "absolute", inset: 0, minHeight: "22px" }}
                      onClick={() => !resizing && onAppointmentClick(apt, apt.id)}
                    />
                    {onResize && (
                      <div
                        onPointerDown={(e) => beginResize(e, apt, colIndex)}
                        title="Drag to change how long this takes"
                        className="absolute inset-x-0 bottom-0 h-2.5 cursor-ns-resize z-20 flex items-end justify-center group"
                      >
                        <span className="w-6 h-1 mb-0.5 rounded-full bg-white/70 group-hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                    {live && (
                      <span className="absolute -top-5 left-0 text-[11px] font-bold text-[#2a276e] bg-white px-1 rounded border border-gray-200 whitespace-nowrap">
                        {apt.startTime} to {hhmm(endMin)} · {endMin - startMin} min
                      </span>
                    )}
                  </div>
                );
              });
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayGrid;
