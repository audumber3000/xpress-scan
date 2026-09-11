import React, { useState } from 'react';
import { CalendarDays, UserRoundCheck, Camera, X } from 'lucide-react';
import PatientHeaderActions from './PatientHeaderActions';
import PatientHeaderStats from './PatientHeaderStats';
import PatientSafetyBand from './PatientSafetyBand';
import { generatePatientPersona, generateInitialsAvatar } from '../../utils/avatar';
import { formatDate } from '../../utils/datetime';
import PatientPhoto from '../patients/PatientPhoto';

/**
 * The patient file's header: who this is, how they stand, what is dangerous
 * about them, and what you can do.
 *
 * One card rather than a bare row, so the whole block reads as the patient
 * record and the tab strip below it clearly belongs to the page. Border only,
 * never a shadow — that is the house rule for cards here.
 *
 * No "Active" pill, though the reference had one. There is no patient status
 * column anywhere in the schema, so it could only ever be a guess dressed as a
 * fact about somebody's file.
 */
const Meta = ({ icon, children }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
    <span className="text-gray-400 flex-shrink-0">{icon}</span>
    <span className="truncate" title={typeof children === 'string' ? children : undefined}>{children}</span>
  </span>
);

const PatientFileHeader = ({
  patient,
  user,
  lastVisit,
  nextAppointment,
  outstanding,
  onBack,
  onEdit,
  onPrint,
  onDelete,
  onViewBilling,
  onPhotoChange,
}) => {
  const [photoOpen, setPhotoOpen] = useState(false);
  const chips = [
    patient.display_id ? `#${patient.display_id}` : null,
    patient.age ? `${patient.age} yrs` : null,
    patient.gender,
    patient.phone,
  ].filter(Boolean);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 mb-4">
      {/* Back and the action cluster sit above the record itself, so the
          patient's name is the first thing in the card rather than competing
          with navigation. */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-[#2a276e] transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Patients
        </button>
        <PatientHeaderActions
          patient={patient}
          user={user}
          onEdit={onEdit}
          onPrint={onPrint}
          onDelete={onDelete}
        />
      </div>

      <div className="flex flex-col xl:flex-row xl:items-start gap-5">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          {/* The real face when the clinic has one, the generated persona when
              not. The persona is a fallback, never a replacement: a clinic that
              has taken a photo wants to see the patient, not an illustration
              that happens to be the right colour. */}
          {/* The photo opens large, with the controls to change it right there.
              A 72px thumbnail is enough to spot the patient in a list and not
              enough to be sure it is them; this is where you check. */}
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            title={patient.photo_url ? 'View or change photo' : 'Add a photo'}
            className="relative group flex-shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/30"
          >
            <img
              src={patient.photo_url || generatePatientPersona(patient, 128)}
              onError={(e) => {
                e.target.onerror = null;
                // A photo whose signed link has aged out falls back through the
                // same two steps rather than leaving a broken-image icon in the
                // middle of the patient's file.
                e.target.src = patient.photo_url
                  ? generatePatientPersona(patient, 128)
                  : generateInitialsAvatar(patient.name || 'Patient');
              }}
              alt={patient.name}
              className={`w-16 h-16 md:w-[72px] md:h-[72px] ${patient.photo_url ? 'rounded-lg' : 'rounded-full'} object-cover border border-gray-100 bg-[#9B8CFF]/15 flex-shrink-0`}
            />
            <span className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/35 transition-colors grid place-items-center">
              <Camera size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight truncate" title={patient.name}>
              {patient.name}
            </h1>

            {/* Separate chips, not one run-on sentence: each of these is a
                different kind of fact and the eye picks one out at a time. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-sm text-gray-600">
              {chips.map((chip, i) => (
                <React.Fragment key={chip}>
                  {i > 0 && <span className="text-gray-300">•</span>}
                  <span className={i === 0 ? 'font-semibold text-gray-700' : 'font-medium'}>{chip}</span>
                </React.Fragment>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              {patient.registered_on && (
                <Meta icon={<CalendarDays size={13} />}>Patient since {formatDate(patient.registered_on)}</Meta>
              )}
              {patient.referred_by && (
                <Meta icon={<UserRoundCheck size={13} />}>Referred by {patient.referred_by}</Meta>
              )}
            </div>
          </div>
        </div>

        {/* Wide enough that three dates and an amount never need to clip.
            Below xl it drops under the identity block and takes the full row. */}
        <div className="xl:w-[36rem] xl:flex-shrink-0">
          <PatientHeaderStats
            lastVisit={lastVisit}
            nextAppointment={nextAppointment}
            outstanding={outstanding}
            onViewBilling={onViewBilling}
          />
        </div>
      </div>

      <PatientSafetyBand
        allergies={patient.allergies}
        medicalHistory={patient.patient_history}
        bloodGroup={patient.blood_group}
        className="mt-4"
      />

      {/* The photo, large, and everything you can do to it. A centred modal
          rather than a drawer: it edits something that already exists. */}
      {photoOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPhotoOpen(false)} />
          {/* The photo runs to the top, left and right edges; the card's own
              rounded corners and overflow-hidden are its only frame. The name
              moved underneath so nothing sits between you and the face, and the
              close button floats over the photo rather than taking a bar. */}
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setPhotoOpen(false)}
              title="Close"
              className="absolute top-3 right-3 z-10 w-9 h-9 grid place-items-center rounded-full bg-black/40 hover:bg-black/55 text-white backdrop-blur-sm transition-colors"
            >
              <X size={18} />
            </button>
            <PatientPhoto
              patientId={patient.id}
              value={patient.photo_url || null}
              layout="hero"
              caption={(
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 truncate">{patient.name}</h2>
                  <p className="text-xs text-gray-500">
                    {patient.photo_url ? 'Patient photo' : 'No photo yet'}
                  </p>
                </div>
              )}
              onChange={(next) => onPhotoChange?.(next.photo_url ?? null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientFileHeader;
