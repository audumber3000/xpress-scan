import React from "react";
import { useForm } from "react-hook-form";

const PatientForm = ({ onSubmit }) => {
  const { register, handleSubmit, formState: { errors } } = useForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg mx-auto p-4 bg-white rounded shadow">
      <div>
        <label className="block font-medium">Patient Name</label>
        <input {...register("name", { required: true })} className="input input-bordered w-full" />
        {errors.name && <span className="text-red-500 text-sm">Required</span>}
      </div>
      <div>
        <label className="block font-medium">Age</label>
        <input type="number" {...register("age", { required: true, min: 0 })} className="input input-bordered w-full" />
        {errors.age && <span className="text-red-500 text-sm">Required</span>}
      </div>
      <div>
        <label className="block font-medium">Gender</label>
        <select {...register("gender", { required: true })} className="input input-bordered w-full">
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
        {errors.gender && <span className="text-red-500 text-sm">Required</span>}
      </div>
      <div>
        <label className="block font-medium">Village</label>
        <input {...register("village", { required: true })} className="input input-bordered w-full" />
        {errors.village && <span className="text-red-500 text-sm">Required</span>}
      </div>
      <div>
        <label className="block font-medium">Phone Number</label>
        <input {...register("phone", { required: true })} className="input input-bordered w-full" />
        {errors.phone && <span className="text-red-500 text-sm">Required</span>}
      </div>
      <div>
        <label className="block font-medium">Referred By (Doctor)</label>
        <input {...register("referredBy", { required: true })} className="input input-bordered w-full" />
        {errors.referredBy && <span className="text-red-500 text-sm">Required</span>}
      </div>
      <div>
        <label className="block font-medium">Scan Type</label>
        <input {...register("scanType", { required: true })} className="input input-bordered w-full" />
        {errors.scanType && <span className="text-red-500 text-sm">Required</span>}
      </div>
      <div>
        <label className="block font-medium">Notes</label>
        <textarea {...register("notes")} className="input input-bordered w-full" />
      </div>
      <button type="submit" className="btn btn-primary w-full">Submit</button>
    </form>
  );
};

export default PatientForm; 