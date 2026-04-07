import React from 'react';
import { Save, ClipboardList, Receipt } from 'lucide-react';

const CasePaperActionBar = ({
  form,
  onFormChange,
  onSave,
  onPrescription,
  onInvoice
}) => {
  return (
    <div className="fixed bottom-8 right-12 z-[50] flex gap-4 p-5 bg-white/90 backdrop-blur-md rounded-[2.5rem] border border-white shadow-2xl shadow-indigo-900/10 animate-in slide-in-from-bottom duration-500 group">
      <div className="flex items-center gap-3 px-2 border-r border-gray-100 mr-2 pr-5">
        <div className="text-right">
          <p className="text-xs font-medium text-gray-500 leading-none mb-1">Next Visit</p>
          <select 
            value={form.next_visit_recommendation}
            onChange={(e) => onFormChange({...form, next_visit_recommendation: e.target.value})}
            className="bg-transparent text-sm font-semibold text-[#2a276e] outline-none cursor-pointer p-0"
          >
            <option>Not specified</option>
            <option>Review After 1 Week</option>
            <option>Review After 15 Days</option>
            <option>Review After 1 Month</option>
            <option>SOS (If Pain/Swelling)</option>
            <option>No Further Treatment</option>
          </select>
        </div>
      </div>
    
      <button 
        onClick={onSave}
        className="flex items-center gap-2 px-6 py-3 bg-gray-50 text-gray-600 font-semibold rounded-lg text-sm hover:bg-gray-100 transition-all active:scale-95"
      >
        <Save size={18} />
        <span>Save Records</span>
      </button>
      
      <button 
        onClick={onPrescription}
        className="flex items-center gap-2 px-6 py-3 bg-[#2a276e] text-white font-semibold rounded-lg text-sm hover:bg-[#1a1548] transition-all shadow-sm"
      >
        <ClipboardList size={18} />
        <span>Prescription</span>
      </button>
      
      <button 
        onClick={onInvoice}
        className="flex items-center gap-2 px-6 py-3 bg-[#00ba7c] text-white font-semibold rounded-lg text-sm hover:bg-[#009e6a] transition-all shadow-sm"
      >
        <Receipt size={18} />
        <span>Invoice</span>
      </button>
    </div>
  );
};

export default CasePaperActionBar;
