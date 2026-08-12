import React from 'react';
import { Pencil, Trash2, Clock, Stethoscope, CalendarClock, ClipboardList } from 'lucide-react';

/**
 * What a dentist is actually asking when they open this list:
 *
 *   1. Which one is today's, and is it still open?
 *   2. When did it start, and who saw them?
 *   3. What was the complaint, and what did we conclude?
 *   4. How much work was planned?
 *   5. When are they due back?
 *
 * The card answered 3 and half of 2. Everything below exists to answer the
 * rest without opening the paper.
 */

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const timeOf = (paper) => {
  // `date` is the visit date and is sometimes date-only, so the real clock time
  // lives on created_at. Fall back rather than print a misleading midnight.
  const src = paper.created_at || paper.date;
  if (!src) return null;
  const d = new Date(src);
  if (Number.isNaN(d.getTime()) || (d.getHours() === 0 && d.getMinutes() === 0)) return null;
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const planCount = (paper) => {
  const plan = paper.treatment_plan_snapshot;
  if (Array.isArray(plan)) return plan.length;
  if (typeof plan === 'string' && plan.trim().startsWith('[')) {
    try { return JSON.parse(plan).length; } catch { return 0; }
  }
  return 0;
};

const parsePills = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.trim().startsWith('[')) {
        try { return JSON.parse(val); } catch (e) { return [val]; }
    }
    if (typeof val === 'string' && val.trim() !== '') return [val];
    return [];
};

/**
 * The card title. chief_complaint arrives as a JSON *string* (e.g. '["Pain"]'),
 * so rendering it directly printed the brackets and quotes verbatim —
 * Array.isArray is false for a string. parsePills already handles both shapes.
 */
const complaintTitle = (val) => {
    const pills = parsePills(val);
    return pills.length ? pills.join(', ') : 'General Checkup';
};

const CasePaperList = ({ caseHistory, loading, onNewCasePaper, onSelectCasePaper, onDeleteCasePaper }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Clinical Case Papers</h2>
        <button 
          onClick={onNewCasePaper}
          className="px-6 py-3 bg-[#2a276e] text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-[#1a1548] hover:-translate-y-0.5 transition-all active:scale-95"
        >
          + New Case Paper
        </button>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2a276e]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {caseHistory.map((paper, index) => {
            const openPaper = () => {
              onSelectCasePaper(paper, {
                chief_complaint: parsePills(paper.chief_complaint),
                medical_history: parsePills(paper.medical_history),
                dental_history: parsePills(paper.dental_history),
                allergies: parsePills(paper.allergies),
                clinical_examination: paper.clinical_examination || '',
                diagnosis: paper.diagnosis || '',
                next_visit_recommendation: paper.next_visit_recommendation || 'Not specified',
                notes: paper.notes || ''
              });
            };
            const when = new Date(paper.date);
            const today = isSameDay(when, new Date());
            const open = paper.status !== 'Completed';
            const time = timeOf(paper);
            const treatments = planCount(paper);
            const nextVisit = paper.next_visit_recommendation &&
              paper.next_visit_recommendation !== 'Not specified'
                ? paper.next_visit_recommendation : null;

            return (
            <div
              key={paper.id}
              onClick={openPaper}
              /* Border only, never a shadow. The open visit gets a left accent
                 rather than a heavier card, so "which one is live" reads at a
                 glance without breaking the flat treatment. */
              className={`bg-white rounded-2xl p-5 border cursor-pointer transition-colors group ${
                today && open
                  ? 'border-[#2a276e]/30 border-l-4 border-l-[#2a276e]'
                  : 'border-gray-200 hover:border-[#2a276e]/40'
              }`}
            >
              <div className="flex justify-between items-start mb-3 gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider rounded-md">
                    Visit #{caseHistory.length - index}
                  </span>
                  {today && (
                    <span className="px-2 py-1 bg-[#2a276e] text-white text-[10px] font-bold uppercase tracking-wider rounded-md">
                      Today
                    </span>
                  )}
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md ${
                    open ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
                  }`}>
                    {open ? 'In progress' : 'Completed'}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); openPaper(); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#2a276e] hover:bg-gray-100 transition-colors"
                    title="Open case paper"
                    aria-label="Open case paper"
                  >
                    <Pencil size={14} />
                  </button>
                  {onDeleteCasePaper && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteCasePaper(paper); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete case paper"
                      aria-label="Delete case paper"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="font-bold text-gray-900 group-hover:text-[#2a276e] transition-colors line-clamp-1">
                {complaintTitle(paper.chief_complaint)}
              </h3>

              {paper.diagnosis && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1" title={paper.diagnosis}>
                  {paper.diagnosis}
                </p>
              )}

              <div className="mt-3 space-y-1.5 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="flex-shrink-0 text-gray-400" />
                  <span>
                    {when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    {time && <span className="text-gray-400"> at {time}</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Stethoscope size={12} className="flex-shrink-0 text-gray-400" />
                  <span className="truncate">
                    {paper.dentist?.name || paper.dentist_name ||
                      (typeof paper.dentist === 'string' ? paper.dentist : 'Not assigned')}
                  </span>
                </div>
                {treatments > 0 && (
                  <div className="flex items-center gap-1.5">
                    <ClipboardList size={12} className="flex-shrink-0 text-gray-400" />
                    <span>{treatments} treatment{treatments === 1 ? '' : 's'} planned</span>
                  </div>
                )}
                {nextVisit && (
                  <div className="flex items-center gap-1.5 text-[#2a276e]">
                    <CalendarClock size={12} className="flex-shrink-0" />
                    <span className="truncate font-semibold">Back: {nextVisit}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 text-sm font-semibold text-[#2a276e] flex items-center justify-between">
                <span>{open ? 'Continue this visit' : 'Open'}</span>
                <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            );
          })}

          {caseHistory.length === 0 && (
            <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400 font-bold">No case papers found for this patient.</p>
              <p className="text-sm text-gray-400 mt-1">Start a new clinical session to begin charting.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CasePaperList;
