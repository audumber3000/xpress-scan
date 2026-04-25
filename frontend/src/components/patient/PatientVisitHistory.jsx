import React, { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';

const formatTime = (value) => {
  if (!value) return null;
  // Accept either an "HH:MM" string from appointment.start_time or an ISO timestamp.
  if (/^\d{1,2}:\d{2}/.test(value)) {
    const [h, m] = value.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
};

const PatientVisitHistory = ({ appointments = [], prescriptions = [], invoices = [] }) => {
  const visits = useMemo(() => {
    const grouped = {};

    appointments.forEach((apt) => {
      const dateKey = apt.appointment_date || apt.date || 'unknown';
      if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey, events: [] };
      grouped[dateKey].events.push({
        type: 'appointment',
        id: apt.id,
        time: formatTime(apt.start_time),
        title: apt.treatment || 'Appointment',
        notes: apt.notes,
        status:
          apt.status === 'completed' ? 'Completed'
          : apt.status === 'checking' ? 'Checked in'
          : apt.status === 'accepted' ? 'Confirmed'
          : apt.status === 'rejected' ? 'Cancelled'
          : null,
      });
    });

    prescriptions.forEach((rx) => {
      const dateKey = rx.created_at ? rx.created_at.split('T')[0] : 'unknown';
      if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey, events: [] };
      grouped[dateKey].events.push({
        type: 'prescription',
        id: rx.id,
        time: formatTime(rx.created_at),
        title: 'Prescription',
        meds: rx.items?.length || 0,
        has_pdf: rx.has_pdf || !!rx.pdf_url,
        pdf_url: rx.pdf_url,
      });
    });

    invoices.forEach((inv) => {
      const dateKey = inv.date || (inv.created_at ? inv.created_at.split('T')[0] : 'unknown');
      if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey, events: [] };
      grouped[dateKey].events.push({
        type: 'invoice',
        id: inv.id,
        time: formatTime(inv.created_at),
        title: `Invoice — ₹${inv.total_amount || inv.amount || 0}`,
        status: inv.status === 'paid' ? 'Paid' : 'Unpaid',
      });
    });

    return Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [appointments, prescriptions, invoices]);

  const formatDateParts = (dateStr) => {
    if (!dateStr || dateStr === 'unknown') return { day: '??', month: '---' };
    const d = new Date(dateStr);
    return {
      day: d.getDate(),
      month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    };
  };

  if (visits.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
        <p className="text-gray-400 font-medium">No visit history recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Continuous timeline rail */}
      <div className="absolute left-[22px] top-6 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-8">
        {visits.map((dayGroup, gIdx) => {
          const { day, month } = formatDateParts(dayGroup.date);
          return (
            <div key={gIdx} className="relative flex gap-5">
              {/* Date marker */}
              <div className="flex flex-col items-center w-12 flex-shrink-0 z-10">
                <span className="text-[10px] font-bold text-gray-500 mb-1">{month}</span>
                <div className="w-11 h-11 bg-[#2a276e] rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm border-2 border-white">
                  {day}
                </div>
              </div>

              {/* Day's events */}
              <div className="flex-1 space-y-3 pt-2">
                {dayGroup.events.map((event, eIdx) => (
                  <div
                    key={eIdx}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-gray-900 truncate">{event.title}</h4>
                          {event.time && (
                            <span className="text-xs text-gray-500">· {event.time}</span>
                          )}
                          {event.type === 'prescription' && event.meds > 0 && (
                            <span className="text-xs text-gray-500">· {event.meds} med{event.meds === 1 ? '' : 's'}</span>
                          )}
                        </div>

                        {event.notes && (
                          <p className="mt-2 text-xs text-gray-600 italic leading-relaxed">
                            "{event.notes}"
                          </p>
                        )}
                      </div>

                      {/* Right-side action / status */}
                      <div className="flex-shrink-0">
                        {event.type === 'appointment' && event.status && (
                          <span className={`text-[10px] font-semibold px-2 py-1 rounded-md ${
                            event.status === 'Completed' ? 'bg-green-50 text-green-700'
                            : event.status === 'Cancelled' ? 'bg-red-50 text-red-700'
                            : 'bg-[#9B8CFF]/15 text-[#2a276e]'
                          }`}>
                            {event.status}
                          </span>
                        )}

                        {event.type === 'invoice' && (
                          event.status === 'Paid' ? (
                            <span className="text-[10px] font-semibold px-2 py-1 rounded-md bg-green-50 text-green-700">
                              Paid
                            </span>
                          ) : (
                            <button className="px-3 py-1 bg-[#2a276e] text-white rounded-md text-xs font-semibold hover:bg-[#1a1548] transition-colors">
                              Pay
                            </button>
                          )
                        )}

                        {event.type === 'prescription' && event.has_pdf && (
                          <button
                            onClick={() => window.open(event.pdf_url, '_blank')}
                            className="flex items-center gap-1 text-xs font-semibold text-[#2a276e] hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            PDF
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PatientVisitHistory;
