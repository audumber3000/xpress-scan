import React, { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useHeader } from "../contexts/HeaderContext";
import { useAuth } from "../contexts/AuthContext";
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import { ChevronLeft, Search, Plus, Pill, Layers, Info } from 'lucide-react';
import GearLoader from "../components/GearLoader";
import { getCurrencySymbol } from "../utils/currency";

/* ── GST Info Popover (reusable) ─────────────────────────────────────────── */
const GST_DATA = {
  exempt: [
    "OPD Consultation & Registration",
    "Intraoral X-rays (RVG / IOPA), OPG, CBCT",
    "Dental Fillings (Composite, GIC, Amalgam)",
    "Root Canal Treatment (RCT), Pulpotomy",
    "Routine & surgical Extractions, Impacted Wisdom Teeth",
    "Scaling & Root Planing (for disease treatment)",
    "Crowns & Bridges (PFM, Zirconia, Metal) — part of treatment plan",
    "Dental Implants & Dentures",
    "Braces / Clear Aligners — functional malocclusion treatment",
    "Jaw fracture treatment, cyst/tumour removal (SAC 9993)",
  ],
  taxable18: [
    "Teeth Whitening / Bleaching (in-office or take-home kit)",
    "Veneers / Laminates — purely cosmetic on healthy teeth",
    "Tooth Jewellery / Dental Gems",
    "Gingival Depigmentation (gum bleaching — aesthetic only)",
    "Cosmetic Enamel Contouring (SAC 999722)",
  ],
  goods: [
    "Mouthwashes, Dental Floss, Interdental Brushes — 18%",
    "Medicated Toothpaste — 12–18% (depends on composition)",
    "Prescribed gels / kits sold over-the-counter (HSN 3004)",
  ],
};

