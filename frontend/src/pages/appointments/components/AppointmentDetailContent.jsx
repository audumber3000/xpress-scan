import React, { useEffect, useState } from "react";
import WhatsAppIcon from '../../../components/common/WhatsAppIcon';
import { useNavigate } from "react-router-dom";
import {
  Pencil, Phone, Copy, FileText, ExternalLink, CalendarPlus, ThumbsUp,
  CheckCircle, UserPlus, Save, Check, X, Play,
} from "lucide-react";
import { api } from "../../../utils/api";
import { notify } from "../../../utils/notify";
import { openWhatsApp } from "../../../utils/whatsapp";
import { formatMoney } from "../../../utils/currency";

/**
 * Everything about one appointment, without leaving the calendar.
 *
 * Content only: no backdrop, no positioning, no shell. It is rendered by the
 * anchored popover on a desktop and by the bottom sheet on a phone, and it
 * assumes its parent is a flex column with a bounded height, because the middle
 * section scrolls while the header and the actions stay put.
 *
 * A doctor should not open three screens to answer "who is this, what do they
 * owe, when were they last in, and where did they come from". Those are the
 * questions asked at the chair, so they are all on this one panel, in a fact
 * grid rather than a stack of one-fact rows: the earlier version spent a full
 * line each on "Doctor:", "Chair Number:", "Patient Age:" and "Village:", four
 * lines carrying four words, and then ran out of room for anything useful.
 */

// Same vocabulary and colours as AppointmentCard, so a chip and this panel can
// never disagree about what a status looks like.
const STATUS_LABEL = {
  scheduled: { text: 'Scheduled', className: 'text-gray-600', dot: 'bg-gray-400' },
  confirmed: { text: 'Confirmed', className: 'text-[#2a276e]', dot: 'bg-[#2a276e]' },
  arrived: { text: 'Arrived', className: 'text-green-700', dot: 'bg-green-500' },
  completed: { text: 'Seen', className: 'text-emerald-700', dot: 'bg-emerald-600' },
  no_show: { text: 'Did not attend', className: 'text-amber-700', dot: 'bg-amber-500' },
  cancelled: { text: 'Cancelled', className: 'text-gray-500', dot: 'bg-gray-400' },
};
const CLOSED = ['completed', 'no_show', 'cancelled'];

const toMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${period}`;
};

const durationOf = (a) => {
  if (Number(a?.duration) > 0) return Number(a.duration);
  const span = toMinutes(a?.endTime) - toMinutes(a?.startTime);
  return span > 0 ? span : 30;
};

/** "12 Aug", or "12 Aug 2025" once the year stops being obvious. */
const shortDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  });
};

const relativeDay = (value) => {
  if (!value) return null;
  const d = new Date(value); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((today - d) / 86400000);
  // A last visit dated ahead of today is not a visit yet. Imported rows and
  // rows stamped from a future appointment both do this, and the arithmetic
  // ran straight through it and printed "-3 days ago".
  if (days < 0) return null;
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
};

const sexLabel = (g) => {
  const v = String(g || '').trim().toLowerCase();
  if (v.startsWith('m')) return 'M';
  if (v.startsWith('f')) return 'F';
  return v ? v.charAt(0).toUpperCase() : '';
};

/**
 * How the patient reached the clinic.
 *
 * `referred_by` is a free string that imports and older builds filled with
 * whatever they liked, so it is normalised for display rather than trusted.
 */
const SOURCE_LABEL = {
  walkin: 'Walk-in', 'walk-in': 'Walk-in', direct: 'Walk-in',
  online: 'Online booking', website: 'Website', web: 'Website',
  whatsapp: 'WhatsApp', phone: 'Phone', call: 'Phone',
  google: 'Google', instagram: 'Instagram', facebook: 'Facebook',
  referral: 'Referral', doctor: 'Doctor referral',
};
const sourceOf = (appointment, patient) => {
  // An unassigned booking is how a public booking arrives, so it is the only
  // honest signal we have that nobody at the desk created it.
  const raw = patient?.referred_by || appointment?.patientReferredBy || '';
  const key = String(raw).trim().toLowerCase();
  if (key) return SOURCE_LABEL[key] || raw;
  if (!appointment?.doctor_id) return 'Online booking';
  return null;
};

/** One tap that confirms at the control, rather than by toast. */
const IconAction = ({ title, onClick, children, done, tone = 'default' }) => (
  <button
    type="button" onClick={onClick} title={title} aria-label={title}
    className={`w-8 h-8 rounded-lg border transition-colors inline-flex items-center justify-center ${
      tone === 'whatsapp'
        ? 'border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300'
        : 'border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300'
    }`}
  >
    {done ? <Check size={14} className="text-green-600" /> : children}
  </button>
);

/**
 * One fact, label left and value right.
 *
 * It used to be a two-column grid inside a bordered box. A box inside a box
 * inside the card was three borders deep for four words, and it printed "Not
 * set" and "Not recorded" as though an empty field were news. Rows separated by
 * rules read faster and cost less height.
 */
const Fact = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 py-[3px]">
    <span className="text-[13px] text-gray-500 flex-shrink-0">{label}</span>
    <span className="text-[13px] text-gray-900 text-right truncate min-w-0">{children}</span>
  </div>
);

const AppointmentDetailContent = ({
  appointment, doctors = [], onClose, onCheckIn, onStartVisit, onCreatePatientFile,
  onApplyOutcome, onReopen, onConfirm, onBookAgain, onRequestCancel, onEdit, outcomeBusy,
  details, setDetails, saveDetails, detailsSaving,
}) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [owed, setOwed] = useState(null);
  // The patient's own record: file number, last visit, source and the gender
  // that is actually stored. The appointment carries a snapshot of some of
  // these that imports and older bookings left blank.
  const [patient, setPatient] = useState(null);
  // Who is taking them, chosen at check-in when the booking never named one.
  const [assignTo, setAssignTo] = useState('');

  const patientId = appointment?.patientId;

  useEffect(() => {
    let off = false;
    if (!patientId) { setOwed(null); setPatient(null); return undefined; }
    setOwed(null); setPatient(null);

    // Deliberately NOT patient_service._calculate_outstanding_balance, which
    // computes treatment_type.price minus payments and ignores invoices.
    api.get('/invoices/summary', { params: { patient_id: patientId } })
      .then((r) => { if (!off) setOwed(Number(r?.pending) || 0); })
      .catch(() => { if (!off) setOwed(null); });

    api.get(`/patients/${patientId}`)
      .then((r) => { if (!off) setPatient(r); })
      // A missing record must not blank the panel; the appointment still shows.
      .catch(() => { if (!off) setPatient(null); });

    return () => { off = true; };
  }, [patientId]);

  useEffect(() => { setCopied(false); setAssignTo(''); }, [appointment?.id]);

  if (!appointment) return null;

  const status = STATUS_LABEL[appointment.status] || STATUS_LABEL.scheduled;
  const closed = CLOSED.includes(appointment.status);
  const sex = sexLabel(patient?.gender || appointment.patientGender);
  const age = patient?.age || appointment.patientAge;
  const fileNo = patient?.display_id || patientId;
  const source = sourceOf(appointment, patient);
  const lastVisit = shortDate(patient?.last_visit);
  const city = patient?.village || appointment.patientVillage;

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(appointment.patientPhone || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { notify.problem('Could not copy that number'); }
  };

  const identity = [sex, age ? `${age} yrs` : ''].filter(Boolean).join(', ');

  return (
    <>
      {/* ── Who ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2.5 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-[17px] font-bold text-gray-900 truncate">{appointment.patientName}</h3>
              <span className={`inline-flex items-center gap-1.5 flex-shrink-0 text-[13px] font-semibold ${status.className}`}>
                <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                {status.text}
              </span>
            </div>
            <div className="mt-0.5 flex items-center flex-wrap gap-x-2 text-[13px] text-gray-500">
              {fileNo && <span>#{fileNo}</span>}
              {identity && <span className="text-gray-300">·</span>}
              {identity && <span>{identity}</span>}
              {appointment.visitNumber && <span className="text-gray-300">·</span>}
              {appointment.visitNumber && <span>Visit {appointment.visitNumber}</span>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
                  className="p-1 -mr-1 -mt-0.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Reaching them. Ruled off above and below, so the number reads as
             its own band rather than as a tail on the name. ─────────────── */}
      {appointment.patientPhone && (
        <div className="px-4 py-2.5 border-y border-gray-200 flex items-center justify-between gap-2 flex-shrink-0">
          <a href={`tel:${appointment.patientPhone}`}
             className="min-w-0 inline-flex items-center gap-2 text-[15px] font-medium text-gray-800 hover:text-[#2a276e] transition-colors">
            <Phone size={15} className="flex-shrink-0 text-gray-400" />
            <span className="truncate">{appointment.patientPhone}</span>
          </a>
          <div className="flex items-center gap-2 flex-shrink-0">
            <IconAction title="Copy number" onClick={copyPhone} done={copied}><Copy size={15} /></IconAction>
            <IconAction title="WhatsApp" tone="whatsapp"
                        onClick={() => openWhatsApp(appointment.patientPhone, '')}>
              <WhatsAppIcon size={15} />
            </IconAction>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">

        {/* ── What they owe. A band, not a box: the amber tells you it is
               money without a border repeating what the card already has. ── */}
        {owed > 0 && (
          <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Payment due</div>
              <div className="text-[19px] font-bold text-amber-900 tabular-nums leading-tight">{formatMoney(owed)}</div>
            </div>
            <button
              onClick={() => { navigate(`/patient-profile/${patientId}?tab=billing`); onClose(); }}
              className="flex-shrink-0 h-9 px-3.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[13px] font-bold transition-colors"
            >
              Bill and collect
            </button>
          </div>
        )}

        {/* ── The appointment, then whatever else is actually known ─────── */}
        <div className="px-4 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-bold text-gray-900 truncate">{appointment.doctor}</span>
            <span className="text-[13px] text-gray-600 flex-shrink-0 tabular-nums">
              {formatTime(appointment.startTime)} · {durationOf(appointment)} mins
            </span>
          </div>

          {/* Only what has something to say. An empty treatment field is not a
              fact about the patient, and three rows of "Not recorded" is a
              card working hard to tell you nothing. */}
          <div className="mt-1.5">
            <Fact label="Last visit">
              {lastVisit
                ? <>{lastVisit}{relativeDay(patient?.last_visit) && <span className="text-gray-400"> · {relativeDay(patient.last_visit)}</span>}</>
                : 'First visit'}
            </Fact>
            {appointment.treatment && <Fact label="Treatment">{appointment.treatment}</Fact>}
            {source && <Fact label="Source">{source}</Fact>}
            {appointment.chair_number && <Fact label="Chair">{appointment.chair_number}</Fact>}
            {city && <Fact label="City">{city}</Fact>}
            {appointment.notes && <Fact label="Note">{appointment.notes}</Fact>}
          </div>
        </div>

        {/* The file was created from a name and a phone number, which is all a
            booking needs. This is the one moment the patient is standing at the
            desk, so ask for the rest now. Skippable: a queue beats a form. */}
        {details && (
          <div className="px-4 py-2.5 border-t border-gray-200">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-[13px] font-semibold text-gray-700">
                  Ask {appointment.patientName?.split(' ')[0] || 'them'} for their {details.gaps.join(', ')}
                </p>
                <button onClick={() => setDetails(null)}
                        className="text-[12px] font-semibold text-gray-400 hover:text-gray-700 flex-shrink-0">
                  Not now
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input value={details.age} inputMode="numeric" placeholder="Age"
                       onChange={(e) => setDetails((d) => ({ ...d, age: e.target.value.replace(/\D/g, '') }))}
                       className="h-9 px-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-[#2a276e]" />
                <select value={details.gender}
                        onChange={(e) => setDetails((d) => ({ ...d, gender: e.target.value }))}
                        className="h-9 px-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-[#2a276e]">
                  <option value="">Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                <input value={details.village} placeholder="City"
                       onChange={(e) => setDetails((d) => ({ ...d, village: e.target.value }))}
                       className="h-9 px-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-[#2a276e]" />
              </div>
              <button onClick={saveDetails}
                      disabled={detailsSaving || (!details.age && !details.gender && !details.village)}
                      className="mt-2 w-full h-9 rounded-lg border border-gray-300 text-[13px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
                <Save size={13} /> Save to their file
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── What happens next ─────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-gray-200 space-y-2 flex-shrink-0">
        {/* A booking with no doctor cannot be checked in until one is named.
            It used to go through regardless, which left an arrived patient
            sitting in the unassigned column with nobody expecting them. */}
        {!closed && !appointment.doctor_id && ['scheduled', 'confirmed'].includes(appointment.status) && (
          <select
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            aria-label="Who is seeing them"
            className={`w-full h-10 px-2.5 rounded-lg border text-[13px] font-medium bg-white outline-none transition-colors ${
              assignTo ? 'border-gray-300 text-gray-800' : 'border-amber-400 text-amber-800'
            }`}
          >
            <option value="">Who is seeing them?</option>
            {doctors.map((d) => (
              <option key={d.id} value={String(d.id)}>{d.name || d.email}</option>
            ))}
          </select>
        )}

        {closed ? (
          <button onClick={() => onReopen(appointment.id)} disabled={outcomeBusy}
                  className="w-full h-10 rounded-lg border border-[#2a276e] text-[#2a276e] hover:bg-[#2a276e]/5 text-[13px] font-bold transition-colors disabled:opacity-50">
            Reopen appointment
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {appointment.status === 'scheduled' && (
                <button onClick={() => onConfirm(appointment.id)} disabled={outcomeBusy}
                        className="flex-1 h-10 rounded-lg border border-[#2a276e] text-[#2a276e] hover:bg-[#2a276e]/5 text-[13px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50">
                  <ThumbsUp className="w-4 h-4" /> Confirmed
                </button>
              )}
              {['scheduled', 'confirmed'].includes(appointment.status) && (
                <button onClick={() => onCheckIn(appointment, assignTo)}
                        disabled={outcomeBusy || (!appointment.doctor_id && !assignTo)}
                        title={!appointment.doctor_id && !assignTo ? 'Choose who is seeing them first' : undefined}
                        className="flex-1 h-10 rounded-lg bg-green-700 hover:bg-green-800 text-white text-[13px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <CheckCircle className="w-4 h-4" /> Check in
                </button>
              )}
              {patientId ? (
                <button onClick={() => onStartVisit(appointment)}
                        className={`flex-1 h-10 rounded-lg text-[13px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                          appointment.status === 'arrived'
                            ? 'bg-[#2a276e] hover:bg-[#1a1548] text-white'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}>
                  <Play className="w-4 h-4" /> Start visit
                </button>
              ) : (
                <button onClick={onCreatePatientFile}
                        className="flex-1 h-10 rounded-lg bg-[#2a276e] hover:bg-[#1a1548] text-white text-[13px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors">
                  <UserPlus className="w-4 h-4" /> Create file
                </button>
              )}
            </div>

            {/* The exceptions. Text-weight on purpose: the rare path should not
                compete with the row above it. */}
            <div className="flex items-center justify-center gap-0.5 text-[13px]">
              <button onClick={() => onEdit(appointment)} title="Change the time, doctor or treatment"
                      className="px-2 py-1.5 rounded-lg font-semibold text-gray-500 hover:text-[#2a276e] hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5">
                <Pencil size={13} /> Edit
              </button>
              <span className="text-gray-200">|</span>
              <button onClick={() => onApplyOutcome(appointment.id, 'completed')} disabled={outcomeBusy}
                      title="They were seen, but no clinical record is needed"
                      className="px-2 py-1.5 rounded-lg font-semibold text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50">
                Seen
              </button>
              <span className="text-gray-200">|</span>
              <button onClick={() => onApplyOutcome(appointment.id, 'no_show')} disabled={outcomeBusy}
                      className="px-2 py-1.5 rounded-lg font-semibold text-gray-500 hover:text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50">
                No show
              </button>
              <span className="text-gray-200">|</span>
              <button onClick={() => onRequestCancel({ id: appointment.id, reason: '' })} disabled={outcomeBusy}
                      className="px-2 py-1.5 rounded-lg font-semibold text-gray-500 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
            </div>
          </>
        )}

        <div className="flex items-center justify-center gap-1 text-[13px]">
          <button onClick={() => onBookAgain(appointment)}
                  className="px-2 py-1.5 rounded-lg font-semibold text-gray-600 hover:text-[#2a276e] hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5">
            <CalendarPlus className="w-4 h-4" /> Book again
          </button>
          {patientId && (
            <>
              <span className="text-gray-200">|</span>
              <button onClick={() => { navigate(`/patient-profile/${patientId}?tab=case-papers`); onClose(); }}
                      className="px-2 py-1.5 rounded-lg font-semibold text-gray-600 hover:text-gray-900 transition-colors inline-flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> Patient file
                <ExternalLink className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default AppointmentDetailContent;
