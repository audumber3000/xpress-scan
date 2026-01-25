import React from 'react';

/**
 * PatientInfo - Renders detailed information about a patient
 * @param {object} patientData - The patient data object
 */
const PatientInfo = ({ patientData }) => {
    if (!patientData) return null;

    // Get patient initials for avatar
    const getPatientInitials = (name) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center gap-2 mb-6 text-[#2a276e]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center space-x-4">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#9B8CFF] to-[#2a276e] flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                            {getPatientInitials(patientData.name)}
                        </div>
                        <div>
                            <h4 className="text-xl font-bold text-gray-900">{patientData.name}</h4>
                            <p className="text-gray-500 font-medium">{patientData.gender}, {patientData.age} years</p>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-2">
                                Active Patient
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Phone Number</p>
                            <div className="flex items-center text-gray-900 font-medium">
                                <svg className="w-4 h-4 mr-2 text-[#9B8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {patientData.phone}
                            </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Location</p>
                            <div className="flex items-center text-gray-900 font-medium">
                                <svg className="w-4 h-4 mr-2 text-[#9B8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {patientData.village}
                            </div>
                        </div>
                        {patientData.created_at && (
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 sm:col-span-2">
                                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Registration Date</p>
                                <div className="flex items-center text-gray-900 font-medium">
                                    <svg className="w-4 h-4 mr-2 text-[#9B8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {new Date(patientData.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Treatment Information */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center gap-2 mb-6 text-[#2a276e]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900">Case Details</h3>
                </div>

                <div className="space-y-4">
                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                        <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-2">Initial Treatment Plan</p>
                        <p className="text-gray-900 font-semibold">{patientData.treatment_type}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Payment Scheme</p>
                            <p className="text-gray-900 font-medium bg-gray-50 p-2 rounded-lg border border-gray-100 text-sm">
                                {patientData.payment_type}
                            </p>
                        </div>
                        {patientData.referred_by && (
                            <div>
                                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Referral Source</p>
                                <p className="text-gray-900 font-medium bg-gray-50 p-2 rounded-lg border border-gray-100 text-sm">
                                    {patientData.referred_by}
                                </p>
                            </div>
                        )}
                    </div>

                    {patientData.notes && (
                        <div className="pt-2">
                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Clinical Notes</p>
                            <div className="p-3 bg-yellow-50/50 rounded-lg border border-yellow-100 text-sm text-gray-700 italic leading-relaxed">
                                {patientData.notes}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PatientInfo;
