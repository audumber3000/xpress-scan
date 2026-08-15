import React from "react";
import { getCurrencySymbol } from "../../../utils/currency";

/**
 * Finish the patient's file, at the desk.
 *
 * Reached from the drawer's "Create patient file" when nobody on file matches,
 * and from the duplicate warning when the receptionist says this is somebody
 * new. Both routes were dead until the check-duplicates call was fixed: it
 * POSTed to a GET-only route, so every click 405'd and this form never opened.
 */
const PatientRegistrationModal = ({ open, form, setForm, treatments, onSubmit, onClose }) => {
  if (!open) return null;

  return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => onClose()}></div>
        <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900">Complete Patient Registration</h3>
            <button onClick={() => onClose()} className="hover:bg-gray-100 p-2 rounded-lg transition-colors">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <form id="patient-registration-form" onSubmit={onSubmit} className="space-y-4">
              {/* Patient Name (pre-filled) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent bg-gray-50"
                  readOnly
                />
              </div>

              {/* Age */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age *
                </label>
                <input
                  type="number"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  required
                  min="1"
                  max="150"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                  placeholder="Enter age"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender *
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Village/City */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Village/City *
                </label>
                <input
                  type="text"
                  value={form.village}
                  onChange={(e) => setForm({ ...form, village: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                  placeholder="Enter village or city"
                />
              </div>

              {/* Phone (pre-filled) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                  placeholder="Enter phone number"
                />
              </div>

              {/* Referred By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Referred By
                </label>
                <input
                  type="text"
                  value={form.referred_by}
                  onChange={(e) => setForm({ ...form, referred_by: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                  placeholder="Enter referral source (optional)"
                />
              </div>

              {/* Treatment Type (dropdown from clinic's treatment types) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Treatment Type *
                </label>
                <select
                  value={form.treatment_type}
                  onChange={(e) => setForm({ ...form, treatment_type: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent bg-white"
                >
                  <option value="">Select treatment type</option>
                  {treatments.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name} - {getCurrencySymbol()}{type.price}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Type *
                </label>
                <select
                  value={form.payment_type}
                  onChange={(e) => setForm({ ...form, payment_type: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="Online">Online</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                  placeholder="Additional notes (optional)"
                />
              </div>
            </form>
          </div>
          <div className="p-6 border-t border-gray-200">
            <button 
              type="submit" 
              form="patient-registration-form"
              className="w-full bg-[#2a276e] text-white py-3 rounded-lg hover:bg-[#1a1548] transition-colors font-medium"
            >
              Complete Registration
            </button>
          </div>
        </div>
      </div>
  );
};

export default PatientRegistrationModal;