const GSTInfoPopover = () => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="GST Guide for Indian Dental Clinics"
        className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition"
      >
        <Info className="w-3.5 h-3.5" />
        GST Guide
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
          <div style={{
            position: 'absolute', left: 0, top: 36, zIndex: 999,
            width: 440, maxHeight: '75vh', overflowY: 'auto',
            background: '#fff', border: '1px solid #e2e8f0',
            borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,.15)',
            padding: '16px 18px', fontSize: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>🇮🇳 GST Guide — Indian Dental Clinics</span>
              <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#64748b' }}>×</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '4px 8px', borderRadius: 6, marginBottom: 6, fontSize: 11 }}>🟢 EXEMPT 0% GST — SAC 9993 (Healthcare Services)</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#374151', lineHeight: 1.7 }}>{GST_DATA.exempt.map(it => <li key={it}>{it}</li>)}</ul>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '4px 8px', borderRadius: 6, marginBottom: 6, fontSize: 11 }}>🔴 TAXABLE 18% GST — SAC 999722 (Cosmetic Procedures)</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#374151', lineHeight: 1.7 }}>{GST_DATA.taxable18.map(it => <li key={it}>{it}</li>)}</ul>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: '#d97706', background: '#fffbeb', padding: '4px 8px', borderRadius: 6, marginBottom: 6, fontSize: 11 }}>🟠 GOODS SALE — HSN 3004 (5–18% GST)</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#374151', lineHeight: 1.7 }}>{GST_DATA.goods.map(it => <li key={it}>{it}</li>)}</ul>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: '#78350f' }}>
              ⚠️ <strong>Composite Supply Rule:</strong> Even if your lab charges 12% GST on a crown, the fee you bill the patient remains 0% GST — the primary service is healthcare. Always consult your CA for jurisdiction-specific advice.
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const TreatmentsPricing = () => {
  const { setTitle } = useHeader();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Tab State
  const [activeTab, setActiveTab] = useState('services'); // 'services' or 'medications'
  
  // Services State
  const [treatmentTypes, setTreatmentTypes] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All Services');
  const serviceCategories = ['All Services', 'General', 'Orthodontics', 'Cosmetic'];
  
  // Medications State
  const [medications, setMedications] = useState([]);
  const [selectedMedCategory, setSelectedMedCategory] = useState('All');
  const medCategories = ['All', 'General', 'Antibiotics', 'Analgesics', 'Gastrointestinal', 'Dental'];
  
  // Common UI State
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({ 
    name: "", 
    price: "", 
    category: "General",
    dosage: "",
    duration: "",
    quantity: "",
    notes: ""
  });

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
    fetchData();
  }, [setTitle, navigate, activeTab]);

  const fetchData = () => {
    if (activeTab === 'services') {
      fetchTreatmentTypes();
    } else {
      fetchMedications();
    }
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === "clinic_owner") return true;
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
      toast.error(getPermissionAwareErrorMessage(
        error,
        "Failed to load treatment types",
        "You don't have permission to view treatment services."
      ));
    } finally {
      setLoading(false);
    }
  };

  const fetchMedications = async () => {
    try {
      setLoading(true);
      const data = await api.get("/medications");
      setMedications(data);
    } catch (error) {
      console.error("Error fetching medications:", error);
      toast.error(getPermissionAwareErrorMessage(
        error,
        "Failed to load medications",
        "You don't have permission to view medications."
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (activeTab === 'services') {
        await api.post("/treatment-types", {
          name: formData.name,
          price: formData.price,
          category: formData.category
        });
        toast.success("Treatment type added successfully");
        fetchTreatmentTypes();
      } else {
        await api.post("/medications", {
          name: formData.name,
          category: formData.category,
          dosage: formData.dosage,
          duration: formData.duration,
          quantity: formData.quantity,
          notes: formData.notes
        });
        toast.success("Medication added successfully");
        fetchMedications();
      }
      closeModal();
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error(`Failed to add ${activeTab === 'services' ? 'treatment' : 'medication'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEditItem = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (activeTab === 'services') {
        await api.put(`/treatment-types/${editingItem.id}`, {
          name: formData.name,
          price: formData.price,
          category: formData.category
        });
        toast.success("Treatment type updated successfully");
        fetchTreatmentTypes();
      } else {
        await api.put(`/medications/${editingItem.id}`, {
          name: formData.name,
          category: formData.category,
          dosage: formData.dosage,
          duration: formData.duration,
          quantity: formData.quantity,
          notes: formData.notes
        });
        toast.success("Medication updated successfully");
        fetchMedications();
      }
      closeModal();
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error(error.response?.data?.detail || "Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id, clinic_id) => {
    if (activeTab === 'medications' && clinic_id === null) {
      toast.info("System medications cannot be deleted");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete this ${activeTab === 'services' ? 'treatment' : 'medication'}?`)) return;
    
    try {
      if (activeTab === 'services') {
        await api.delete(`/treatment-types/${id}`);
        fetchTreatmentTypes();
      } else {
        await api.delete(`/medications/${id}`);
        fetchMedications();
      }
      toast.success("Deleted successfully");
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error(error.response?.data?.detail || "Failed to delete");
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({ 
      name: item.name, 
      price: item.price || "", 
      category: item.category || 'General',
      dosage: item.dosage || "",
      duration: item.duration || "",
      quantity: item.quantity || "",
      notes: item.notes || ""
    });
    setShowEditModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingItem(null);
    setFormData({ 
      name: "", 
      price: "", 
      category: "General",
      dosage: "",
      duration: "",
      quantity: "",
      notes: ""
    });
  };

  // Filtering Logic
  const filteredServices = treatmentTypes.filter(t => {
    const matchesCategory = selectedCategory === 'All Services' || t.category === selectedCategory || (!t.category && selectedCategory === 'General');
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredMedications = medications.filter(m => {
    const matchesCategory = selectedMedCategory === 'All' || m.category === selectedMedCategory;
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedServices = filteredServices.reduce((acc, treatment) => {
    const category = treatment.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(treatment);
    return acc;
  }, {});

  const groupedMeds = filteredMedications.reduce((acc, med) => {
    const category = med.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(med);
    return acc;
  }, {});

  if (loading && treatmentTypes.length === 0 && medications.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <GearLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      
      {/* Header */}
      <div className="mb-6 flex justify-between items-end">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
          <span>Admin</span>
          <span>/</span>
          <span className="text-gray-900">Treatment & Pricing</span>
        </div>
      </div>

      {/* Top Level Tabs */}
      <div className="mb-6 border-b border-gray-200">
          <div className="flex items-center justify-between -mb-px">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('services')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'services' ? 'border-[#29828a] text-[#29828a]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
              >
                Treatment & Pricing
              </button>
              <button
                onClick={() => setActiveTab('medications')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'medications' ? 'border-[#29828a] text-[#29828a]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
              >
                Medication
              </button>
            </div>
            {activeTab === 'services' && (
              <div className="pb-2">
                <GSTInfoPopover />
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'services' ? 'treatments' : 'medications'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2D9596]"
            />
          </div>
        </div>

        {/* Sub-Category Tabs */}
        <div className="flex gap-6 mb-6 border-b border-gray-200 overflow-x-auto no-scrollbar">
          {(activeTab === 'services' ? serviceCategories : medCategories).map((category) => (
            <button
              key={category}
              onClick={() => activeTab === 'services' ? setSelectedCategory(category) : setSelectedMedCategory(category)}
              className={`pb-3 px-1 font-semibold whitespace-nowrap transition relative ${
                (activeTab === 'services' ? selectedCategory : selectedMedCategory) === category
                  ? 'text-[#2D9596]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {category}
              {(activeTab === 'services' ? selectedCategory : selectedMedCategory) === category && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2D9596] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content Table */}
        {Object.entries(activeTab === 'services' ? groupedServices : groupedMeds).map(([category, items]) => (
          <div key={category} className="mb-8">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                {category.toUpperCase()}
              </h3>
              <span className="text-[10px] font-bold bg-[#E0F2F2] text-[#2D9596] px-2 py-0.5 rounded-full">
                {items.length} {items.length === 1 ? 'ITEM' : 'ITEMS'}
              </span>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Name
                    </th>
                    {activeTab === 'services' ? (
                      <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Price
                      </th>
                    ) : (
                      <>
                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          Dosage
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          Duration
                        </th>
                      </>
                    )}
                    <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {activeTab === 'medications' && item.clinic_id === null && (
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" title="System Medication"></div>
                          )}
                          <span className="text-sm font-bold text-gray-900">{item.name}</span>
                        </div>
                      </td>
                      {activeTab === 'services' ? (
                        <td className="px-6 py-4 text-sm font-mono text-[#2D9596] font-bold">
                          {getCurrencySymbol()}{item.price}
                        </td>
                      ) : (
                        <>
                          <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                            {item.dosage || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                            {item.duration || '-'}
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => openEditModal(item)}
                            className="text-[#2D9596] hover:text-[#1F6B72] text-[11px] font-bold uppercase tracking-wider"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.clinic_id)}
                            className="text-red-400 hover:text-red-600 text-[11px] font-bold uppercase tracking-wider"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {((activeTab === 'services' && Object.keys(groupedServices).length === 0) || 
          (activeTab === 'medications' && Object.keys(groupedMeds).length === 0)) && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <Search className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No items found</p>
          </div>
        )}

        {/* Floating Add Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-[#2D9596] text-white rounded-2xl shadow-xl hover:bg-[#1F6B72] hover:-translate-y-1 transition-all flex items-center justify-center ring-4 ring-white"
        >
          <Plus className="w-8 h-8" />
        </button>

        {/* Modal Template */}
        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-[#2D9596] px-8 py-6">
                <h3 className="text-xl font-bold text-white">
                  {showAddModal ? `Add New ${activeTab === 'services' ? 'Service' : 'Medication'}` : `Edit ${activeTab === 'services' ? 'Service' : 'Medication'}`}
                </h3>
                <p className="text-white/80 text-sm mt-1">Fill in the details below</p>
              </div>
              
              <form onSubmit={showAddModal ? handleAddItem : handleEditItem} className="p-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">
                      {activeTab === 'services' ? 'Service Name' : 'Medicine Name'}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2D9596] focus:bg-white transition-all text-sm font-bold"
                      placeholder={activeTab === 'services' ? "eg. Root Canal" : "eg. Amoxicillin"}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2D9596] focus:bg-white transition-all text-sm font-bold"
                    >
                      {(activeTab === 'services' ? serviceCategories : medCategories).filter(c => c !== 'All Services' && c !== 'All').map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {activeTab === 'services' ? (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">
                        Price ({getCurrencySymbol()})
                      </label>
                      <input
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2D9596] focus:bg-white transition-all text-sm font-bold font-mono"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">
                          Dosage
                        </label>
                        <input
                          type="text"
                          value={formData.dosage}
                          onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2D9596] focus:bg-white transition-all text-sm font-bold"
                          placeholder="1-0-1"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">
                          Duration
                        </label>
                        <input
                          type="text"
                          value={formData.duration}
                          onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2D9596] focus:bg-white transition-all text-sm font-bold"
                          placeholder="5 days"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">
                          Default Qty
                        </label>
                        <input
                          type="text"
                          value={formData.quantity}
                          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2D9596] focus:bg-white transition-all text-sm font-bold"
                          placeholder="10"
                        />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">
                          Notes / Instructions
                        </label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2D9596] focus:bg-white transition-all text-sm font-medium"
                          rows="2"
                          placeholder="Special instructions..."
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-6 py-3 text-gray-500 font-bold text-sm uppercase tracking-widest hover:bg-gray-100 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-[#2D9596] text-white rounded-xl text-sm font-bold uppercase tracking-widest shadow-lg hover:shadow-xl hover:bg-[#1F6B72] transition-all disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
};

export default TreatmentsPricing;

