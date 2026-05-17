import React, { useState, useEffect, useMemo } from 'react';
import { useHeader } from '../../contexts/HeaderContext';
import { api, getPermissionAwareErrorMessage } from '../../utils/api';
import { toast } from 'react-toastify';
import LabOrderDrawer from '../../components/patient/LabOrderDrawer';
import Pagination from '../../components/Pagination';
import FilterDropdown from '../../components/FilterDropdown';
import { generatePatientPersona, generateInitialsAvatar } from '../../utils/avatar';

const LAB_PAGE_SIZE = 10;
import { 
    Beaker, 
    Building2, 
    Plus, 
    Search, 
    Filter, 
    MoreHorizontal, 
    Clock, 
    CheckCircle2, 
    AlertCircle,
    Phone,
    Mail,
    Globe,
    Calendar,
    ChevronRight,
    MapPin
} from 'lucide-react';

const LabHub = () => {
    const { setTitle } = useHeader();
    const [activeTab, setActiveTab] = useState('orders');
    const [orders, setOrders] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ordersPage, setOrdersPage] = useState(1);
    const [vendorsPage, setVendorsPage] = useState(1);
    const [isVendorDrawerOpen, setIsVendorDrawerOpen] = useState(false);
    const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);

    // Search & filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    
    // New Vendor Form
    const [vendorForm, setVendorForm] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        category: 'lab',
        is_active: true
    });

    useEffect(() => {
        setTitle('Laboratory');
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'orders') {
                const res = await api.get('/clinical/lab-orders');
                setOrders(res);
            } else {
                const res = await api.get('/vendors?category=lab');
                setVendors(res);
            }
        } catch (err) {
            console.error("Failed to fetch lab data:", err);
            toast.error(getPermissionAwareErrorMessage(
                err,
                "Failed to load data",
                "You don't have permission to view this module."
            ));
        } finally {
            setLoading(false);
        }
    };

    const handleAddVendor = async (e) => {
        e.preventDefault();
        try {
            await api.post('/vendors', vendorForm);
            toast.success("Lab vendor added successfully");
            setIsVendorDrawerOpen(false);
            setVendorForm({ name: '', phone: '', email: '', address: '', category: 'lab', is_active: true });
            fetchData();
        } catch (err) {
            console.error("Failed to add vendor:", err);
            toast.error(getPermissionAwareErrorMessage(
                err,
                "Failed to add vendor",
                "You don't have permission to add lab vendors."
            ));
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Sent': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'In Progress': return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'Received': return 'bg-green-50 text-green-700 border-green-100';
            case 'Cancelled': return 'bg-red-50 text-red-700 border-red-100';
            default: return 'bg-gray-50 text-gray-700 border-gray-100';
        }
    };

    const ORDER_STATUSES = ['Draft', 'Sent', 'In Progress', 'Received', 'Cancelled'];

    const updateOrderStatus = async (orderId, newStatus) => {
        try {
            await api.put(`/clinical/lab-orders/${orderId}`, { status: newStatus });
            setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: newStatus } : o)));
            toast.success(`Status updated to "${newStatus}"`);
        } catch (err) {
            console.error("Failed to update status:", err);
            toast.error(getPermissionAwareErrorMessage(
                err,
                "Failed to update order status",
                "You don't have permission to update lab orders."
            ));
        }
    };

    // Filtered data
    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            const term = searchTerm.toLowerCase();
            if (term && !o.work_type?.toLowerCase().includes(term) && !o.patient_name?.toLowerCase().includes(term) && !o.vendor_name?.toLowerCase().includes(term)) return false;
            if (filterStatus && o.status !== filterStatus) return false;
            return true;
        });
    }, [orders, searchTerm, filterStatus]);

    const filteredLabVendors = useMemo(() => {
        return vendors.filter(v => {
            const term = searchTerm.toLowerCase();
            if (term && !v.name?.toLowerCase().includes(term) && !v.phone?.includes(term) && !v.email?.toLowerCase().includes(term)) return false;
            return true;
        });
    }, [vendors, searchTerm]);

    return (
        <div className="flex flex-col h-screen bg-gray-50/50">
            <div className="flex-1 flex flex-col px-6 pt-4 max-w-[1600px] mx-auto w-full overflow-hidden">

                {/* Tabs row with primary action on the right — page title is already in the global header */}
                <div className="flex justify-between items-end border-b border-gray-200">
                    <div className="flex gap-10">
                        {[
                            { id: 'orders', label: 'Clinical Orders', icon: Beaker },
                            { id: 'vendors', label: 'Technical Partners', icon: Building2 }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-4 flex items-center gap-2 text-sm font-semibold transition-all whitespace-nowrap border-b-2 relative top-[1px] ${
                                    activeTab === tab.id
                                        ? 'border-[#2a276e] text-[#2a276e]'
                                        : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                <tab.icon size={16} strokeWidth={activeTab === tab.id ? 3 : 2} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="pb-3">
                        {activeTab === 'orders' ? (
                            <button
                                onClick={() => setIsOrderDrawerOpen(true)}
                                className="bg-[#2a276e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm flex items-center gap-2"
                            >
                                <Plus size={18} />
                                Create Order
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsVendorDrawerOpen(true)}
                                className="bg-[#2a276e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm flex items-center gap-2"
                            >
                                <Plus size={18} />
                                Add Vendor
                            </button>
                        )}
                    </div>
                </div>

                {/* Search & Filters toolbar */}
                <div className="flex items-center gap-3 py-4">
                    <div className="w-full max-w-sm relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder={activeTab === 'orders' ? 'Search orders...' : 'Search lab partners...'}
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setOrdersPage(1); setVendorsPage(1); }}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
                        />
                    </div>
                    {activeTab === 'orders' && (
                        <FilterDropdown
                            label="Status"
                            value={filterStatus}
                            onChange={(v) => { setFilterStatus(v); setOrdersPage(1); }}
                            options={ORDER_STATUSES}
                        />
                    )}
                </div>

                {/* Tab Views */}
                <div className="animate-fade-in relative flex-1 flex flex-col min-h-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 space-y-4">
                            <div className="w-12 h-12 border-4 border-[#2a276e]/10 border-t-[#2a276e] rounded-full animate-spin" />
                            <p className="text-sm text-gray-500">Loading...</p>
                        </div>
                    ) : activeTab === 'orders' ? (
                        <div className="flex flex-col flex-1 min-h-0">
                            {orders.length > 0 ? (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
                                    <div className="flex-1 overflow-x-auto overflow-y-auto">
                                    <table className="w-full divide-y divide-gray-200">
                                        <thead className="bg-[#f8fafc] sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Order Details</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lab Partner</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {filteredOrders.slice((ordersPage - 1) * LAB_PAGE_SIZE, ordersPage * LAB_PAGE_SIZE).map(order => {
                                                const isTerminal = order.status === 'Received' || order.status === 'Cancelled';
                                                const daysUntil = order.due_date ? Math.ceil((new Date(order.due_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
                                                const dueDateColor = isTerminal ? 'text-green-600' : daysUntil === null ? '' : daysUntil < 0 ? 'text-red-600' : daysUntil <= 2 ? 'text-amber-600' : 'text-gray-500';
                                                const dueDateLabel = isTerminal
                                                    ? (order.status === 'Received' ? 'Delivered' : 'Cancelled')
                                                    : daysUntil === null ? ''
                                                    : daysUntil < 0 ? `Overdue by ${Math.abs(daysUntil)} days`
                                                    : daysUntil === 0 ? 'Due today'
                                                    : daysUntil === 1 ? 'Due tomorrow'
                                                    : `In ${daysUntil} days`;
                                                return (
                                                <tr key={order.id} className="hover:bg-indigo-50/30 transition-colors duration-150 group">
                                                    <td className="px-6 py-5 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 bg-[#2a276e]/10 rounded-full flex items-center justify-center text-[#2a276e] flex-shrink-0">
                                                                <Beaker size={16} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-semibold text-gray-900">{order.work_type}</p>
                                                                {order.tooth_number && <p className="text-xs text-gray-400">Tooth #{order.tooth_number} • Shade {order.shade}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <img 
                                                                src={generatePatientPersona({ name: order.patient_name }, 80)} 
                                                                onError={(e) => { e.target.onerror = null; e.target.src = generateInitialsAvatar(order.patient_name || 'Patient'); }}
                                                                alt={order.patient_name} 
                                                                className="w-8 h-8 rounded-full flex-shrink-0 object-cover border border-gray-100"
                                                            />
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-900">{order.patient_name}</p>
                                                                <p className="text-xs text-gray-400">ID: {order.patient_id}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="text-sm text-gray-700">{order.vendor_name}</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {order.due_date ? (
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-900">{new Date(order.due_date).toLocaleDateString()}</p>
                                                                <p className={`text-xs font-medium ${dueDateColor}`}>
                                                                    {dueDateLabel}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm text-gray-400">Not set</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900 tabular-nums">
                                                        {order.cost && parseFloat(order.cost) > 0
                                                            ? `₹${parseFloat(order.cost).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                                                            : <span className="text-gray-300">—</span>}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                        <select
                                                            value={order.status || 'Draft'}
                                                            onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className={`px-2.5 py-1 pr-7 text-xs leading-5 font-semibold rounded-full border cursor-pointer appearance-none bg-[length:14px] bg-[right_6px_center] bg-no-repeat focus:outline-none focus:ring-2 focus:ring-[#2a276e]/30 ${getStatusColor(order.status)}`}
                                                            style={{
                                                                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='3'><path stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/></svg>")`,
                                                            }}
                                                            title="Update status"
                                                        >
                                                            {ORDER_STATUSES.map(s => (
                                                                <option key={s} value={s}>{s}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    </div>
                                    <Pagination
                                        page={ordersPage}
                                        pageSize={LAB_PAGE_SIZE}
                                        totalItems={filteredOrders.length}
                                        onPageChange={setOrdersPage}
                                    />
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center text-gray-300 mb-4">
                                        <Beaker size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900">No Lab Orders</h3>
                                    <p className="text-sm text-gray-500 max-w-sm mt-2">Create lab orders from patient case papers to track clinical work.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Vendors Table */
                        <div className="flex flex-col flex-1 min-h-0">
                            {vendors.length > 0 ? (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
                                    <div className="flex-1 overflow-x-auto overflow-y-auto">
                                    <table className="w-full divide-y divide-gray-200">
                                        <thead className="bg-[#f8fafc] sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lab Partner</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {filteredLabVendors.slice((vendorsPage - 1) * LAB_PAGE_SIZE, vendorsPage * LAB_PAGE_SIZE).map(vendor => (
                                                <tr key={vendor.id} className="hover:bg-indigo-50/30 transition-colors duration-150 group">
                                                    <td className="px-6 py-5 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 bg-[#2a276e]/10 rounded-full flex items-center justify-center text-[#2a276e] flex-shrink-0">
                                                                <Building2 size={16} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-semibold text-gray-900">{vendor.name}</p>
                                                                <p className="text-xs text-gray-400">Lab Partner</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {vendor.phone || '—'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {vendor.email || '—'}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        <div className="max-w-xs truncate">
                                                            {vendor.address || '—'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                            Active
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    </div>
                                    <Pagination
                                        page={vendorsPage}
                                        pageSize={LAB_PAGE_SIZE}
                                        totalItems={filteredLabVendors.length}
                                        onPageChange={setVendorsPage}
                                    />
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center text-gray-300 mb-4">
                                        <Building2 size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900">No Lab Partners</h3>
                                    <p className="text-sm text-gray-500 max-w-sm mt-2">Add lab partners to manage external laboratory work.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Vendor Drawer */}
            <div className={`fixed inset-0 z-[100] ${isVendorDrawerOpen ? 'visible' : 'invisible'}`}>
                <div className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isVendorDrawerOpen ? 'opacity-100' : 'opacity-0'}`}
                     onClick={() => setIsVendorDrawerOpen(false)} />
                <div className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 ${isVendorDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="px-8 py-8 border-b border-gray-50 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">New Lab Partner</h2>
                            <p className="text-sm text-gray-500 mt-1">Add a new laboratory vendor</p>
                        </div>
                        <button onClick={() => setIsVendorDrawerOpen(false)} className="w-12 h-12 rounded-2xl hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
                            <Plus size={24} className="rotate-45" />
                        </button>
                    </div>
                    
                    <form onSubmit={handleAddVendor} className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
                       <div className="space-y-2">
                           <label className="text-xs font-medium text-gray-700">Laboratory Name</label>
                           <input 
                            required
                            type="text" 
                            placeholder="e.g. Precision Dental Labs" 
                            value={vendorForm.name}
                            onChange={e => setVendorForm({...vendorForm, name: e.target.value})}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 outline-none text-sm transition-all" 
                           />
                       </div>
                       <div className="space-y-2">
                           <label className="text-xs font-medium text-gray-700">Contact Number</label>
                           <input 
                            required
                            type="text" 
                            placeholder="+1 234 567 890" 
                            value={vendorForm.phone}
                            onChange={e => setVendorForm({...vendorForm, phone: e.target.value})}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 outline-none text-sm transition-all" 
                           />
                       </div>
                       <div className="space-y-2">
                           <label className="text-xs font-medium text-gray-700">Email (Optional)</label>
                           <input 
                            type="email" 
                            placeholder="contact@lab.com" 
                            value={vendorForm.email}
                            onChange={e => setVendorForm({...vendorForm, email: e.target.value})}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 outline-none text-sm transition-all" 
                           />
                       </div>
                       <div className="space-y-2">
                           <label className="text-xs font-medium text-gray-700">Laboratory Address</label>
                           <textarea 
                            rows={3}
                            placeholder="Full physical address..." 
                            value={vendorForm.address}
                            onChange={e => setVendorForm({...vendorForm, address: e.target.value})}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 outline-none text-sm resize-none transition-all" 
                           />
                       </div>
                    </form>
                    
                    <div className="px-8 py-8 border-t border-gray-50 bg-gray-50/30">
                        <button type="submit" onClick={handleAddVendor} className="w-full py-3 bg-[#2a276e] text-white rounded-lg font-semibold hover:bg-[#1a1548] transition-colors shadow-sm">
                            Add Lab Partner
                        </button>
                    </div>
                </div>
            </div>

            {/* Lab Order Drawer */}
            <LabOrderDrawer
                isOpen={isOrderDrawerOpen}
                onClose={() => setIsOrderDrawerOpen(false)}
                patientId={null}
                casePaperId={null}
                onSave={() => { fetchData(); setIsOrderDrawerOpen(false); }}
            />
        </div>
    );
};

export default LabHub;
