import React, { useEffect, useMemo, useRef, useState } from "react";
import AppointmentCard from "./AppointmentCard";
import { getDoctorColor, UNASSIGNED_STYLE } from "../utils/doctorColors";
import { computeDayLayout } from "../utils/layout";

const HOUR_PX = 80; // matches the week-grid scale so cards feel consistent across views
const SNAP_MINUTES = 15;
const pad2 = (n) => String(n).padStart(2, "0");

const formatHourLabel = (hour) => {
  if (hour === 12) return "12:00 PM";
  if (hour > 12) return `${hour - 12}:00 PM`;
  return `${hour}:00 AM`;
};

const minutesFromMidnight = (hhmm) => {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Single-day, multi-resource grid. Columns are doctors (plus an optional
 * "Unassigned" column on the right for public bookings without a doctor yet).
 * Each appointment is positioned absolutely in its doctor's column at its time.
 */
const DayGrid = ({
  date,
  appointments,
  doctors,
  selectedDoctorIds,
  showUnassigned,
  unassignedCount,
  onAppointmentClick,
  clinicTimings,
  onReassign,
}) => {
  // Drag-and-drop state. While a drag is in progress we highlight the target
  // column to give the user a clear "drop here" affordance.
  const [dragOverColIdx, setDragOverColIdx] = useState(null);
  const overlayRef = useRef(null);
  const scrollRef = useRef(null);
  // Determine the visible columns: in-order list of doctors that are toggled
  // on, then optionally an "Unassigned" trailing column.
  const visibleDoctors = useMemo(
    () => doctors.filter((d) => selectedDoctorIds.has(d.id)),
    [doctors, selectedDoctorIds]
  );

  const showUnassignedCol = showUnassigned && unassignedCount > 0;
  const columns = useMemo(() => {
    const list = visibleDoctors.map((d) => ({
      key: `doc-${d.id}`,
      doctorId: d.id,
      label: d.name || d.email || `Doctor #${d.id}`,
      color: getDoctorColor(d.id),
    }));
    if (showUnassignedCol) {
      list.push({
        key: "unassigned",
        doctorId: null,
        label: "Unassigned",
        color: UNASSIGNED_STYLE,
      });
    }
    return list;
  }, [visibleDoctors, showUnassignedCol]);

  // Compute time bounds from clinic timings for the given day.
  const { openHour, closeHour } = useMemo(() => {
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const t = clinicTimings?.[dayName];
    const open = (t?.open || "08:00").split(":").map(Number)[0];
    const close = (t?.close || "20:00").split(":").map(Number)[0];
    return { openHour: open, closeHour: Math.max(close, open + 1) };
  }, [date, clinicTimings]);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = openHour; h <= closeHour; h++) {
      slots.push({ hour: h, label: formatHourLabel(h) });
    }
    return slots;
  }, [openHour, closeHour]);

  // On mount (and whenever the date or hours change), scroll the inner
  // container so the current hour is roughly centered. Keeps users from
  // landing at 8 AM every time they open the day view.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const y = ((minutes - openHour * 60) * HOUR_PX) / 60 - 200;
    node.scrollTop = Math.max(0, y);
  }, [openHour, closeHour, date]);

  // Filter appointments to the given date and bucket them into their column.
  const targetDateStr = date.toISOString().split("T")[0];
  const dayAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const d = a.date ? new Date(a.date).toISOString().split("T")[0] : null;
      return d === targetDateStr;
    });
  }, [appointments, targetDateStr]);

  const apptsByColumn = useMemo(() => {
    const map = {};
    columns.forEach((c) => (map[c.key] = []));
    dayAppointments.forEach((a) => {
      const key = a.doctor_id ? `doc-${a.doctor_id}` : "unassigned";
      if (map[key]) map[key].push(a);
    });
    return map;
  }, [dayAppointments, columns]);

  // Per-column overlap layout (two appointments same doctor + same time → side-by-side within that column).
  const layoutByColumn = useMemo(() => {
    const map = {};
    Object.entries(apptsByColumn).forEach(([k, list]) => {
      map[k] = computeDayLayout(list);
    });
    return map;
  }, [apptsByColumn]);

  // ─── Drag and drop helpers ───────────────────────────────────────────────
  // Translates the cursor position over the overlay into a target column +
  // start time (snapped to 15-minute increments).
  const computeDropTarget = (clientX, clientY) => {
    const node = overlayRef.current;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const xPct = ((clientX - rect.left) / rect.width) * 100;
    const yPx = clientY - rect.top;

    const colWidthPct = 100 / columns.length;
    const colIdx = Math.max(0, Math.min(columns.length - 1, Math.floor(xPct / colWidthPct)));

    const totalMinutes = openHour * 60 + (yPx / HOUR_PX) * 60;
    const clamped = Math.max(openHour * 60, Math.min(closeHour * 60, totalMinutes));
    const snapped = Math.round(clamped / SNAP_MINUTES) * SNAP_MINUTES;
    const newStart = `${pad2(Math.floor(snapped / 60))}:${pad2(snapped % 60)}`;

    return { col: columns[colIdx], colIdx, newStart };
  };

  const handleCardDragStart = (e, apt) => {
    if (!onReassign) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/appointmentId", String(apt.id));
    // Keep a tiny synchronous state hint for the visual highlight effect.
    setDragOverColIdx(null);
  };

  const handleCardDragEnd = () => {
    setDragOverColIdx(null);
  };

  const handleOverlayDragOver = (e) => {
    if (!onReassign) return;
    const target = computeDropTarget(e.clientX, e.clientY);
    if (!target) return;
    // Don't allow dropping on the Unassigned column — backend PUT skips null
    // doctor_id, so it would be a silent no-op. Show the not-allowed cursor.
    if (target.col.doctorId === null) {
      e.dataTransfer.dropEffect = "none";
      setDragOverColIdx(null);
      return;
    }
    e.preventDefault(); // signal that this is a valid drop target
    e.dataTransfer.dropEffect = "move";
    setDragOverColIdx(target.colIdx);
  };

  const handleOverlayDragLeave = (e) => {
    // Only clear the highlight when the cursor exits the overlay entirely,
    // not when it moves over a child element.
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverColIdx(null);
  };

  const handleOverlayDrop = (e) => {
    if (!onReassign) return;
    e.preventDefault();
    const idStr = e.dataTransfer.getData("text/appointmentId");
    const id = parseInt(idStr, 10);
    if (Number.isNaN(id)) { setDragOverColIdx(null); return; }
    const target = computeDropTarget(e.clientX, e.clientY);
    setDragOverColIdx(null);
    if (!target || target.col.doctorId === null) return;
    onReassign(id, target.col.doctorId, target.newStart);
  };

  if (columns.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-lg border-2 border-dashed border-gray-300">
        <h3 className="text-lg font-semibold text-gray-700 mb-1">No team members visible</h3>
        <p className="text-sm text-gray-500">
          Select at least one doctor (or toggle Unassigned) in the left rail to see appointments.
        </p>
      </div>
    );
  }

  const totalHeight = (closeHour - openHour) * HOUR_PX;
  const TIME_COL_PX = 72;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Column headers — sticky so they stay visible when scrolling the grid */}
      <div
        className="grid bg-gray-50 border-b border-gray-200 sticky top-0 z-20"
        style={{ gridTemplateColumns: `${TIME_COL_PX}px repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        <div className="px-2 py-3 text-[11px] font-semibold text-gray-500 text-center border-r border-gray-200">
          Time
        </div>
        {columns.map((col) => (
          <div
            key={col.key}
            className={`px-3 py-3 text-center border-r border-gray-100 ${
              col.color.isUnassigned ? "bg-amber-50" : ""
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${col.color.dot}`}></span>
              <span
                className={`text-sm font-semibold truncate ${
                  col.color.isUnassigned ? "text-amber-800" : "text-gray-800"
                }`}
              >
                {col.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable grid body */}
      <div ref={scrollRef} className="max-h-[640px] overflow-y-auto relative">
        <div
          className="grid relative"
          style={{
            gridTemplateColumns: `${TIME_COL_PX}px repeat(${columns.length}, minmax(0, 1fr))`,
            height: `${totalHeight}px`,
          }}
        >
          {/* Time labels + empty hour cells for each column (half-hour dashed divider inside) */}
          {timeSlots.map((slot) => (
            <React.Fragment key={slot.hour}>
              <div
                className="text-xs font-medium text-gray-500 text-right pr-2 pt-1 border-t border-gray-100 border-r border-gray-200"
                style={{ height: `${HOUR_PX}px` }}
              >
                {slot.label}
              </div>
              {columns.map((col) => (
                <div
                  key={`${col.key}-${slot.hour}`}
                  className="border-t border-gray-100 border-r border-gray-100 relative"
                  style={{ height: `${HOUR_PX}px` }}
                >
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-gray-100 pointer-events-none" />
                </div>
              ))}
            </React.Fragment>
          ))}

          {/* Absolute-positioned drop zones + appointment cards layered over the grid */}
          <div
            ref={overlayRef}
            className="absolute inset-0 pointer-events-auto"
            style={{ left: `${TIME_COL_PX}px` }}
            onDragOver={handleOverlayDragOver}
            onDragLeave={handleOverlayDragLeave}
            onDrop={handleOverlayDrop}
          >
            {/* Current-time indicator — only shown when this grid is for today */}
            {(() => {
              const now = new Date();
              const isToday = date.toDateString() === now.toDateString();
              if (!isToday) return null;
              const minutes = now.getHours() * 60 + now.getMinutes();
              if (minutes < openHour * 60 || minutes > closeHour * 60) return null;
              const top = ((minutes - openHour * 60) * HOUR_PX) / 60;
              const label = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
              return (
                <div
                  className="absolute left-0 right-0 h-0.5 bg-red-500 z-30 pointer-events-none"
                  style={{ top: `${top}px` }}
                >
                  <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
                  <div className="absolute -left-12 -top-2 text-[11px] font-semibold text-red-500">
                    {label}
                  </div>
                </div>
              );
            })()}
            {/* Per-column drop highlight tiles — these sit underneath the
                cards and get a tinted background while a card is dragged
                over the column. */}
            {columns.map((col, colIndex) => {
              const colWidthPct = 100 / columns.length;
              const isOver = dragOverColIdx === colIndex;
              return (
                <div
                  key={`zone-${col.key}`}
                  className={`absolute top-0 bottom-0 transition-colors ${
                    isOver ? "bg-[#9B8CFF]/15 ring-1 ring-[#2a276e]/40" : ""
                  }`}
                  style={{
                    left: `${colIndex * colWidthPct}%`,
                    width: `${colWidthPct}%`,
                    pointerEvents: "none",
                  }}
                />
              );
            })}

            {columns.map((col, colIndex) => {
              const list = apptsByColumn[col.key] || [];
              const layout = layoutByColumn[col.key] || {};
              const COL_INSET = 0.4; // percent — keeps cards from touching column borders
              const colWidthPct = 100 / columns.length;
              const usable = colWidthPct - 2 * COL_INSET;

              return list.map((apt) => {
                const startMin = minutesFromMidnight(apt.startTime);
                const endMin = minutesFromMidnight(apt.endTime);
                const top = ((startMin - openHour * 60) * HOUR_PX) / 60;
                const height = Math.max(((endMin - startMin) * HOUR_PX) / 60, 22);

                const { colIndex: subIdx = 0, colCount: subCount = 1 } =
                  layout[apt.id] || {};
                const subWidth = usable / subCount;
                const leftPct = colIndex * colWidthPct + COL_INSET + subIdx * subWidth;

                return (
                  <AppointmentCard
                    key={apt.id}
                    appointment={apt}
                    variant="week"
                    isDraggable={!!onReassign}
                    onDragStart={(e) => handleCardDragStart(e, apt)}
                    onDragEnd={handleCardDragEnd}
                    style={{
                      left: `${leftPct}%`,
                      top: `${top}px`,
                      width: `${subWidth}%`,
                      height: `${height}px`,
                      minHeight: "22px",
                      zIndex: 10,
                    }}
                    onClick={() => onAppointmentClick(apt)}
                  />
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
