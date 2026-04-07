import React, { useState, useEffect } from 'react';
import { useHeader } from '../../contexts/HeaderContext';
import { api, getPermissionAwareErrorMessage } from '../../utils/api';
import { toast } from 'react-toastify';
import LabOrderDrawer from '../../components/patient/LabOrderDrawer';
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
    const [isVendorDrawerOpen, setIsVendorDrawerOpen] = useState(false);
    const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);
    
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
            case 'Received': return 'bg-green-50 text-green-700 border-green-100';
            case 'Cancelled': return 'bg-red-50 text-red-700 border-red-100';
            default: return 'bg-gray-50 text-gray-700 border-gray-100';
        }
    };

    return (
        <div className="flex-1 bg-gray-50/50 min-h-screen pb-10">
            <div className="px-8 mt-6 max-w-7xl mx-auto space-y-6">

                {/* Page Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Laboratory</h1>
                        <p className="text-sm text-gray-500 mt-1">Manage lab partners and clinical work orders</p>
                    </div>
                    <div>
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

                {/* Navigation Tabs */}
                <div className="flex gap-10 border-b border-gray-200">
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

                {/* Tab Views */}
                <div className="animate-fade-in relative pt-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 space-y-4">
                            <div className="w-12 h-12 border-4 border-[#2a276e]/10 border-t-[#2a276e] rounded-full animate-spin" />
                            <p className="text-sm text-gray-500">Loading...</p>
                        </div>
                    ) : activeTab === 'orders' ? (
                        <div className="space-y-4">
                            {orders.length > 0 ? (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Details</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lab Partner</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {orders.map(order => (
                                                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-[#2a276e]/5 rounded-lg flex items-center justify-center text-[#2a276e]">
                                                                <Beaker size={18} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-900">{order.work_type}</p>
                                                                {order.tooth_number && <p className="text-xs text-gray-500">Tooth #{order.tooth_number} • Shade {order.shade}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <p className="text-sm font-medium text-gray-900">{order.patient_name}</p>
                                                        <p className="text-xs text-gray-500">ID: {order.patient_id}</p>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <p className="text-sm text-gray-900">{order.vendor_name}</p>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {order.due_date ? (
                                                            <div>
                                                                <p className="text-sm text-gray-900">{new Date(order.due_date).toLocaleDateString()}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    {(() => {
                                                                        const daysUntil = Math.ceil((new Date(order.due_date) - new Date()) / (1000 * 60 * 60 * 24));
                                                                        if (daysUntil < 0) return `Overdue by ${Math.abs(daysUntil)} days`;
                                                                        if (daysUntil === 0) return 'Due today';
                                                                        if (daysUntil === 1) return 'Due tomorrow';
                                                                        return `In ${daysUntil} days`;
                                                                    })()}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm text-gray-400">Not set</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status).replace('border-', 'border ')}`}>
                                                            {order.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
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
                        <div className="space-y-4">
                            {vendors.length > 0 ? (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lab Partner</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {vendors.map(vendor => (
                                                <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-[#2a276e]/5 rounded-lg flex items-center justify-center text-[#2a276e]">
                                                                <Building2 size={18} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-900">{vendor.name}</p>
                                                                <p className="text-xs text-gray-500">Lab Partner</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {vendor.phone || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {vendor.email || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        <div className="max-w-xs truncate">
                                                            {vendor.address || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
                                                            Active
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
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
