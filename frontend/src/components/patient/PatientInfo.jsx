import React from 'react';
import { Clock } from 'lucide-react';
import PatientVisitHistory from './PatientVisitHistory';
import { generatePatientPersona, generateInitialsAvatar } from '../../utils/avatar';
import { formatDate } from '../../utils/datetime';

/**
 * PatientInfo - Renders detailed information about a patient
 * @param {object} patientData - The patient data object
 * @param {array} appointments - List of appointments
 * @param {array} prescriptions - List of prescriptions
 * @param {array} invoices - List of invoices
 */
const PatientInfo = ({
  patientData,
  appointments = [],
  prescriptions = [],
  invoices = [],
  casePapers = [],
  dailyVisits = []
}) => {
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
                        <img 
                            src={generatePatientPersona(patientData, 160)} 
                            onError={(e) => { e.target.onerror = null; e.target.src = generateInitialsAvatar(patientData.name || 'Patient'); }}
                            alt={patientData.name} 
                            className="w-20 h-20 rounded-2xl shadow-lg border border-gray-100 object-cover"
                        />
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
                        {(patientData.registered_on || patientData.created_at) && (
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 sm:col-span-2">
                                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Registration Date</p>
                                <div className="flex items-center text-gray-900 font-medium">
                                    <svg className="w-4 h-4 mr-2 text-[#9B8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {/* registered_on is the staff-recorded date (back-dateable);
                                        created_at is only the fallback for unmigrated rows. */}
                                    {formatDate(patientData.registered_on || patientData.created_at)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Visit History Timeline (Replaces Case Details) */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex flex-col">
                <div className="flex items-center gap-2 mb-6 text-[#2a276e]">
                    <Clock className="w-5 h-5 text-[#1aa49a]" />
                    <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Visit History</h3>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[600px] pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                    <PatientVisitHistory
                        appointments={appointments}
                        prescriptions={prescriptions}
                        invoices={invoices}
                        casePapers={casePapers}
                        dailyVisits={dailyVisits}
                        registrationDate={patientData.registered_on || patientData.created_at}
                    />
                </div>
            </div>

        </div>
    );
};

export default PatientInfo;
