import React, { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useHeader } from "../contexts/HeaderContext";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";
import { ChevronLeft, Search, Plus } from 'lucide-react';
import GearLoader from "../components/GearLoader";

const TreatmentsPricing = () => {
  const { setTitle } = useHeader();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [treatmentTypes, setTreatmentTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [formData, setFormData] = useState({ name: "", price: "", category: "General" });
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All Services');
  const [searchQuery, setSearchQuery] = useState('');
  
  const categories = ['All Services', 'General', 'Orthodontics', 'Cosmetic'];

  useEffect(() => {
    setTitle(
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Admin Hub</span>
        </button>
      </div>
    );
    fetchTreatmentTypes();
  }, [setTitle, navigate]);

  const hasPermission = (permission) => {
    if (!user) return false;
    // Clinic owners have all permissions
    if (user.role === "clinic_owner") return true;
    
    // Check specific permission
    if (!user.permissions) return false;
    const [section, action] = permission.split(":");
    return user.permissions[section]?.[action] === true;
  };

  const fetchTreatmentTypes = async () => {
    try {
      setLoading(true);
      const data = await api.get("/treatment-types");
      setTreatmentTypes(data);
    } catch (error) {
      console.error("Error fetching treatment types:", error);
      toast.error("Failed to load treatment types");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTreatment = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post("/treatment-types", formData);
      toast.success("Treatment type added successfully");
      setShowAddModal(false);
      setFormData({ name: "", price: "", category: "General" });
      fetchTreatmentTypes();
    } catch (error) {
      console.error("Error adding treatment:", error);
      toast.error("Failed to add treatment type");
    } finally {
      setSaving(false);
    }
  };

  const handleEditTreatment = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.put(`/treatment-types/${editingTreatment.id}`, formData);
      toast.success("Treatment type updated successfully");
      setShowEditModal(false);
      setEditingTreatment(null);
      setFormData({ name: "", price: "", category: "General" });
      fetchTreatmentTypes();
    } catch (error) {
      console.error("Error updating treatment:", error);
      toast.error("Failed to update treatment type");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTreatment = async (id) => {
    if (!window.confirm("Are you sure you want to delete this treatment type?")) return;
    
    try {
      await api.delete(`/treatment-types/${id}`);
      toast.success("Treatment type deleted successfully");
      fetchTreatmentTypes();
    } catch (error) {
      console.error("Error deleting treatment:", error);
      toast.error("Failed to delete treatment type");
    }
  };

  const openEditModal = (treatment) => {
    setEditingTreatment(treatment);
    setFormData({ name: treatment.name, price: treatment.price, category: treatment.category || 'General' });
    setShowEditModal(true);
  };

  // Group treatments by category
  const groupedTreatments = treatmentTypes.reduce((acc, treatment) => {
    const category = treatment.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(treatment);
    return acc;
  }, {});

  // Filter treatments based on selected category and search
  const filteredTreatments = treatmentTypes.filter(treatment => {
    const matchesCategory = selectedCategory === 'All Services' || treatment.category === selectedCategory || (!treatment.category && selectedCategory === 'General');
    const matchesSearch = treatment.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredGrouped = filteredTreatments.reduce((acc, treatment) => {
    const category = treatment.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(treatment);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <GearLoader />
      </div>
    );
  }

  if (!hasPermission("billing:view")) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-500 text-lg">You don't have permission to view billing information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search treatments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D9596]"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-6 mb-6 border-b border-gray-200 overflow-x-auto">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`pb-3 px-1 font-semibold whitespace-nowrap transition relative ${
                selectedCategory === category
                  ? 'text-[#2D9596]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {category}
              {selectedCategory === category && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2D9596] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Treatments by Section */}
        {Object.entries(filteredGrouped).map(([category, treatments]) => (
          <div key={category} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {category === 'General' ? 'GENERAL DENTISTRY' : category.toUpperCase()}
              </h3>
              <span className="text-xs font-semibold text-[#2D9596]">
                {treatments.length} ITEMS
              </span>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Treatment Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    {hasPermission("billing:edit") && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {treatments.map((treatment, index) => (
                    <tr key={treatment.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {treatment.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        ₹{treatment.price}
                      </td>
                      {hasPermission("billing:edit") && (
                        <td className="px-6 py-4 text-right text-sm font-medium">
                          <button
                            onClick={() => openEditModal(treatment)}
                            className="text-[#2D9596] hover:text-[#1F6B72] mr-4 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTreatment(treatment.id)}
                            className="text-red-600 hover:text-red-900 transition"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {filteredTreatments.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl">
            <p className="text-gray-500">No treatments found</p>
          </div>
        )}

        {/* Floating Add Button */}
        {hasPermission("billing:edit") && (
          <button
            onClick={() => setShowAddModal(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-[#2D9596] text-white rounded-full shadow-lg hover:bg-[#1F6B72] transition flex items-center justify-center"
          >
            <Plus className="w-7 h-7" />
          </button>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Add Treatment Type</h3>
              <form onSubmit={handleAddTreatment}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Treatment Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596]"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596]"
                  >
                    <option value="General">General</option>
                    <option value="Orthodontics">Orthodontics</option>
                    <option value="Cosmetic">Cosmetic</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596]"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setFormData({ name: "", price: "", category: "General" });
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] disabled:opacity-50"
                  >
                    {saving ? "Adding..." : "Add"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Edit Treatment Type</h3>
              <form onSubmit={handleEditTreatment}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Treatment Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596]"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596]"
                  >
                    <option value="General">General</option>
                    <option value="Orthodontics">Orthodontics</option>
                    <option value="Cosmetic">Cosmetic</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596]"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingTreatment(null);
                      setFormData({ name: "", price: "", category: "General" });
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TreatmentsPricing;
