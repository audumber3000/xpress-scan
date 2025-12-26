import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const PatientProfile = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");

  const tabs = [
    { id: "profile", name: "Patient Profile" },
    { id: "medications", name: "Medications" },
    { id: "goals", name: "Mini Goals" },
    { id: "lab", name: "Lab Results" },
    { id: "bgl", name: "BGL Analysis" }
  ];

  // Sample patient data
  const patientData = {
    name: "Ahmed Ali Hussain",
    age: 38,
    gender: "Male",
    location: "Elshiekh zayed, Giza",
    occupation: "Accountant",
    dob: "12 Dec 1992",
    phone: "+20 123 456 7890",
    email: "ahmed.ali@email.com",
    profileImage: "https://randomuser.me/api/portraits/men/32.jpg",
    bmi: 22.4,
    weight: 92,
    height: 175,
    bloodPressure: "124/80",
    alcohol: false,
    smoker: false,
    diagnosis: ["Obesity", "Uncontrolled Type 2"],
    healthBarriers: ["Fear of medication", "Fear of insulin"]
  };

  const timelineData = [
    { date: "Dec 2022", event: "Pre-diabetic", a1c: "10.4" },
    { date: "Jan 2022", event: "Type 2", a1c: "10.4" },
    { date: "Jul 2021", event: "Chronic thyroid disorder", a1c: "10.4" },
    { date: "Jul 2021", event: "Angina Pectoris", a1c: "10.4" },
    { date: "Jul 2021", event: "Stroke", a1c: "10.4" }
  ];

  const medicalHistory = {
    chronic: ["IHD", "Obesity", "Chronic thyroid disorder"],
    emergencies: ["Diabetic Ketoacidosis"],
    surgery: ["Liposuction"],
    family: ["Obesity (Father)"],
    complications: ["Nephropathy", "Neuropathy", "Retinopathy", "Diabetic foot", "Sexual dysfunction"]
  };

  return (
    <div className="w-full h-full bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/patient-files")}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Patient Files
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{patientData.name}</h1>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? "border-green-500 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Profile Tab Content */}
        {activeTab === "profile" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Patient Demographics Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <img
                    src={patientData.profileImage}
                    alt={patientData.name}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                  <div className="flex justify-center mt-2 space-x-2">
                    {!patientData.alcohol && (
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                      </div>
                    )}
                    {!patientData.smoker && (
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h2 className="text-xl font-semibold text-gray-900">{patientData.name}</h2>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>{patientData.gender}</p>
                    <p>{patientData.location}</p>
                    <p>{patientData.occupation}</p>
                    <p>{patientData.dob} ({patientData.age} years)</p>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <span className="text-lg font-semibold text-gray-900">{patientData.bmi}</span>
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                    <span className="text-xs text-green-600">10</span>
                  </div>
                  <p className="text-xs text-gray-500">BMI</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <span className="text-lg font-semibold text-gray-900">{patientData.weight} kg</span>
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                    <span className="text-xs text-green-600">10 kg</span>
                  </div>
                  <p className="text-xs text-gray-500">Weight</p>
                </div>
                <div className="text-center">
                  <span className="text-lg font-semibold text-gray-900">{patientData.height} Cm</span>
                  <p className="text-xs text-gray-500">Height</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <span className="text-lg font-semibold text-gray-900">{patientData.bloodPressure}</span>
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                    </svg>
                    <span className="text-xs text-red-600">10</span>
                  </div>
                  <p className="text-xs text-gray-500">Blood pressure</p>
                </div>
              </div>
            </div>

            {/* Diagnosis and Health Barriers Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Diagnosis & Health Barriers</h3>
                <button className="text-green-600 hover:text-green-700 text-sm font-medium">
                  Edit
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Own diagnosis</h4>
                  <div className="flex flex-wrap gap-2">
                    {patientData.diagnosis.map((item, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Health barriers</h4>
                  <div className="flex flex-wrap gap-2">
                    {patientData.healthBarriers.map((item, index) => (
                      <span key={index} className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Timeline</h3>
                <button className="text-green-600 hover:text-green-700 text-sm font-medium">
                  Edit
                </button>
              </div>
              <div className="space-y-3">
                {timelineData.map((item, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{item.event}</span>
                        <span className="text-xs text-gray-500">A1c: {item.a1c}</span>
                      </div>
                      <p className="text-xs text-gray-500">{item.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Medical History Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Medical history</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    <h4 className="text-sm font-medium text-gray-700">Chronic disease</h4>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {medicalHistory.chronic.map((item, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <h4 className="text-sm font-medium text-gray-700">Diabetes Emergencies</h4>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {medicalHistory.emergencies.map((item, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 7h-8v6h8V7zm-2 4h-4V9h4v2zm4.5-9H2.5C1.67 2 1 2.67 1 3.5v17C1 21.33 1.67 22 2.5 22h19c.83 0 1.5-.67 1.5-1.5v-17C23 2.67 22.33 2 21.5 2z"/>
                    </svg>
                    <h4 className="text-sm font-medium text-gray-700">Surgery</h4>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {medicalHistory.surgery.map((item, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H16c-.8 0-1.54.37-2.01.99L12 11l-1.99-2.01A2.5 2.5 0 0 0 8 8H5.46c-.8 0-1.54.37-2.01.99L1 15.5V22h2v-6h2.5l2.54-7.63A1.5 1.5 0 0 1 9.46 8H12c.8 0 1.54.37 2.01.99L16 11l1.99-2.01A2.5 2.5 0 0 1 20 8h2.54c.8 0 1.54.37 2.01.99L27 15.5V22h-7z"/>
                    </svg>
                    <h4 className="text-sm font-medium text-gray-700">Family disease</h4>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {medicalHistory.family.map((item, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    <h4 className="text-sm font-medium text-gray-700">Diabetes related complication</h4>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {medicalHistory.complications.map((item, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other tabs content will go here */}
        {activeTab !== "profile" && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {tabs.find(tab => tab.id === activeTab)?.name}
            </h2>
            <p className="text-gray-600">Content for {activeTab} tab will be implemented here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientProfile;

