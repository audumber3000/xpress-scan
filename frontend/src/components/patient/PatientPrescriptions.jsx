import React from 'react';

/**
 * PatientPrescriptions - Renders the patient's prescription history
 * @param {array} prescriptions - List of prescription objects
 */
const PatientPrescriptions = ({ prescriptions = [] }) => {
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-2-2H6.572a2 2 0 00-2 2v2a2 2 0 002 2h10.856a2 2 0 002-2v-2zM15 11V5a2 2 0 00-2-2H9a2 2 0 00-2 2v6" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Medical Prescriptions</h3>
                </div>
                <button className="flex items-center gap-2 px-5 py-2.5 bg-[#2a276e] text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-900/10 hover:bg-[#1a1548] transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    New Prescription
                </button>
            </div>

            <div className="grid grid-cols-1 gap-5">
                {prescriptions.length > 0 ? (
                    prescriptions.map((rx) => (
                        <div key={rx.id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-[#2a276e] group-hover:bg-[#2a276e] group-hover:text-white transition-colors duration-300">
                                        <span className="text-lg font-bold uppercase">Rx</span>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-gray-900 tracking-tight group-hover:text-[#2a276e] transition-colors">{rx.medication}</h4>
                                        <p className="text-sm text-gray-500 font-medium">Prescribed on {rx.date}</p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${rx.status === 'active' ? 'bg-green-100 text-green-700 shadow-sm' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                    {rx.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">Dosage Instructions</p>
                                    <p className="text-gray-900 font-bold text-sm leading-relaxed">{rx.dosage}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">Regimine Duration</p>
                                    <p className="text-gray-900 font-bold text-sm leading-relaxed">{rx.duration}</p>
                                </div>
                            </div>

                            {rx.notes && (
                                <div className="flex gap-3 p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50 mb-6">
                                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-xs text-amber-800 font-medium leading-relaxed italic">{rx.notes}</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-50">
                                <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2-2 2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                </button>
                                <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-20 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 border border-gray-100">
                            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <h4 className="text-gray-900 font-bold">No Records</h4>
                        <p className="text-gray-500 text-sm">Add clinical prescriptions for the patient here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PatientPrescriptions;
