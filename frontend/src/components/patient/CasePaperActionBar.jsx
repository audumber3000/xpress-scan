import React from 'react';
import { Save, ClipboardList, Receipt, CalendarClock, ChevronDown } from 'lucide-react';
import { nextVisitSummary, NOT_SPECIFIED } from '../../utils/nextVisit';

/**
 * A count sitting on the corner of an action, same treatment as the header
 * bell. It answers "is there already something behind this button?" without
 * the doctor having to open it and find out.
 */
const CountBadge = ({ count }) => {
  if (!count) return null;
  return (
    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center border-2 border-white">
      {count > 99 ? '99+' : count}
    </span>
  );
};

const CasePaperActionBar = ({
  form,
  onSave,
  onPrescription,
  onInvoice,
  onNextVisit,
  prescriptionCount = 0,
  invoiceCount = 0,
  hasExistingInvoice = false
}) => {
  const label = form.next_visit_recommendation || NOT_SPECIFIED;
  const isSet = label !== NOT_SPECIFIED;

  return (
    <div className="fixed bottom-8 right-12 z-[50] flex gap-4 p-5 bg-white/90 backdrop-blur-md rounded-2xl border border-white shadow-2xl shadow-indigo-900/10 animate-in slide-in-from-bottom duration-500 group">
      {/* Next visit is a decision, not a dropdown pick, so it opens properly. */}
      <button
        onClick={onNextVisit}
        className="flex items-center gap-2.5 px-3 border-r border-gray-100 mr-2 pr-5 rounded-l-lg hover:bg-gray-50 transition-colors text-left"
      >
        <CalendarClock size={18} className={isSet ? 'text-[#2a276e]' : 'text-gray-400'} />
        <div>
          <p className="text-xs font-medium text-gray-500 leading-none mb-1">Next Visit</p>
          <p className={`text-sm font-semibold leading-none ${isSet ? 'text-[#2a276e]' : 'text-gray-400'}`}>
            {nextVisitSummary(label, form.next_visit_date)}
          </p>
        </div>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      <button 
        onClick={onSave}
        className="flex items-center gap-2 px-6 py-3 bg-gray-50 text-gray-600 font-semibold rounded-lg text-sm hover:bg-gray-100 transition-all active:scale-95"
      >
        <Save size={18} />
        <span>Save Records</span>
      </button>
      
      <button 
        onClick={onPrescription}
        className="relative flex items-center gap-2 px-6 py-3 bg-[#2a276e] text-white font-semibold rounded-lg text-sm hover:bg-[#1a1548] transition-all shadow-sm"
      >
        <ClipboardList size={18} />
        <span>Prescription</span>
        <CountBadge count={prescriptionCount} />
      </button>
      
      <button 
        onClick={onInvoice}
        className={`relative flex items-center gap-2 px-6 py-3 font-semibold rounded-lg text-sm transition-all shadow-sm ${
          hasExistingInvoice
            ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
            : 'bg-[#00ba7c] text-white hover:bg-[#009e6a]'
        }`}
      >
        <Receipt size={18} />
        <span>{hasExistingInvoice ? 'View Invoice' : 'Invoice'}</span>
        <CountBadge count={invoiceCount} />
      </button>
    </div>
  );
};

export default CasePaperActionBar;
