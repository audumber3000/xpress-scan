import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";

const PatientIntake = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "",
    village: "",
    phone: "",
    referred_by: "",
    scan_type: "",
    notes: "",
    payment_type: "Cash"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scanTypes, setScanTypes] = useState([]);
  const [selectedPrice, setSelectedPrice] = useState("");
  const [referringDoctors, setReferringDoctors] = useState([]);
  const [showOtherDoctor, setShowOtherDoctor] = useState(false);

  useEffect(() => {
    // Fetch scan types from backend
    const fetchScanTypes = async () => {
      try {
        const data = await api.get("/scan-types/");
        setScanTypes(data);
      } catch (e) {
        setScanTypes([]);
      }
    };
    fetchScanTypes();
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
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name === "scan_type") {
      const found = scanTypes.find(s => s.id.toString() === value);
      setSelectedPrice(found ? found.price : "");
    }
    if (name === "referred_by") {
      setShowOtherDoctor(value === "__other__");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Find scan type name for backend
      const scanTypeObj = scanTypes.find(s => s.id.toString() === formData.scan_type);
      const scanTypeName = scanTypeObj ? scanTypeObj.name : "";
      
      // Convert age to integer and prepare payload
      const patientPayload = { 
        ...formData, 
        scan_type: scanTypeName,
        age: parseInt(formData.age, 10) // Convert age to integer
      };
      
      // 1. Save patient to database
      await api.post("/patients/", patientPayload);

      // 3. Show success and redirect
      alert(`Patient registered successfully!`);
      navigate("/patients");
      
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full bg-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Patient Intake Form</h1>
          <p className="text-gray-600 mt-1">
            Fill out patient details and automatically generate a radiology report
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Age *
                </label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  required
                  min="0"
                  max="150"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender *
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Village/City
                </label>
                <input
                  type="text"
                  name="village"
                  value={formData.village}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scan Type *
                </label>
                <select
                  name="scan_type"
                  value={formData.scan_type}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select Scan Type</option>
                  {scanTypes.map(scan => (
                    <option key={scan.id} value={scan.id}>{scan.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Auto-display price */}
            {selectedPrice && (
              <div className="mt-2 text-green-700 font-semibold">Price: ₹{selectedPrice}</div>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="UPI">UPI</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
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