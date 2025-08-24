import React from "react";
import PatientForm from "../components/PatientForm";

const AddPatient = () => {
  const handleSubmit = (data) => {
    // TODO: Replace with API call

  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold mb-4">Patient Intake Form</h1>
      <PatientForm onSubmit={handleSubmit} />
    </div>
  );
};

export default AddPatient; 