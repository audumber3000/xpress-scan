import React, { useMemo } from 'react';
import { 
  Calendar, 
  FileText, 
  CreditCard, 
  ChevronRight, 
  ExternalLink,
  MapPin,
  Clock
} from 'lucide-react';

/**
 * PatientVisitHistory - Professional vertical timeline 
 * Designed to match the "aspiration" UI: Date markers on left, detailed cards on right.
 */
const PatientVisitHistory = ({ 
  appointments = [], 
  prescriptions = [], 
  invoices = [] 
}) => {
  
  const visits = useMemo(() => {
    const grouped = {};

    // 1. Process Appointments (Primary visit markers)
    appointments.forEach(apt => {
      const dateKey = apt.appointment_date || apt.date || 'unknown';
      if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey, events: [] };
      
      grouped[dateKey].events.push({
        type: 'appointment',
        id: apt.id,
        display_id: `#RSV${apt.visit_number || apt.id}`,
        time: apt.start_time ? `${apt.start_time}${apt.end_time ? ` - ${apt.end_time}` : ''}` : 'Time TBD',
        title: apt.treatment || 'Consultation',
        badge: apt.visit_number ? (apt.visit_number === 1 ? 'SINGLE' : 'MULTIPLE') : null,
        subtitle: `Visit #${apt.visit_number || '?'} - ${apt.treatment || 'Check-up'}`,
        clinic: apt.clinic_name || 'Zendral Dental Central',
        status: apt.status === 'completed' ? 'DONE' : (apt.status === 'checking' ? 'CHECKING' : apt.status?.toUpperCase()),
        notes: apt.notes,
        raw: apt
      });
    });


    // 2. Process Prescriptions & Invoices
    // We'll link them to the date groups
    prescriptions.forEach(rx => {
      const dateKey = rx.created_at ? rx.created_at.split('T')[0] : 'unknown';
      if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey, events: [] };
      
      grouped[dateKey].events.push({
        type: 'prescription',
        id: rx.id,
        time: rx.created_at ? new Date(rx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        title: 'Prescription Issued',
        subtitle: `${rx.items?.length || 0} Medications`,
        has_pdf: rx.has_pdf || !!rx.pdf_url,
        pdf_url: rx.pdf_url,
        raw: rx
      });
    });

    invoices.forEach(inv => {
      const dateKey = inv.date || (inv.created_at ? inv.created_at.split('T')[0] : 'unknown');
      if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey, events: [] };
      
      grouped[dateKey].events.push({
        type: 'invoice',
        id: inv.id,
        time: inv.created_at ? new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        title: `Payment: ₹${inv.total_amount || inv.amount || 0}`,
        subtitle: `${inv.procedure || 'Treatment'}`,
        status: inv.status === 'paid' ? 'PAID' : 'PAYABLE',
        raw: inv
      });
    });

    // Sort by date desc
    return Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [appointments, prescriptions, invoices]);

  const formatDateParts = (dateStr) => {
    if (!dateStr || dateStr === 'unknown') return { day: '??', month: '---' };
    const date = new Date(dateStr);
    return {
      day: date.getDate(),
      month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase()
    };
  };

  return (
    <div className="space-y-8 py-2">
      {visits.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <p className="text-gray-400 font-medium">No visit history recorded yet.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical continuous line */}
          <div className="absolute left-[22px] top-6 bottom-0 w-1 bg-[#1aa49a]/20 rounded-full" />

          <div className="space-y-10">
            {visits.map((dayGroup, gIdx) => {
              const { day, month } = formatDateParts(dayGroup.date);
              return (
                <div key={gIdx} className="relative flex gap-6">
                  {/* Date column */}
                  <div className="flex flex-col items-center w-12 flex-shrink-0 z-10">
                    <span className="text-[10px] font-black text-[#1aa49a] mb-1">{month}</span>
                    <div className="w-11 h-11 bg-[#1aa49a] rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm border-2 border-white">
                      {day}
                    </div>
                  </div>

                  {/* Cards column */}
                  <div className="flex-1 space-y-4 pt-4">
                    {dayGroup.events.map((event, eIdx) => (
                      <div key={eIdx} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
                        
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-800">{event.time || 'Visit Time'}</span>
                            {event.badge && (
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                event.badge === 'MULTIPLE' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                              }`}>
                                {event.badge}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-gray-400">{event.display_id || ''}</span>
                        </div>

                        <h4 className="text-lg font-bold text-gray-900 mb-1">{event.title}</h4>
                        <p className="text-sm text-gray-500 font-medium mb-3">{event.subtitle}</p>

                        {event.notes && (
                          <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100 italic text-xs text-gray-600 leading-relaxed">
                            "{event.notes}"
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-4">

                          <div className="flex items-center gap-1.5 text-gray-500 text-sm font-semibold">
                            <MapPin className="w-3.5 h-3.5" />
                            {event.clinic || 'Zendral Dental'}
                          </div>

                          {event.type === 'appointment' && (
                            <span className={`text-[10px] font-black px-3 py-1 rounded-lg ${
                              event.status === 'DONE' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                              • {event.status}
                            </span>
                          )}

                          {event.type === 'invoice' && (
                            <div className="flex items-center gap-3">
                              {event.status === 'PAYABLE' && (
                                <button className="px-5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm">
                                  Pay
                                </button>
                              )}
                              {event.status === 'PAID' && (
                                <span className="text-[10px] font-black text-green-600">• PAID</span>
                              )}
                            </div>
                          )}

                          {event.type === 'prescription' && event.has_pdf && (
                            <button 
                              onClick={() => window.open(event.pdf_url, '_blank')}
                              className="flex items-center gap-1 text-[10px] font-black text-blue-600 hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              VIEW PDF
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientVisitHistory;
