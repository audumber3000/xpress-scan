import React, { useCallback, useEffect, useState } from "react";
import { api, getFriendlyErrorMessage } from "../../../utils/api";
import { notify } from "../../../utils/notify";
import { toCalendarShape } from "../utils/appointmentShape";
import { dateKey } from "./useCalendarNavigation";

/**
 * The appointments on screen, and every way they change.
 *
 * Loading, moving, resizing, checking in and closing off all touch the same
 * list, so they belong together: each one updates optimistically and reverts on
 * refusal, which only works if they share the state they are reverting.
 *
 * `doctors` comes in rather than being fetched here, because a reassignment
 * needs to name the doctor it moved to and that roster is the clinic's, not
 * this list's.
 */
export default function useAppointments(currentDate, doctors, {
  // The drawer shows a copy of whichever appointment is open, so a status
  // change has to reach it as well as the list. Passed in rather than owned
  // here: which appointment is open is the page's question, not this list's.
  setSelectedAppointment = () => {},
  setCancelPrompt = () => {},
} = {}) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [needsOutcome, setNeedsOutcome] = useState({ count: 0, appointments: [] });
  const [outcomeBusy, setOutcomeBusy] = useState(false);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      // The visible month, padded by a week at each end.
      //
      // Two bugs lived in the unpadded version. A week straddling a month
      // boundary shows days from both months, and only one was ever fetched, so
      // half the week silently rendered as empty. And the keys were built with
      // toISOString, which resolves in UTC: at IST (+5:30) local midnight on the
      // 1st is 18:30 on the previous day, so both ends shifted back one and the
      // last day of every month was never requested at all.
      //
      // The padding covers the straddle in a single request, and the keys are
      // now built from local parts so the range means what it says.
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1 - 7);
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0 + 7);

      const dateFrom = dateKey(firstDay);
      const dateTo = dateKey(lastDay);

      const response = await api.get('/appointments', {
        params: { date_from: dateFrom, date_to: dateTo }
      });
      
      const transformedAppointments = response.map(toCalendarShape);
      
      console.log('✅ Fetched appointments from API:', response.length);
      console.log('📊 Transformed appointments:', transformedAppointments);
      setAppointments(transformedAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  const checkTimeConflict = (date, startTime, endTime, doctorId = null, excludeId = null) => {
    const timeToMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);

    const dateStr = date;
    const dayAppointments = appointments.filter(apt => {
      const aptDate = dateKey(new Date(apt.date));
      return aptDate === dateStr && apt.id !== excludeId;
    });

    const targetDoctor = doctorId ? Number(doctorId) : null;

    for (const apt of dayAppointments) {
      // Only count as conflict if both refer to the same resource:
      // - same doctor id, OR
      // - both unassigned (both null)
      const aptDoctor = apt.doctor_id ? Number(apt.doctor_id) : null;
      if (aptDoctor !== targetDoctor) continue;

      const aptStart = timeToMinutes(apt.startTime);
      const aptEnd = timeToMinutes(apt.endTime);

      if (
        (newStart >= aptStart && newStart < aptEnd) ||
        (newEnd > aptStart && newEnd <= aptEnd) ||
        (newStart <= aptStart && newEnd >= aptEnd)
      ) {
        return {
          hasConflict: true,
          conflictingAppointment: apt
        };
      }
    }

    return { hasConflict: false };
  };

  const handleReassign = async (appointmentId, newDoctorId, newStartTime, newDateStr) => {
    const apt = appointments.find(a => a.id === appointmentId);
    if (!apt) return;

    // Compute new end time by preserving the original duration.
    const toMinutes = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const fromMinutes = (mins) =>
      `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    const durationMins = toMinutes(apt.endTime) - toMinutes(apt.startTime);
    const newEndTime = fromMinutes(toMinutes(newStartTime) + durationMins);

    // newDateStr is set when the drag crossed into another day column.
    const dateStr = newDateStr || dateKey(new Date(apt.date));
    const targetDoctorId = newDoctorId ? Number(newDoctorId) : null;

    const sameDay = dateStr === dateKey(new Date(apt.date));
    // No-op detection (same doctor, same day, same time) — avoid a wasted PUT.
    if (targetDoctorId === (apt.doctor_id || null) && newStartTime === apt.startTime && sameDay) {
      return;
    }

    // Per-doctor conflict check on the destination.
    const conflict = checkTimeConflict(dateStr, newStartTime, newEndTime, targetDoctorId, appointmentId);
    if (conflict.hasConflict) {
      const c = conflict.conflictingAppointment;
      notify.problem(
        <div>
          <div className="font-semibold">Cannot move here</div>
          <div className="text-sm mt-1">
            Overlaps with {c.patientName} ({c.doctor}) at {c.startTime} to {c.endTime}.
          </div>
        </div>
      );
      return;
    }

    // Optimistic update so the UI feels instant.
    const targetDoctor = doctors.find(d => d.id === targetDoctorId);
    const previous = apt;
    const updated = {
      ...apt,
      doctor_id: targetDoctorId,
      doctor: targetDoctor?.name || apt.doctor,
      startTime: newStartTime,
      endTime: newEndTime,
      // Carry the day too, or a card dragged across the week snaps back to its
      // old column until the next refetch.
      date: sameDay ? apt.date : dateStr,
    };
    setAppointments(prev => prev.map(a => (a.id === appointmentId ? updated : a)));

    try {
      const payload = {
        doctor_id: targetDoctorId,
        appointment_date: dateStr,
        start_time: newStartTime,
        end_time: newEndTime,
        duration: durationMins,
      };
      const response = await api.put(`/appointments/${appointmentId}`, payload);
      // Reconcile with the server's authoritative response (doctor name, etc.).
      setAppointments(prev => prev.map(a => (a.id === appointmentId ? {
        ...a,
        doctor_id: response.doctor_id || null,
        doctor: response.doctor_name || 'Unassigned',
        startTime: response.start_time,
        endTime: response.end_time,
        date: response.appointment_date,
      } : a)));
    } catch (error) {
      console.error('Failed to reassign appointment:', error);
      notify.reverted(getFriendlyErrorMessage(error, 'Could not move that appointment, so it went back'));
      // Revert the optimistic change.
      setAppointments(prev => prev.map(a => (a.id === appointmentId ? previous : a)));
    }
  };

  const handleResize = async (appointmentId, newEndTime) => {
    const apt = appointments.find(a => a.id === appointmentId);
    if (!apt || newEndTime === apt.endTime) return;

    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const duration = toMin(newEndTime) - toMin(apt.startTime);
    if (duration < 5) return;

    const previous = apt;
    setAppointments(prev => prev.map(a =>
      a.id === appointmentId ? { ...a, endTime: newEndTime, duration } : a));

    try {
      await api.put(`/appointments/${appointmentId}`, {
        end_time: newEndTime,
        duration,
        start_time: apt.startTime,
        appointment_date: dateKey(new Date(apt.date)),
      });
    } catch (err) {
      // Revert. The server enforces availability and clashes, so a refusal
      // here is a real answer rather than a glitch, and the card should snap
      // back to what is actually stored.
      setAppointments(prev => prev.map(a => (a.id === appointmentId ? previous : a)));
      notify.reverted(getFriendlyErrorMessage(err, 'Could not change that length, so it went back'));
    }
  };

  const applyOutcome = async (appointmentId, status, cancelReason) => {
    setOutcomeBusy(true);
    try {
      await api.post(`/appointments/${appointmentId}/outcome`, {
        status, cancel_reason: cancelReason || null,
      });
      setAppointments(prev => prev.map(a => (a.id === appointmentId ? { ...a, status } : a)));
      setSelectedAppointment(prev =>
        prev && prev.id === appointmentId ? { ...prev, status } : prev);
      loadNeedsOutcome();
      // The card's own status chip changes as this returns.
    } catch (err) {
      notify.problem(err, 'Could not record that outcome');
    } finally {
      setOutcomeBusy(false);
      setCancelPrompt(null);
    }
  };

  /**
   * Move an appointment to a status that is still open.
   *
   * Deliberately NOT the /outcome endpoint. That one rejects anything outside
   * completed / no_show / cancelled with a 400, so "Reopen" was posting
   * `confirmed` to it and failing every time. Reopening is not recording an
   * outcome, it is clearing one, and the general update endpoint is what knows
   * to wipe outcome_at, outcome_by and the cancellation reason on the way
   * through.
   *
   * Confirming a booking is the same write, so it shares this rather than
   * keeping a near-identical copy that could drift.
   */
  const setOpenStatus = async (appointmentId, status = 'confirmed') => {
    setOutcomeBusy(true);
    try {
      await api.put(`/appointments/${appointmentId}`, { status });
      setAppointments(prev =>
        prev.map(a => (a.id === appointmentId ? { ...a, status } : a)));
      setSelectedAppointment(prev =>
        prev && prev.id === appointmentId ? { ...prev, status } : prev);
      loadNeedsOutcome();
    } catch (err) {
      notify.problem(err, 'Could not update that appointment');
    } finally {
      setOutcomeBusy(false);
    }
  };

  const checkIn = async (appointment, doctorId = null) => {
    setOutcomeBusy(true);
    try {
      // A patient in the chair belongs to somebody. Checking in without a
      // doctor left an arrived appointment nobody owned, which then sat in the
      // unassigned column while the patient waited.
      const assigned = doctorId ? Number(doctorId) : (appointment.doctor_id || null);
      await api.put(`/appointments/${appointment.id}`, {
        status: 'arrived',
        ...(assigned && !appointment.doctor_id ? { doctor_id: assigned } : {}),
      });
      const named = assigned
        ? (doctors.find((d) => d.id === assigned)?.name || 'Unassigned')
        : null;
      const patch = {
        status: 'arrived',
        ...(assigned && !appointment.doctor_id ? { doctor_id: assigned, doctor: named } : {}),
      };
      setAppointments(prev =>
        prev.map(a => (a.id === appointment.id ? { ...a, ...patch } : a)));
      setSelectedAppointment(prev =>
        prev && prev.id === appointment.id ? { ...prev, ...patch } : prev);
      // The card's green badge is the confirmation, so nothing is announced.
    } catch (err) {
      notify.problem(err, 'Could not check them in');
    } finally {
      setOutcomeBusy(false);
    }
  };

  const loadNeedsOutcome = useCallback(async () => {
    try {
      setNeedsOutcome(await api.get('/appointments/needs-outcome'));
    } catch {
      setNeedsOutcome({ count: 0, appointments: [] });
    }
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);
  useEffect(() => { loadNeedsOutcome(); }, [loadNeedsOutcome]);

  return {
    appointments, setAppointments,
    loading,
    needsOutcome, loadNeedsOutcome,
    outcomeBusy,
    fetchAppointments,
    handleReassign, handleResize, applyOutcome, checkIn, setOpenStatus,
    checkTimeConflict,
  };
}
