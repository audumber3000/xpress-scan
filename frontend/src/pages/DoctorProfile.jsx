import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const DoctorProfile = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("billing");
  const [scanTypes, setScanTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newScan, setNewScan] = useState({ name: "", price: "" });
  const [editId, setEditId] = useState(null);
  const [editScan, setEditScan] = useState({ name: "", price: "" });
  // Referred By state
  const [referringDoctors, setReferringDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorError, setDoctorError] = useState("");
  const [newDoctor, setNewDoctor] = useState({ name: "", hospital: "" });
  const [editDoctorId, setEditDoctorId] = useState(null);
  const [editDoctor, setEditDoctor] = useState({ name: "", hospital: "" });

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.email?.split("@")[0] ||
    "User";
  const userEmail = user?.email || "";

  // Fetch scan types
  useEffect(() => {
    if (activeTab === "billing") fetchScanTypes();
    // eslint-disable-next-line
  }, [activeTab]);

  const fetchScanTypes = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/scan-types/`);
      if (!res.ok) throw new Error("Failed to fetch scan types");
      const data = await res.json();
      setScanTypes(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Add scan type
  const handleAddScan = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API_URL}/scan-types/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newScan.name, price: parseFloat(newScan.price) })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to add scan type");
      }
      setNewScan({ name: "", price: "" });
      fetchScanTypes();
    } catch (e) {
      setError(e.message);
    }
  };

  // Edit scan type
  const handleEditScan = (scan) => {
    setEditId(scan.id);
    setEditScan({ name: scan.name, price: scan.price });
  };
  const handleUpdateScan = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API_URL}/scan-types/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editScan.name, price: parseFloat(editScan.price) })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update scan type");
      }
      setEditId(null);
      setEditScan({ name: "", price: "" });
      fetchScanTypes();
    } catch (e) {
      setError(e.message);
    }
  };
  // Delete scan type
  const handleDeleteScan = async (id) => {
    if (!window.confirm("Delete this scan type?")) return;
    setError("");
    try {
      const res = await fetch(`${API_URL}/scan-types/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete scan type");
      fetchScanTypes();
    } catch (e) {
      setError(e.message);
    }
  };

  // Fetch referring doctors
  useEffect(() => {
    if (activeTab === "referred") fetchReferringDoctors();
    // eslint-disable-next-line
  }, [activeTab]);

  const fetchReferringDoctors = async () => {
    setLoadingDoctors(true);
    setDoctorError("");
    try {
      const res = await fetch(`${API_URL}/referring-doctors/`);
      if (!res.ok) throw new Error("Failed to fetch referring doctors");
      const data = await res.json();
      setReferringDoctors(data);
    } catch (e) {
      setDoctorError(e.message);
    } finally {
      setLoadingDoctors(false);
    }
  };

  // Add referring doctor
  const handleAddDoctor = async (e) => {
    e.preventDefault();
    setDoctorError("");
    try {
      const res = await fetch(`${API_URL}/referring-doctors/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDoctor)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to add doctor");
      }
      setNewDoctor({ name: "", hospital: "" });
      fetchReferringDoctors();
    } catch (e) {
      setDoctorError(e.message);
    }
  };

  // Edit referring doctor
  const handleEditDoctor = (doctor) => {
    setEditDoctorId(doctor.id);
    setEditDoctor({ name: doctor.name, hospital: doctor.hospital || "" });
  };
  const handleUpdateDoctor = async (e) => {
    e.preventDefault();
    setDoctorError("");
    try {
      const res = await fetch(`${API_URL}/referring-doctors/${editDoctorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDoctor)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update doctor");
      }
      setEditDoctorId(null);
      setEditDoctor({ name: "", hospital: "" });
      fetchReferringDoctors();
    } catch (e) {
      setDoctorError(e.message);
    }
  };
  // Delete referring doctor
  const handleDeleteDoctor = async (id) => {
    if (!window.confirm("Delete this doctor?")) return;
    setDoctorError("");
    try {
      const res = await fetch(`${API_URL}/referring-doctors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete doctor");
      fetchReferringDoctors();
    } catch (e) {
      setDoctorError(e.message);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Doctor Profile</h1>
      {/* Simple full-width name and email */}
      <div className="mb-8">
        <div className="text-2xl font-semibold text-gray-900 mb-1">{userName}</div>
        <div className="text-gray-600 text-base mb-2">{userEmail}</div>
      </div>
      {/* Tabbed Section */}
      <div className="bg-white rounded-xl shadow p-0">
        <div className="border-b flex">
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 ${activeTab === "billing" ? "border-green-600 text-green-700" : "border-transparent text-gray-600 hover:text-green-700"}`}
            onClick={() => setActiveTab("billing")}
          >
            Billing
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 ${activeTab === "referred" ? "border-green-600 text-green-700" : "border-transparent text-gray-600 hover:text-green-700"}`}
            onClick={() => setActiveTab("referred")}
          >
            Referred By
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 ${activeTab === "other" ? "border-green-600 text-green-700" : "border-transparent text-gray-600 hover:text-green-700"}`}
            onClick={() => setActiveTab("other")}
          >
            Other
          </button>
        </div>
        <div className="p-6">
          {activeTab === "billing" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Scan Types & Pricing</h3>
              {error && <div className="text-red-500 mb-2">{error}</div>}
              {loading ? (
                <div className="w-full flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                  </div>
                </div>
              ) : (
                <table className="min-w-full mb-6">
                  <thead>
                    <tr className="text-left text-gray-700 border-b">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Price (₹)</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanTypes.map((scan) => (
                      <tr key={scan.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 pr-4">
                          {editId === scan.id ? (
                            <input
                              className="input input-bordered px-2 py-1 rounded border"
                              value={editScan.name}
                              onChange={e => setEditScan({ ...editScan, name: e.target.value })}
                            />
                          ) : (
                            scan.name
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {editId === scan.id ? (
                            <input
                              type="number"
                              className="input input-bordered px-2 py-1 rounded border"
                              value={editScan.price}
                              onChange={e => setEditScan({ ...editScan, price: e.target.value })}
                            />
                          ) : (
                            scan.price
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {editId === scan.id ? (
                            <>
                              <button className="text-green-600 mr-2" onClick={handleUpdateScan}>Save</button>
                              <button className="text-gray-500" onClick={() => setEditId(null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button className="text-blue-600 mr-2" onClick={() => handleEditScan(scan)}>Edit</button>
                              <button className="text-red-600" onClick={() => handleDeleteScan(scan.id)}>Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Add new scan type */}
              <form className="flex gap-4 items-end" onSubmit={handleAddScan}>
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    className="input input-bordered px-2 py-1 rounded border"
                    value={newScan.name}
                    onChange={e => setNewScan({ ...newScan, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Price (₹)</label>
                  <input
                    type="number"
                    className="input input-bordered px-2 py-1 rounded border"
                    value={newScan.price}
                    onChange={e => setNewScan({ ...newScan, price: e.target.value })}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700">Add</button>
              </form>
            </div>
          )}
          {activeTab === "referred" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Referring Doctors</h3>
              {doctorError && <div className="text-red-500 mb-2">{doctorError}</div>}
              {loadingDoctors ? (
                <div className="w-full flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                  </div>
                </div>
              ) : (
                <table className="min-w-full mb-6">
                  <thead>
                    <tr className="text-left text-gray-700 border-b">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Hospital</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referringDoctors.map((doctor) => (
                      <tr key={doctor.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 pr-4">
                          {editDoctorId === doctor.id ? (
                            <input
                              className="input input-bordered px-2 py-1 rounded border"
                              value={editDoctor.name}
                              onChange={e => setEditDoctor({ ...editDoctor, name: e.target.value })}
                            />
                          ) : (
                            doctor.name
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {editDoctorId === doctor.id ? (
                            <input
                              className="input input-bordered px-2 py-1 rounded border"
                              value={editDoctor.hospital}
                              onChange={e => setEditDoctor({ ...editDoctor, hospital: e.target.value })}
                            />
                          ) : (
                            doctor.hospital || "-"
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {editDoctorId === doctor.id ? (
                            <>
                              <button className="text-green-600 mr-2" onClick={handleUpdateDoctor}>Save</button>
                              <button className="text-gray-500" onClick={() => setEditDoctorId(null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button className="text-blue-600 mr-2" onClick={() => handleEditDoctor(doctor)}>Edit</button>
                              <button className="text-red-600" onClick={() => handleDeleteDoctor(doctor.id)}>Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Add new referring doctor */}
              <form className="flex gap-4 items-end" onSubmit={handleAddDoctor}>
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    className="input input-bordered px-2 py-1 rounded border"
                    value={newDoctor.name}
                    onChange={e => setNewDoctor({ ...newDoctor, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Hospital (optional)</label>
                  <input
                    className="input input-bordered px-2 py-1 rounded border"
                    value={newDoctor.hospital}
                    onChange={e => setNewDoctor({ ...newDoctor, hospital: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700">Add</button>
              </form>
            </div>
          )}
          {activeTab === "other" && (
            <div className="text-gray-500">Other tab content (placeholder)</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorProfile; 