import React, { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useHeader } from "../contexts/HeaderContext";
import { useAuth } from "../contexts/AuthContext";
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import { ChevronLeft, Search, Plus, Upload, Info, Trash2 } from 'lucide-react';
import GearLoader from "../components/GearLoader";
import { getCurrencySymbol } from "../utils/currency";
import PracticeItemDrawer from "../components/settings/PracticeItemDrawer";
import BulkImportModal from "../components/settings/BulkImportModal";

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
            position: 'absolute', right: 0, top: 36, zIndex: 999,
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

const IMPORT_COLUMNS = {
  services: [
    { key: 'name', label: 'Name', required: true, placeholder: 'Root Canal' },
    { key: 'price', label: 'Price', required: true, type: 'number', placeholder: '2000' },
  ],
  medications: [
    { key: 'name', label: 'Name', required: true, placeholder: 'Amoxicillin' },
    { key: 'category', label: 'Category', placeholder: 'Antibiotics' },
    { key: 'dosage', label: 'Dosage', placeholder: '1-0-1' },
    { key: 'duration', label: 'Duration', placeholder: '5 days' },
    { key: 'quantity', label: 'Quantity', placeholder: '10' },
    { key: 'notes', label: 'Notes', placeholder: '' },
  ],
};

const TreatmentsPricing = () => {
  const { setTitle } = useHeader();
  const { user } = useAuth(); // eslint-disable-line no-unused-vars
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('services'); // 'services' | 'medications'

  const [treatmentTypes, setTreatmentTypes] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All Services');
  const serviceCategories = ['All Services', 'General', 'Orthodontics', 'Cosmetic'];

  const [medications, setMedications] = useState([]);
  const [selectedMedCategory, setSelectedMedCategory] = useState('All');
  const medCategories = ['All', 'General', 'Antibiotics', 'Analgesics', 'Gastrointestinal', 'Dental'];

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [drawer, setDrawer] = useState({ open: false, item: null });
  const [showImport, setShowImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const isServices = activeTab === 'services';
  const endpoint = isServices ? '/treatment-types' : '/medications';

  useEffect(() => {
    setTitle(
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Control Center</span>
        </button>
      </div>
    );
    fetchData();
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTitle, navigate, activeTab]);

  const fetchData = () => { isServices ? fetchTreatmentTypes() : fetchMedications(); };

  const fetchTreatmentTypes = async () => {
    try {
      setLoading(true);
      setTreatmentTypes(await api.get("/treatment-types"));
    } catch (error) {
      toast.error(getPermissionAwareErrorMessage(error, "Failed to load treatment types", "You don't have permission to view treatment services."));
    } finally { setLoading(false); }
  };

  const fetchMedications = async () => {
    try {
      setLoading(true);
      setMedications(await api.get("/medications"));
    } catch (error) {
      toast.error(getPermissionAwareErrorMessage(error, "Failed to load medications", "You don't have permission to view medications."));
    } finally { setLoading(false); }
  };

  // ── Save (add/edit) via the drawer ─────────────────────────────
  const saveItem = async (payload) => {
    setSaving(true);
    try {
      if (drawer.item) await api.put(`${endpoint}/${drawer.item.id}`, payload);
      else await api.post(endpoint, payload);
      toast.success(drawer.item ? "Updated successfully" : "Added successfully");
      setDrawer({ open: false, item: null });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to save ${isServices ? 'treatment' : 'medication'}`);
    } finally { setSaving(false); }
  };

  // ── Bulk import ────────────────────────────────────────────────
  const runImport = async (rows) => {
    setImporting(true);
    try {
      const items = isServices
        ? rows.map(r => ({ name: r.name, price: parseFloat(r.price) || 0 }))
        : rows.map(r => ({ name: r.name, category: r.category || 'General', dosage: r.dosage || '', duration: r.duration || '', quantity: String(r.quantity || ''), notes: r.notes || '' }));
      const res = await api.post(`${endpoint}/bulk`, { items });
      toast.success(`Imported ${res.created_count} ${isServices ? 'treatment(s)' : 'medication(s)'}`);
      if (res.errors?.length) toast.warning(`${res.errors.length} row(s) skipped. ${res.errors[0].message}`);
      setShowImport(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Import failed");
    } finally { setImporting(false); }
  };

  // ── Delete (single + bulk) ─────────────────────────────────────
  // Everything is removable: clinic items are deleted; system default meds are
  // hidden from this clinic's list (server handles the distinction).
  const isDeletable = () => true;

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectGroup = (items) => setSelectedIds(prev => {
    const ids = items.filter(isDeletable).map(i => i.id);
    const allOn = ids.every(id => prev.has(id));
    const next = new Set(prev);
    ids.forEach(id => allOn ? next.delete(id) : next.add(id));
    return next;
  });

  const bulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected ${isServices ? 'treatment(s)' : 'medication(s)'}? This cannot be undone.`)) return;
    setSaving(true);
    const results = await Promise.allSettled(ids.map(id => api.delete(`${endpoint}/${id}`)));
    const failed = results.filter(r => r.status === 'rejected').length;
    toast[failed ? 'warning' : 'success'](`Deleted ${ids.length - failed}${failed ? `, ${failed} failed` : ''}`);
    setSelectedIds(new Set());
    setSaving(false);
    fetchData();
  };

  const deleteOne = async (item) => {
    if (!window.confirm(`Delete this ${isServices ? 'treatment' : 'medication'}?`)) return;
    try {
      await api.delete(`${endpoint}/${item.id}`);
      toast.success("Deleted");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete");
    }
  };

  // ── Filtering / grouping ───────────────────────────────────────
  const filteredServices = treatmentTypes.filter(t => {
    const matchesCategory = selectedCategory === 'All Services' || t.category === selectedCategory || (!t.category && selectedCategory === 'General');
    return matchesCategory && t.name.toLowerCase().includes(searchQuery.toLowerCase());
  });
  const filteredMedications = medications.filter(m => {
    const matchesCategory = selectedMedCategory === 'All' || m.category === selectedMedCategory;
    return matchesCategory && m.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const groupBy = (list) => list.reduce((acc, it) => {
    const c = it.category || 'General';
    (acc[c] = acc[c] || []).push(it);
    return acc;
  }, {});
  const grouped = isServices ? groupBy(filteredServices) : groupBy(filteredMedications);

  if (loading && treatmentTypes.length === 0 && medications.length === 0) {
    return <div className="flex items-center justify-center h-screen"><GearLoader /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      <div className="mb-6 flex items-center gap-2 text-sm font-medium text-gray-500">
        <span>Control Center</span><span>/</span><span className="text-gray-900">Treatment & Pricing</span>
      </div>

      {/* Tabs + top-right actions */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex items-center justify-between -mb-px">
          <div className="flex gap-6">
            <button onClick={() => setActiveTab('services')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'services' ? 'border-[#29828a] text-[#29828a]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>Treatment & Pricing</button>
            <button onClick={() => setActiveTab('medications')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'medications' ? 'border-[#29828a] text-[#29828a]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>Medication</button>
          </div>
          <div className="flex items-center gap-3 pb-2">
            {isServices && <GSTInfoPopover />}
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              <Upload size={16} className="text-[#2D9596]" /> Import
            </button>
            <button
              onClick={() => setDrawer({ open: true, item: null })}
              className="flex items-center gap-2 px-4 py-2 bg-[#2D9596] text-white rounded-lg text-sm font-semibold hover:bg-[#1F6B72] transition-colors shadow-sm"
            >
              <Plus size={16} strokeWidth={2.5} /> {isServices ? 'Add treatment' : 'Add medication'}
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder={`Search ${isServices ? 'treatments' : 'medications'}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2D9596]"
        />
      </div>

      {/* Sub-category tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200 overflow-x-auto no-scrollbar">
        {(isServices ? serviceCategories : medCategories).map((category) => (
          <button
            key={category}
            onClick={() => isServices ? setSelectedCategory(category) : setSelectedMedCategory(category)}
            className={`pb-3 px-1 font-semibold whitespace-nowrap transition relative ${(isServices ? selectedCategory : selectedMedCategory) === category ? 'text-[#2D9596]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {category}
            {(isServices ? selectedCategory : selectedMedCategory) === category && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2D9596] rounded-full" />}
          </button>
        ))}
      </div>

      {/* Bulk-select action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between bg-[#2D9596] text-white rounded-xl px-4 py-2.5 shadow-sm">
          <span className="text-sm font-semibold">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-sm font-semibold rounded-lg hover:bg-white/10 transition">Clear</button>
            <button onClick={bulkDelete} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition disabled:opacity-50">
              <Trash2 size={15} /> Delete selected
            </button>
          </div>
        </div>
      )}

      {/* Grouped tables */}
      {Object.entries(grouped).map(([category, items]) => {
        const deletableIds = items.filter(isDeletable).map(i => i.id);
        const allSelected = deletableIds.length > 0 && deletableIds.every(id => selectedIds.has(id));
        return (
          <div key={category} className="mb-8">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{category.toUpperCase()}</h3>
              <span className="text-[10px] font-bold bg-[#E0F2F2] text-[#2D9596] px-2 py-0.5 rounded-full">{items.length} {items.length === 1 ? 'ITEM' : 'ITEMS'}</span>
            </div>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <input type="checkbox" checked={allSelected} onChange={() => toggleSelectGroup(items)} disabled={deletableIds.length === 0}
                          className="w-4 h-4 rounded border-gray-300 text-[#2D9596] focus:ring-[#2D9596]" />
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name</th>
                      {isServices ? (
                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Price</th>
                      ) : (
                        <>
                          <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dosage</th>
                          <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Duration</th>
                        </>
                      )}
                      <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item) => (
                      <tr key={item.id} className={`transition ${selectedIds.has(item.id) ? 'bg-[#2D9596]/5' : 'hover:bg-gray-50/50'}`}>
                        <td className="px-4 py-4">
                          <input type="checkbox" checked={selectedIds.has(item.id)} disabled={!isDeletable(item)} onChange={() => toggleSelect(item.id)}
                            className="w-4 h-4 rounded border-gray-300 text-[#2D9596] focus:ring-[#2D9596] disabled:opacity-30" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {!isServices && item.clinic_id === null && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" title="System Medication"></div>}
                            <span className="text-sm font-bold text-gray-900">{item.name}</span>
                          </div>
                        </td>
                        {isServices ? (
                          <td className="px-6 py-4 text-sm font-mono text-[#2D9596] font-bold">{getCurrencySymbol()}{item.price}</td>
                        ) : (
                          <>
                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">{item.dosage || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">{item.duration || '-'}</td>
                          </>
                        )}
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-3">
                            <button onClick={() => setDrawer({ open: true, item })} className="text-[#2D9596] hover:text-[#1F6B72] text-[11px] font-bold uppercase tracking-wider">Edit</button>
                            <button onClick={() => deleteOne(item)} className="text-red-400 hover:text-red-600 text-[11px] font-bold uppercase tracking-wider">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}

      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
          <Search className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No items found</p>
        </div>
      )}

      {/* Add / edit drawer */}
      <PracticeItemDrawer
        open={drawer.open}
        type={isServices ? 'service' : 'medication'}
        item={drawer.item}
        submitting={saving}
        onClose={() => setDrawer({ open: false, item: null })}
        onSubmit={saveItem}
      />

      {/* Bulk import */}
      <BulkImportModal
        open={showImport}
        title={isServices ? 'Import treatments' : 'Import medications'}
        columns={IMPORT_COLUMNS[activeTab]}
        importing={importing}
        onClose={() => setShowImport(false)}
        onImport={runImport}
      />
    </div>
  );
};

export default TreatmentsPricing;
