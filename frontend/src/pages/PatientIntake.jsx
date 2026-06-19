import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { api, getFriendlyErrorMessage } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { getCurrencySymbol } from "../utils/currency";
import AgeOrDobField, { computeAgeFromDob } from "../components/patient/AgeOrDobField";

const PatientIntake = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Check if user has permission to create patients
  useEffect(() => {
    if (user && user.role !== "clinic_owner") {
      const permissions = user.permissions || {};
      const patientsPermissions = permissions.patients || {};
      if (!patientsPermissions.edit) {
        navigate("/patients");
        return;
      }
    }
  }, [user, navigate]);
  
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    date_of_birth: "",
    gender: "",
    village: "",
    phone: "",
    referred_by: "",
    treatment_type: "",
    notes: "",
    payment_type: "Cash"
  });
  // Whether the Age/DOB field collects an age or a date of birth.
  const [ageMode, setAgeMode] = useState("age");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [treatmentTypes, setTreatmentTypes] = useState([]);
  const [selectedPrice, setSelectedPrice] = useState("");
  const [referringDoctors, setReferringDoctors] = useState([]);
  const [showOtherDoctor, setShowOtherDoctor] = useState(false);
  const [villages, setVillages] = useState([]);
  const [showVillageDropdown, setShowVillageDropdown] = useState(false);
  const [filteredVillages, setFilteredVillages] = useState([]);

  useEffect(() => {
    // Fetch treatment types from backend
    const fetchTreatmentTypes = async () => {
      try {
        const data = await api.get("/treatment-types/");
        setTreatmentTypes(data);
      } catch (e) {
        setTreatmentTypes([]);
      }
    };
    fetchTreatmentTypes();
    // Fetch referring doctors from backend
    const fetchDoctors = async () => {
      try {
        const data = await api.get("/referring-doctors/");
        setReferringDoctors(data);
      } catch (e) {
        setReferringDoctors([]);
      }
    };
    fetchDoctors();
    // Fetch villages from backend
    const fetchVillages = async () => {
      try {
        const data = await api.get("/patients/villages/");
        setVillages(data.villages || []);
      } catch (e) {
        setVillages([]);
      }
    };
    fetchVillages();
  }, []);

  const handleChange = (e) => {
    const { name } = e.target;
    let { value } = e.target;
    // Phone: allow digits only (the country code is added automatically when sending).
    if (name === "phone") value = value.replace(/\D/g, "");
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear this field's error as soon as the user starts fixing it.
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (name === "treatment_type") {
      const found = treatmentTypes.find(t => t.id.toString() === value);
      setSelectedPrice(found ? found.price : "");
    }
    if (name === "referred_by") {
      setShowOtherDoctor(value === "__other__");
    }
    if (name === "village") {
      // Filter villages based on input
      if (value.trim()) {
        const filtered = villages.filter(village => 
          village.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredVillages(filtered);
        setShowVillageDropdown(filtered.length > 0);
      } else {
        setFilteredVillages([]);
        setShowVillageDropdown(false);
      }
    }
  };

  const handleVillageSelect = (village) => {
    setFormData(prev => ({
      ...prev,
      village: village
    }));
    setShowVillageDropdown(false);
  };

  // Validates every required field and returns a { fieldName: message } map.
  // An empty map means the form is valid.
  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) errors.name = "Full name is required.";

    if (ageMode === "dob") {
      if (!formData.date_of_birth) {
        errors.age = "Date of birth is required.";
      } else if (new Date(formData.date_of_birth) > new Date()) {
        errors.age = "Date of birth can't be in the future.";
      }
    } else {
      const age = String(formData.age).trim();
      if (!age) {
        errors.age = "Age is required.";
      } else {
        const ageNum = Number(age);
        if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 150) {
          errors.age = "Please enter a valid age between 0 and 150.";
        }
      }
    }

    if (!formData.gender) errors.gender = "Gender is required.";

    if (!formData.phone.trim()) {
      errors.phone = "Phone number is required.";
    } else if (formData.phone.length < 7) {
      errors.phone = "Please enter a valid phone number (at least 7 digits).";
    }

    if (!formData.treatment_type) errors.treatment_type = "Treatment type is required.";
    if (!formData.referred_by.trim()) errors.referred_by = "Referring doctor is required.";

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // Name every missing/invalid field in one summary message.
      const summary =
        Object.keys(errors).length === 1
          ? Object.values(errors)[0]
          : `Please fix these fields: ${Object.values(errors).join(" ")}`;
      setError(summary);
      toast.error(summary);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setFieldErrors({});

    setLoading(true);
    setError("");

    try {
      // Find treatment type name for backend
      const treatmentTypeObj = treatmentTypes.find(t => t.id.toString() === formData.treatment_type);
      const treatmentTypeName = treatmentTypeObj ? treatmentTypeObj.name : "";
      
      // Prepare payload — send either age or date_of_birth based on the toggle.
      const patientPayload = {
        ...formData,
        scan_type: treatmentTypeName, // Backend still expects scan_type field
      };
      if (ageMode === "dob") {
        patientPayload.date_of_birth = formData.date_of_birth || null;
        patientPayload.age = computeAgeFromDob(formData.date_of_birth) || null;
      } else {
        patientPayload.age = formData.age === "" ? null : parseInt(formData.age, 10);
        patientPayload.date_of_birth = null;
      }
      
      // 1. Save patient to database
      await api.post("/patients/", patientPayload);

      // 3. Show success and redirect
      toast.success(`${formData.name} has been added 🎉`);
      navigate("/patients");

    } catch (error) {
      // Turn any backend/validation/network error into a specific, friendly
      // sentence (handles 422 field errors, raw 500 strings, timeouts, etc.).
      const message = getFriendlyErrorMessage(
        error,
        "We couldn't save this patient. Please check the details and try again."
      );
      setError(message);
      toast.error(message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  // Border turns red when a field has a validation error.
  const inputClass = (name) =>
    `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e] ${
      fieldErrors[name] ? "border-red-400 bg-red-50" : "border-gray-300"
    }`;

  // Small red message shown under a field, if it has an error.
  const FieldError = ({ name }) =>
    fieldErrors[name] ? (
      <p className="mt-1 text-sm text-red-600">{fieldErrors[name]}</p>
    ) : null;

  return (
    <div className="w-full h-full bg-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Patient Intake Form</h1>
          <p className="text-gray-600 mt-1">
            Fill out the patient details
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Patient Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Patient Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  autoComplete="off"
                  required
                  className={inputClass("name")}
                  placeholder="Enter patient's full name"
                />
                <FieldError name="name" />
              </div>
              
              <AgeOrDobField
                mode={ageMode}
                onModeChange={setAgeMode}
                age={formData.age}
                onAgeChange={(v) => handleChange({ target: { name: "age", value: v } })}
                dob={formData.date_of_birth}
                onDobChange={(v) => handleChange({ target: { name: "date_of_birth", value: v } })}
                error={fieldErrors.age}
                inputClass={inputClass("age")}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender *
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                  className={inputClass("gender")}
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <FieldError name="gender" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Village/City
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="village"
                    value={formData.village}
                    onChange={handleChange}
                    onFocus={() => {
                      if (formData.village.trim() && filteredVillages.length > 0) {
                        setShowVillageDropdown(true);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowVillageDropdown(false), 150);
                    }}
                    autoComplete="off"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                    placeholder="Type to search or enter new village"
                  />
                  {showVillageDropdown && filteredVillages.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                      {filteredVillages.map((village, index) => (
                        <div
                          key={index}
                          className="px-3 py-2 hover:bg-[#9B8CFF]/10 cursor-pointer border-b border-gray-100 last:border-b-0 text-sm"
                          onClick={() => handleVillageSelect(village)}
                        >
                          {village}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  autoComplete="off"
                  className={inputClass("phone")}
                />
                <FieldError name="phone" />
              </div>
            </div>
          </div>

          {/* Medical Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Medical Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referred By *
                </label>
                <select
                  name="referred_by"
                  value={showOtherDoctor ? "__other__" : formData.referred_by}
                  onChange={handleChange}
                  required={!showOtherDoctor}
                  className={inputClass("referred_by")}
                >
                  <option value="">Select Referring Doctor</option>
                  {referringDoctors.map(doc => (
                    <option key={doc.id} value={doc.name}>{doc.name}{doc.hospital ? ` (${doc.hospital})` : ""}</option>
                  ))}
                  <option value="__other__">Other</option>
                </select>
                {showOtherDoctor && (
                  <input
                    type="text"
                    name="referred_by"
                    value={formData.referred_by}
                    onChange={handleChange}
                    required
                    placeholder="Enter referring doctor name"
                    className={`mt-2 ${inputClass("referred_by")}`}
                  />
                )}
                <FieldError name="referred_by" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Treatment Type *
                </label>
                <select
                  name="treatment_type"
                  value={formData.treatment_type}
                  onChange={handleChange}
                  required
                  className={inputClass("treatment_type")}
                >
                    <option value="">Select Treatment Type</option>
                  {treatmentTypes.map(treatment => (
                    <option key={treatment.id} value={treatment.id}>{treatment.name}</option>
                  ))}
                </select>
                <FieldError name="treatment_type" />
              </div>
            </div>
            {/* Auto-display price */}
            {selectedPrice && (
              <div className="mt-2 text-[#2a276e] font-semibold">Price: {getCurrencySymbol()}{selectedPrice}</div>
            )}
            {/* Payment Type */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Type
              </label>
              <select
                name="payment_type"
                value={formData.payment_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
              >
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="UPI">UPI</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Medical Notes */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medical Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                placeholder="Enter any medical notes, observations, or additional information..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e] resize-vertical"
              />
            </div>

          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#2a276e] text-white py-3 px-6 rounded-lg font-semibold hover:bg-[#1a1548] transition-colors disabled:opacity-50"
            >
              {loading ? "Processing..." : "Register Patient"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/patients")}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientIntake; 