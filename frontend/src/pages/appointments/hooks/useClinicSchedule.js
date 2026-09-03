import { useCallback, useEffect, useState } from "react";
import { api, getFriendlyErrorMessage } from "../../../utils/api";
import { dateKey } from "./useCalendarNavigation";

/**
 * The clinic the calendar is drawing: its hours, its people, its treatments,
 * and who is actually working on the day in view.
 *
 * All of it is reference data the grid reads and nothing writes, which is why
 * it lifts out of the page as one concern rather than four scattered fetches.
 */

const DEFAULT_TIMINGS = {
  monday: { open: '08:00', close: '20:00', closed: false },
  tuesday: { open: '08:00', close: '20:00', closed: false },
  wednesday: { open: '08:00', close: '20:00', closed: false },
  thursday: { open: '08:00', close: '20:00', closed: false },
  friday: { open: '08:00', close: '20:00', closed: false },
  saturday: { open: '08:00', close: '20:00', closed: false },
  sunday: { open: '08:00', close: '20:00', closed: true },
};

export default function useClinicSchedule(currentDate) {
  const [clinicData, setClinicData] = useState(null);
  const [clinicTimings, setClinicTimings] = useState(DEFAULT_TIMINGS);
  const [treatmentTypes, setTreatmentTypes] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctorsError, setDoctorsError] = useState('');
  const [dayShape, setDayShape] = useState(null);
  const [selectedDoctorIds, setSelectedDoctorIds] = useState(() => new Set());

  const fetchClinicData = useCallback(async () => {
    try {
      const response = await api.get('/clinics/me');
      setClinicData(response);
      if (response.timings) setClinicTimings(response.timings);
    } catch (error) {
      console.error('Error fetching clinic data:', error);
    }
  }, []);

  const fetchTreatmentTypes = useCallback(async () => {
    try {
      setTreatmentTypes(await api.get('/treatment-types/'));
    } catch (error) {
      console.error('Error fetching treatment types:', error);
      setTreatmentTypes([]);
    }
  }, []);

  const fetchDoctors = useCallback(async () => {
    try {
      // /clinic-users/bookable, not /clinic-users. The latter is gated on
      // users.view because it carries salaries, so every receptionist got a
      // 403, the catch below turned that into an empty array, and the booking
      // form rendered an empty doctor dropdown with every card reading
      // "Unassigned". This one returns names only and is open to anyone who
      // works at the clinic.
      //
      // The role filter that used to live here is gone with it: it kept only
      // 'doctor' and 'clinic_owner', so in-house doctors and associates were
      // dropped from the dropdown for everybody, owners included. The server
      // decides who is bookable now, in one place.
      const response = await api.get('/clinic-users/bookable');
      setDoctors(response);
      setDoctorsError('');
      // Default the visibility filter to "everyone on" the first time we learn
      // who exists. Only when the set is still empty, so a refetch never
      // silently undoes the user's own toggles.
      setSelectedDoctorIds((prev) =>
        prev.size > 0 ? prev : new Set(response.map((d) => d.id))
      );
    } catch (error) {
      // Said out loud rather than swallowed. An empty dropdown that explains
      // nothing is what let this sit broken: the page looked like a clinic
      // with no doctors instead of a request that failed.
      console.error('Error fetching doctors:', error);
      setDoctorsError(getFriendlyErrorMessage(error, "We couldn't load the doctor list."));
    }
  }, []);

  useEffect(() => {
    fetchClinicData();
    fetchTreatmentTypes();
    fetchDoctors();
  }, [fetchClinicData, fetchTreatmentTypes, fetchDoctors]);

  // Working hours per doctor for the day on screen, so the grid can shade time
  // nobody is available for. One request rather than one per doctor.
  useEffect(() => {
    let cancelled = false;
    // dateKey, not toISOString: the latter resolves in UTC, so at IST the day
    // shape for the 14th was fetched for the 13th.
    api.get('/scheduling/day-shape', { params: { on: dateKey(currentDate) } })
      .then((res) => { if (!cancelled) setDayShape(res); })
      .catch(() => { if (!cancelled) setDayShape(null); });
    return () => { cancelled = true; };
  }, [currentDate]);

  return {
    clinicData,
    clinicTimings,
    treatmentTypes,
    doctors,
    doctorsError,
    dayShape,
    selectedDoctorIds,
    setSelectedDoctorIds,
  };
}
