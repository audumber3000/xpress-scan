import React, { useState, useEffect, useMemo } from "react";
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import { useHeader } from "../contexts/HeaderContext";
import { toast } from "react-toastify";
import { Package, Building2, Edit2, Trash2, Search } from "lucide-react";
import InventoryAlerts from "../components/vendors/InventoryAlerts";
import InventoryTable from "../components/vendors/InventoryTable";
import VendorDrawer from "../components/vendors/VendorDrawer";

import Pagination from "../components/Pagination";
import FilterDropdown from "../components/FilterDropdown";

const VENDORS_PAGE_SIZE = 10;

const Vendors = () => {
    const { setTitle } = useHeader();
    const [vendors, setVendors] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [activeTab, setActiveTab] = useState('inventory');
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [showVendorDrawer, setShowVendorDrawer] = useState(false);
    const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);
    const [editingVendor, setEditingVendor] = useState(null);
    const [editingInventoryItem, setEditingInventoryItem] = useState(null);
    const [vendorsPage, setVendorsPage] = useState(1);

    // Search & filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStockStatus, setFilterStockStatus] = useState('');
    const [showEditInventoryModal, setShowEditInventoryModal] = useState(false);
    const [editInventoryFormData, setEditInventoryFormData] = useState({
        name: "",
        category: "Consumables",
        quantity: 0,
        unit: "units",
        min_stock_level: 10,
        vendor_id: ""
    });
    
    // Form State
    const [formData, setFormData] = useState({
        name: "",
        category: "General",
        contact_name: "",
        email: "",
        phone: "",
        address: "",
        gst_number: ""
    });

    const [inventoryFormData, setInventoryFormData] = useState({
        name: "",
        category: "Consumables",
        quantity: 0,
        unit: "units",
        min_stock_level: 10,
        vendor_id: ""
    });

    useEffect(() => {
        setTitle(''); // Clear global title to build our own header layout
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [vendorsData, inventoryData] = await Promise.all([
                api.get("/vendors"),
                api.get("/inventory")
            ]);
            setVendors(vendorsData);
            setInventory(inventoryData);
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(
                error,
                "Failed to load vendors and inventory",
                "You don't have permission to view this module."
            ));
        } finally {
            setLoading(false);
        }
    };

    // Filtered data memos
    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const term = searchTerm.toLowerCase();
            if (term && !item.name?.toLowerCase().includes(term) && !item.vendor_name?.toLowerCase().includes(term) && !item.category?.toLowerCase().includes(term)) return false;
            if (filterCategory && item.category !== filterCategory) return false;
            if (filterStockStatus) {
                const isLow = item.quantity <= item.min_stock_level;
                const isGettingLow = item.quantity <= item.min_stock_level * 1.5 && !isLow;
                if (filterStockStatus === 'Low Stock' && !isLow) return false;
                if (filterStockStatus === 'Getting Low' && !isGettingLow) return false;
                if (filterStockStatus === 'Healthy' && (isLow || isGettingLow)) return false;
            }
            return true;
        });
    }, [inventory, searchTerm, filterCategory, filterStockStatus]);

    const filteredVendors = useMemo(() => {
        return vendors.filter(v => {
            const term = searchTerm.toLowerCase();
            if (term && !v.name?.toLowerCase().includes(term) && !v.contact_name?.toLowerCase().includes(term) && !v.email?.toLowerCase().includes(term) && !v.phone?.includes(term)) return false;
            if (filterCategory && v.category !== filterCategory) return false;
            return true;
        });
    }, [vendors, searchTerm, filterCategory]);

    const uniqueInventoryCategories = useMemo(() => {
        const cats = new Set();
        inventory.forEach(i => { if (i.category) cats.add(i.category); });
        return [...cats].sort();
    }, [inventory]);

    const uniqueVendorCategories = useMemo(() => {
        const cats = new Set();
        vendors.forEach(v => { if (v.category) cats.add(v.category); });
        return [...cats].sort();
    }, [vendors]);

    const handleVendorSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingVendor) {
                await api.put(`/vendors/${editingVendor.id}`, formData);
                toast.success("Vendor updated successfully");
            } else {
                await api.post("/vendors", formData);
                toast.success("Vendor added successfully");
            }
            setShowVendorModal(false);
            setEditingVendor(null);
            fetchData();
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(
                error,
                "Failed to save vendor",
                "You don't have permission to manage vendors."
            ));
        }
    };

    const handleEditVendor = (vendor) => {
        setEditingVendor(vendor);
        setFormData({
            name: vendor.name || "",
            category: vendor.category || "General",
            contact_name: vendor.contact_name || "",
            email: vendor.email || "",
            phone: vendor.phone || "",
            address: vendor.address || "",
            gst_number: vendor.gst_number || ""
        });
        setShowVendorModal(true);
    };

    const handleAddInventorySubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post("/inventory", {
                ...inventoryFormData,
                quantity: parseFloat(inventoryFormData.quantity) || 0,
                min_stock_level: parseFloat(inventoryFormData.min_stock_level) || 0,
                vendor_id: inventoryFormData.vendor_id ? parseInt(inventoryFormData.vendor_id) : null
            });
            toast.success("Inventory item added successfully");
            setShowAddInventoryModal(false);
            setInventoryFormData({ name: "", category: "Consumables", quantity: 0, unit: "units", min_stock_level: 10, vendor_id: "" });
            fetchData();
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(
                error,
                "Failed to add inventory item",
                "You don't have permission to add inventory items."
            ));
        }
    };

    const handleRestockItem = async (itemId, newQty) => {
        try {
            await api.put(`/inventory/${itemId}`, { quantity: newQty });
            toast.success("Stock updated successfully");
            fetchData();
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(
                error,
                "Failed to update stock",
                "You don't have permission to edit inventory items."
            ));
        }
    };

    const handleUpdateInventoryItem = async (itemId, updates) => {
        try {
            await api.put(`/inventory/${itemId}`, updates);
            toast.success("Alert updated successfully");
            fetchData();
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(
                error,
                "Failed to update inventory item",
                "You don't have permission to edit inventory items."
            ));
        }
    };

    const handleEditInventoryItem = (item) => {
        setEditingInventoryItem(item);
        setEditInventoryFormData({
            name: item.name || "",
            category: item.category || "Consumables",
            quantity: item.quantity || 0,
            unit: item.unit || "units",
            min_stock_level: item.min_stock_level || 10,
            vendor_id: item.vendor_id || ""
        });
        setShowEditInventoryModal(true);
    };

    const handleUpdateInventorySubmit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/inventory/${editingInventoryItem.id}`, {
                ...editInventoryFormData,
                quantity: parseFloat(editInventoryFormData.quantity) || 0,
                min_stock_level: parseFloat(editInventoryFormData.min_stock_level) || 0,
                vendor_id: editInventoryFormData.vendor_id ? parseInt(editInventoryFormData.vendor_id) : null
            });
            toast.success("Item updated successfully");
            setShowEditInventoryModal(false);
            setEditingInventoryItem(null);
            fetchData();
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(
                error,
                "Failed to update item",
                "You don't have permission to edit inventory items."
            ));
        }
    };

    const handleDeleteInventoryItem = async (itemId) => {
        if (!window.confirm("Delete this inventory item?")) return;
        try {
            await api.delete(`/inventory/${itemId}`);
            toast.success("Item deleted");
            fetchData();
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(
                error,
                "Failed to delete item",
                "You don't have permission to delete inventory items."
            ));
        }
    };

    const handleDeleteVendor = async (vendorId) => {
        if (!window.confirm("Delete this vendor? This action cannot be undone.")) return;
        try {
            await api.delete(`/vendors/${vendorId}`);
            toast.success("Vendor deleted");
            fetchData();
        } catch (error) {
            toast.error(getPermissionAwareErrorMessage(
                error,
                "Failed to delete vendor",
                "You don't have permission to delete vendors."
            ));
        }
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#fafafa]">
            <>
                {/* Tabs row with action buttons on the right — page title is in the global header */}
                <div className="flex justify-between items-end border-b border-gray-200 mb-6">
                    <div className="flex gap-10">
                        {[
                            { id: 'inventory', label: 'Inventory', icon: Package },
                            { id: 'vendors', label: 'Vendors', icon: Building2 }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-4 flex items-center gap-2 text-sm font-semibold transition-all whitespace-nowrap border-b-2 relative top-[1px] ${
                                    activeTab === tab.id
                                        ? 'border-[#2a276e] text-[#2a276e]'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="pb-3 flex gap-3">
                        <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 flex items-center gap-2 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export
                        </button>
                        {activeTab === 'inventory' ? (
                            <button
                                onClick={() => setShowAddInventoryModal(true)}
                                className="bg-[#2a276e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                                </svg>
                                Add Inventory Item
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    setEditingVendor(null);
                                    setFormData({ name: "", category: "Equipment", contact_name: "", email: "", phone: "", address: "", gst_number: "" });
                                    setShowVendorModal(true);
                                }}
                                className="bg-[#2a276e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                                </svg>
                                Add New Vendor
                            </button>
                        )}
                    </div>
                </div>

                {/* Search & Filters toolbar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4">
                    <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                        <div className="w-full md:max-w-sm relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder={activeTab === 'inventory' ? 'Search inventory...' : 'Search vendors...'}
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setVendorsPage(1); }}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
                            />
                        </div>
                        <FilterDropdown
                            label="Category"
                            value={filterCategory}
                            onChange={(v) => { setFilterCategory(v); setVendorsPage(1); }}
                            options={activeTab === 'inventory' ? uniqueInventoryCategories : uniqueVendorCategories}
                        />
                        {activeTab === 'inventory' && (
                            <FilterDropdown
                                label="Status"
                                value={filterStockStatus}
                                onChange={(v) => { setFilterStockStatus(v); setVendorsPage(1); }}
                                options={['Healthy', 'Getting Low', 'Low Stock']}
                            />
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2a276e]"></div>
                    </div>
                ) : (
                    /* Two-column layout: main content + always-visible alerts sidebar */
                    <div className="flex flex-col xl:flex-row gap-6 h-[calc(100vh-250px)]">
                        {/* Left - Main Content (switches by tab) */}
                        <div className="flex-1 min-w-0 flex flex-col h-full">
                            {activeTab === 'inventory' ? (
                                <InventoryTable 
                                    inventory={filteredInventory} 
                                    onUpdateItem={handleUpdateInventoryItem}
                                    onOpenAdd={() => setShowAddInventoryModal(true)}
                                    onEditItem={handleEditInventoryItem}
                                    onDeleteItem={handleDeleteInventoryItem}
                                />
                            ) : (
                                /* Vendors Table */
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                                    <div className="flex-1 overflow-x-auto overflow-y-auto">
                                    <table className="w-full divide-y divide-gray-200">
                                        <thead className="bg-[#f8fafc] sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Details</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {vendors.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="px-6 py-12">
                                                        <div className="flex flex-col items-center justify-center text-center">
                                                            <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center text-gray-300 mb-4">
                                                                <Building2 size={32} />
                                                            </div>
                                                            <p className="text-sm font-medium text-gray-900">No Vendors</p>
                                                            <p className="text-xs text-gray-400 mt-1">Add vendors to manage your supply partners</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : filteredVendors.slice((vendorsPage - 1) * VENDORS_PAGE_SIZE, vendorsPage * VENDORS_PAGE_SIZE).map(vendor => (
                                                <tr key={vendor.id} className="hover:bg-indigo-50/30 transition-colors duration-150 group">
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
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{vendor.contact_name || '—'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{vendor.phone || '—'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{vendor.email || '—'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button 
                                                                onClick={() => handleEditVendor(vendor)}
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex"
                                                                title="Edit"
                                                            >
                                                                <Edit2 size={15} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteVendor(vendor.id)}
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}                                            
                                        </tbody>
                                    </table>
                                    </div>
                                    <Pagination
                                        page={vendorsPage}
                                        pageSize={VENDORS_PAGE_SIZE}
                                        totalItems={filteredVendors.length}
                                        onPageChange={setVendorsPage}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Right - Inventory Alerts (only relevant to the Inventory tab) */}
                        {activeTab === 'inventory' && (
                            <div className="w-full xl:w-[380px] shrink-0 flex flex-col h-full">
                                <InventoryAlerts
                                    inventory={inventory}
                                    onOpenVendors={() => setActiveTab('vendors')}
                                    onRestock={handleRestockItem}
                                />
                            </div>
                        )}
                    </div>
                )}
            </>

            {/* Vendor Modal */}
            {showVendorModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowVendorModal(false)}></div>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden">
                        <div className="bg-gray-50 p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-[#2a276e]">{editingVendor ? 'Edit Vendor Details' : 'Register New Vendor'}</h3>
                            <button onClick={() => setShowVendorModal(false)} className="text-gray-400 hover:text-gray-900">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>
                        <form onSubmit={handleVendorSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="col-span-2">
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Company Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] focus:bg-white outline-none font-medium transition-colors"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. DentalSource Inc."
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Category</label>
                                    <select
                                        className="w-full px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] focus:bg-white outline-none font-medium transition-colors"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        <option value="General">General</option>
                                        <option value="Equipment">Equipment</option>
                                        <option value="Consumables">Consumables</option>
                                        <option value="Lab Services">Lab Services</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Contact Person</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] focus:bg-white outline-none font-medium transition-colors"
                                        value={formData.contact_name}
                                        onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Email</label>
                                    <input
                                        type="email"
                                        className="w-full px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] focus:bg-white outline-none font-medium transition-colors"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Phone</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] focus:bg-white outline-none font-medium transition-colors"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">GST Number</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] focus:bg-white outline-none font-medium transition-colors"
                                        value={formData.gst_number}
                                        onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Address</label>
                                    <textarea
                                        rows="2"
                                        className="w-full px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] focus:bg-white outline-none font-medium transition-colors"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowVendorModal(false)}
                                    className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2.5 bg-[#2a276e] text-white rounded-xl font-bold hover:bg-[#1a1548] shadow-md transition-colors"
                                >
                                    {editingVendor ? 'Update Vendor' : 'Save Vendor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <VendorDrawer 
                isOpen={showVendorDrawer} 
                onClose={() => setShowVendorDrawer(false)}
                vendors={vendors}
                onEditVendor={handleEditVendor}
                onOpenAddVendor={() => {
                    setShowVendorDrawer(false);
                    setFormData({
                        name: "",
                        category: "General",
                        contact_name: "",
                        email: "",
                        phone: "",
                        address: "",
                        gst_number: ""
                    });
                    setEditingVendor(null);
                    setShowVendorModal(true);
                }}
            />

            {/* Add Inventory Item Modal */}
            {showAddInventoryModal && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowAddInventoryModal(false)}></div>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
                        <div className="bg-gray-50 p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-[#2a276e]">Add Inventory Item</h3>
                            <button onClick={() => setShowAddInventoryModal(false)} className="text-gray-400 hover:text-gray-900">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>
                        <form onSubmit={handleAddInventorySubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Item Name</label>
                                <input type="text" required className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] outline-none font-medium" value={inventoryFormData.name} onChange={e => setInventoryFormData({...inventoryFormData, name: e.target.value})} placeholder="e.g. Dental Mirror" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Quantity</label>
                                    <input type="number" required className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] outline-none font-medium" value={inventoryFormData.quantity} onChange={e => setInventoryFormData({...inventoryFormData, quantity: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Unit</label>
                                    <input type="text" className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] outline-none font-medium" value={inventoryFormData.unit} onChange={e => setInventoryFormData({...inventoryFormData, unit: e.target.value})} placeholder="e.g. units, ml" />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Alert Threshold</label>
                                    <input type="number" required className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] outline-none font-medium" value={inventoryFormData.min_stock_level} onChange={e => setInventoryFormData({...inventoryFormData, min_stock_level: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Category</label>
                                    <select className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] outline-none font-medium" value={inventoryFormData.category} onChange={e => setInventoryFormData({...inventoryFormData, category: e.target.value})}>
                                        <option value="Consumables">Consumables</option>
                                        <option value="Equipment">Equipment</option>
                                        <option value="Lab Services">Lab Services</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Supplier / Vendor</label>
                                <select className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] outline-none font-medium" value={inventoryFormData.vendor_id} onChange={e => setInventoryFormData({...inventoryFormData, vendor_id: e.target.value})}>
                                    <option value="">Select a vendor...</option>
                                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            </div>
                            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowAddInventoryModal(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-bold">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-[#2a276e] text-white rounded-lg font-bold hover:bg-[#1a1548]">Add Item</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Edit Inventory Item Modal */}
            {showEditInventoryModal && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowEditInventoryModal(false)}></div>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
                        <div className="bg-gray-50 p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-[#2a276e]">Edit Inventory Item</h3>
                            <button onClick={() => setShowEditInventoryModal(false)} className="text-gray-400 hover:text-gray-900">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>
                        <form onSubmit={handleUpdateInventorySubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Item Name</label>
                                <input type="text" required className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] outline-none font-medium" value={editInventoryFormData.name} onChange={e => setEditInventoryFormData({...editInventoryFormData, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Quantity</label>
                                    <input type="number" required className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] outline-none font-medium" value={editInventoryFormData.quantity} onChange={e => setEditInventoryFormData({...editInventoryFormData, quantity: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Unit</label>
                                    <input type="text" className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] outline-none font-medium" value={editInventoryFormData.unit} onChange={e => setEditInventoryFormData({...editInventoryFormData, unit: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Alert Threshold</label>
                                    <input type="number" required className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] outline-none font-medium" value={editInventoryFormData.min_stock_level} onChange={e => setEditInventoryFormData({...editInventoryFormData, min_stock_level: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Category</label>
                                    <select className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] outline-none font-medium" value={editInventoryFormData.category} onChange={e => setEditInventoryFormData({...editInventoryFormData, category: e.target.value})}>
                                        <option value="Consumables">Consumables</option>
                                        <option value="Equipment">Equipment</option>
                                        <option value="Lab Services">Lab Services</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Supplier / Vendor</label>
                                <select className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#2a276e] outline-none font-medium" value={editInventoryFormData.vendor_id} onChange={e => setEditInventoryFormData({...editInventoryFormData, vendor_id: e.target.value})}>
                                    <option value="">Select a vendor...</option>
                                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            </div>
                            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowEditInventoryModal(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-bold">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-[#2a276e] text-white rounded-lg font-bold hover:bg-[#1a1548]">Update Item</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Vendors;
