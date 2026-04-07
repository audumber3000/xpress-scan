import React from 'react';

const parsePills = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.trim().startsWith('[')) {
        try { return JSON.parse(val); } catch (e) { return [val]; }
    }
    if (typeof val === 'string' && val.trim() !== '') return [val];
    return [];
};

const CasePaperList = ({ caseHistory, loading, onNewCasePaper, onSelectCasePaper }) => {
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
          {caseHistory.map((paper, index) => (
            <div 
              key={paper.id} 
              onClick={() => {
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
              }}
              className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-[#9B8CFF]/50 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-blue-100">
                  Visit #{caseHistory.length - index}
                </div>
                <div className={`px-2 py-1 text-[10px] font-bold uppercase rounded-lg ${paper.status === 'Completed' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {paper.status}
                </div>
              </div>
              <h3 className="font-bold text-gray-900 mb-1 group-hover:text-[#2a276e] transition-colors line-clamp-1">
                {Array.isArray(paper.chief_complaint) ? paper.chief_complaint.join(', ') : paper.chief_complaint || 'General Checkup'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {new Date(paper.date).toLocaleDateString()} • {paper.dentist?.name || paper.dentist_name || (typeof paper.dentist === 'string' ? paper.dentist : 'Not Assigned')}
              </p>
              
              <div className="pt-4 border-t border-gray-100 text-sm font-medium text-[#2a276e] flex items-center justify-between">
                <span>Clinical Profile</span>
                <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}

          {caseHistory.length === 0 && (
            <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200">
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
