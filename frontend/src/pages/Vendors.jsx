import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import { useHeader } from "../contexts/HeaderContext";
import { toast } from "react-toastify";
import { Package, Pill, Building2, Activity, Edit2, Trash2, Search, Plus, Upload } from "lucide-react";
import InventoryAlerts from "../components/vendors/InventoryAlerts";
import InventoryTable from "../components/vendors/InventoryTable";
import MedicationTable from "../components/vendors/MedicationTable";
import InventoryLedger from "../components/vendors/InventoryLedger";
import InventoryItemDrawer from "../components/vendors/InventoryItemDrawer";
import MedicationDrawer from "../components/vendors/MedicationDrawer";
import VendorFormDrawer from "../components/vendors/VendorFormDrawer";
import StockAlertCapsule from "../components/vendors/StockAlertCapsule";
import MedicationStockImportModal from "../components/vendors/MedicationStockImportModal";
import Pagination from "../components/Pagination";
import FilterDropdown from "../components/FilterDropdown";

const VENDORS_PAGE_SIZE = 10;

const Vendors = () => {
    const { setTitle } = useHeader();
    const navigate = useNavigate();
    const location = useLocation();
    const [vendors, setVendors] = useState([]);
    const [inventory, setInventory] = useState([]);      // general stock
    const [medications, setMedications] = useState([]);  // medication stock
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState('stock');  // stock | medications | ledger | vendors
    const [vendorsPage, setVendorsPage] = useState(1);

    // Search & filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStockStatus, setFilterStockStatus] = useState('');

    // Drawers — one shared right-panel per entity, {open, item}
    const [stockDrawer, setStockDrawer] = useState({ open: false, item: null });
    const [medDrawer, setMedDrawer] = useState({ open: false, item: null });
    const [vendorDrawer, setVendorDrawer] = useState({ open: false, vendor: null });
    const [alertsOpen, setAlertsOpen] = useState(false);
    const [showMedImport, setShowMedImport] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setTitle('');
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [vendorsData, inventoryData, medsData] = await Promise.all([
                api.get("/vendors"),
                api.get("/inventory"),
                api.get("/medication-stock"),
            ]);
            setVendors(vendorsData || []);
            setInventory(inventoryData || []);
            setMedications(medsData || []);
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(error, "Failed to load inventory", "You don't have permission to view this module."));
        } finally {
            setLoading(false);
        }
    };

    const matchesSearch = (fields) => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;
        return fields.some((f) => (f || '').toLowerCase().includes(term));
    };
    const matchesStockStatus = (item) => {
        if (!filterStockStatus) return true;
        const isLow = item.quantity <= item.min_stock_level;
        const isGettingLow = item.quantity <= item.min_stock_level * 1.5 && !isLow;
        if (filterStockStatus === 'Low Stock') return isLow;
        if (filterStockStatus === 'Getting Low') return isGettingLow;
        if (filterStockStatus === 'Healthy') return !isLow && !isGettingLow;
        return true;
    };

    const filteredInventory = useMemo(() => inventory.filter(item =>
        matchesSearch([item.name, item.vendor_name, item.category]) &&
        (!filterCategory || item.category === filterCategory) &&
        matchesStockStatus(item)
    ), [inventory, searchTerm, filterCategory, filterStockStatus]);

    const filteredMedications = useMemo(() => medications.filter(item =>
        matchesSearch([item.name, item.generic_name, item.vendor_name, item.form]) &&
        matchesStockStatus(item)
    ), [medications, searchTerm, filterStockStatus]);

    const filteredVendors = useMemo(() => vendors.filter(v =>
        matchesSearch([v.name, v.contact_name, v.email, v.phone]) &&
        (!filterCategory || v.category === filterCategory)
    ), [vendors, searchTerm, filterCategory]);

    const uniqueInventoryCategories = useMemo(() => [...new Set(inventory.map(i => i.category).filter(Boolean))].sort(), [inventory]);
    const uniqueVendorCategories = useMemo(() => [...new Set(vendors.map(v => v.category).filter(Boolean))].sort(), [vendors]);

    // ── Save handlers (drawers call these) ─────────────────────────
    const saveStock = async (payload) => {
        setSaving(true);
        try {
            if (stockDrawer.item) await api.put(`/inventory/${stockDrawer.item.id}`, payload);
            else await api.post("/inventory", payload);
            toast.success(stockDrawer.item ? "Item updated" : "Item added");
            setStockDrawer({ open: false, item: null });
            fetchData();
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(error, "Failed to save item", "You don't have permission to manage inventory."));
        } finally { setSaving(false); }
    };

    const saveMedication = async (payload) => {
        setSaving(true);
        try {
            if (medDrawer.item) await api.put(`/medication-stock/${medDrawer.item.id}`, payload);
            else await api.post("/medication-stock", payload);
            toast.success(medDrawer.item ? "Medication updated" : "Medication added");
            setMedDrawer({ open: false, item: null });
            fetchData();
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(error, "Failed to save medication", "You don't have permission to manage inventory."));
        } finally { setSaving(false); }
    };

    const saveVendor = async (payload) => {
        setSaving(true);
        try {
            if (vendorDrawer.vendor) await api.put(`/vendors/${vendorDrawer.vendor.id}`, payload);
            else await api.post("/vendors", payload);
            toast.success(vendorDrawer.vendor ? "Vendor updated" : "Vendor added");
            setVendorDrawer({ open: false, vendor: null });
            fetchData();
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(error, "Failed to save vendor", "You don't have permission to manage vendors."));
        } finally { setSaving(false); }
    };

    const restock = async (endpoint, itemId, newQty) => {
        try {
            await api.put(`/${endpoint}/${itemId}`, { quantity: newQty });
            toast.success("Stock updated");
            fetchData();
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(error, "Failed to update stock", "You don't have permission to edit inventory."));
        }
    };

    const deleteItem = async (endpoint, itemId, label) => {
        if (!window.confirm(`Delete this ${label}?`)) return;
        try {
            await api.delete(`/${endpoint}/${itemId}`);
            toast.success("Deleted");
            fetchData();
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(error, "Failed to delete", "You don't have permission to delete."));
        }
    };

    // Deep link: /vendors?item=<id> opens that stock item's editor.
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const id = params.get('item');
        if (!id) return;
        const item = inventory.find(i => String(i.id) === id);
        if (!item) return;
        setActiveTab('stock');
        setStockDrawer({ open: true, item });
        params.delete('item');
        navigate({ search: params.toString() }, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search, inventory]);

    const TABS = [
        { id: 'stock', label: 'General Stock', icon: Package },
        { id: 'medications', label: 'Medications', icon: Pill },
        { id: 'ledger', label: 'Activity', icon: Activity },
        { id: 'vendors', label: 'Vendors', icon: Building2 },
    ];

    const showsFilters = activeTab !== 'ledger';
    const showsCategory = activeTab === 'stock' || activeTab === 'vendors';
    const showsStockStatus = activeTab === 'stock' || activeTab === 'medications';
    const showsAlerts = activeTab === 'stock' || activeTab === 'medications';

    const addButton = () => {
        if (activeTab === 'stock') return { label: 'Add stock item', onClick: () => setStockDrawer({ open: true, item: null }) };
        if (activeTab === 'medications') return { label: 'Add medication', onClick: () => setMedDrawer({ open: true, item: null }) };
        if (activeTab === 'vendors') return { label: 'Add vendor', onClick: () => setVendorDrawer({ open: true, vendor: null }) };
        return null;
    };
    const addBtn = addButton();

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#fafafa]">
            {/* Tabs */}
            <div className="flex items-end border-b border-gray-200 mb-6">
                <div className="flex gap-8 overflow-x-auto">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSearchTerm(''); setFilterCategory(''); setFilterStockStatus(''); }}
                            className={`pb-4 flex items-center gap-2 text-sm font-semibold transition-all whitespace-nowrap border-b-2 relative top-[1px] ${
                                activeTab === tab.id ? 'border-[#2a276e] text-[#2a276e]' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search & filters */}
            {showsFilters && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4">
                    <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                        <div className="w-full md:max-w-sm relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder={`Search ${activeTab === 'vendors' ? 'vendors' : activeTab === 'medications' ? 'medications' : 'stock'}...`}
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setVendorsPage(1); }}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
                            />
                        </div>
                        {showsCategory && (
                            <FilterDropdown
                                label="Category"
                                value={filterCategory}
                                onChange={(v) => { setFilterCategory(v); setVendorsPage(1); }}
                                options={activeTab === 'vendors' ? uniqueVendorCategories : uniqueInventoryCategories}
                            />
                        )}
                        {showsStockStatus && (
                            <FilterDropdown
                                label="Status"
                                value={filterStockStatus}
                                onChange={(v) => setFilterStockStatus(v)}
                                options={['Healthy', 'Getting Low', 'Low Stock']}
                            />
                        )}
                    </div>
                    {/* Right cluster: alerts capsule (stock/medications) + primary add */}
                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        {showsAlerts && (
                            <StockAlertCapsule
                                items={activeTab === 'medications' ? medications : inventory}
                                onClick={() => setAlertsOpen(true)}
                            />
                        )}
                        {activeTab === 'medications' && (
                            <button
                                onClick={() => setShowMedImport(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                            >
                                <Upload size={16} className="text-[#2a276e]" /> Import
                            </button>
                        )}
                        {addBtn && (
                            <button
                                onClick={addBtn.onClick}
                                className="bg-[#2a276e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap"
                            >
                                <Plus size={16} strokeWidth={2.5} /> {addBtn.label}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2a276e]"></div>
                </div>
            ) : (
                <div className="h-[calc(100vh-250px)]">
                    <div className="flex flex-col h-full min-w-0">
                        {activeTab === 'stock' && (
                            <InventoryTable
                                inventory={filteredInventory}
                                onEditItem={(item) => setStockDrawer({ open: true, item })}
                                onDeleteItem={(id) => deleteItem('inventory', id, 'stock item')}
                            />
                        )}
                        {activeTab === 'medications' && (
                            <MedicationTable
                                medications={filteredMedications}
                                onEditItem={(item) => setMedDrawer({ open: true, item })}
                                onDeleteItem={(id) => deleteItem('medication-stock', id, 'medication')}
                            />
                        )}
                        {activeTab === 'ledger' && (
                            <InventoryLedger inventoryItems={inventory} onStockChanged={fetchData} />
                        )}
                        {activeTab === 'vendors' && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                                <div className="flex-1 overflow-x-auto overflow-y-auto">
                                    <table className="w-full divide-y divide-gray-200">
                                        <thead className="bg-[#f8fafc] sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Details</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {filteredVendors.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="px-6 py-12">
                                                        <div className="flex flex-col items-center justify-center text-center">
                                                            <Building2 className="w-12 h-12 text-gray-300 mb-3" strokeWidth={1.5} />
                                                            <p className="text-sm font-bold text-gray-900">No vendors</p>
                                                            <p className="text-xs text-gray-400 mt-1">Add vendors to manage your supply partners</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : filteredVendors.slice((vendorsPage - 1) * VENDORS_PAGE_SIZE, vendorsPage * VENDORS_PAGE_SIZE).map(vendor => (
                                                <tr key={vendor.id} onClick={() => setVendorDrawer({ open: true, vendor })} className="hover:bg-indigo-50/30 transition-colors duration-150 cursor-pointer">
                                                    <td className="px-6 py-5 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 bg-[#2a276e]/10 rounded-full flex items-center justify-center text-[#2a276e] flex-shrink-0">
                                                                <Building2 size={16} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-semibold text-gray-900">{vendor.name}</p>
                                                                <p className="text-xs text-gray-400">{vendor.contact_name || 'No contact person'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                            {vendor.category || 'General'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{vendor.phone || '—'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{vendor.email || '—'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button onClick={(e) => { e.stopPropagation(); setVendorDrawer({ open: true, vendor }); }} className="p-1.5 text-gray-400 hover:text-[#2a276e] hover:bg-[#2a276e]/5 rounded-lg transition-colors inline-flex" title="Edit">
                                                                <Edit2 size={15} />
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); deleteItem('vendors', vendor.id, 'vendor'); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex" title="Delete">
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination page={vendorsPage} pageSize={VENDORS_PAGE_SIZE} totalItems={filteredVendors.length} onPageChange={setVendorsPage} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Drawers — every create/edit uses the right-side panel */}
            <InventoryItemDrawer
                open={stockDrawer.open}
                item={stockDrawer.item}
                vendors={vendors}
                submitting={saving}
                onClose={() => setStockDrawer({ open: false, item: null })}
                onSubmit={saveStock}
            />
            <MedicationDrawer
                open={medDrawer.open}
                item={medDrawer.item}
                vendors={vendors}
                submitting={saving}
                onClose={() => setMedDrawer({ open: false, item: null })}
                onSubmit={saveMedication}
            />
            <VendorFormDrawer
                open={vendorDrawer.open}
                vendor={vendorDrawer.vendor}
                submitting={saving}
                onClose={() => setVendorDrawer({ open: false, vendor: null })}
                onSubmit={saveVendor}
            />

            <MedicationStockImportModal
                open={showMedImport}
                vendors={vendors}
                onClose={() => setShowMedImport(false)}
                onImported={fetchData}
            />

            {/* Alerts — opens from the capsule in the toolbar */}
            {alertsOpen && showsAlerts && (
                <div className="fixed inset-0 z-[70]">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setAlertsOpen(false)} />
                    <div className="absolute right-0 top-0 h-full w-full max-w-md bg-gray-50 shadow-2xl flex flex-col animate-slide-in-right p-4">
                        <InventoryAlerts
                            items={activeTab === 'medications' ? medications : inventory}
                            label={activeTab === 'medications' ? 'Medication' : 'Stock'}
                            onClose={() => setAlertsOpen(false)}
                            onOpenVendors={() => { setAlertsOpen(false); setActiveTab('vendors'); }}
                            onRestock={(id, qty) => restock(activeTab === 'medications' ? 'medication-stock' : 'inventory', id, qty)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Vendors;
