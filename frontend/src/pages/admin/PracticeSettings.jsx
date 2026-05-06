import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Plus, Edit2, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../utils/api';
import { getCurrencySymbol } from '../../utils/currency';

const PracticeSettings = () => {
  const { category } = useParams();
  const navigate = useNavigate();

  // State Management
  const [data, setData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cost: 0,
    category: ''
  });

  // Helper to convert 'patient-complaints' to 'Patient Complaints'
  const formatTitle = (slug) => {
    if (!slug) return 'Settings';
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const title = formatTitle(category);

  // Map URL slugs to backend categories
  const getBackendCategory = (slug) => {
    const mapping = {
      // New standardized slugs
      'chief-complaints': 'complaint',
      'clinical-advice': 'advice',
      // Old slugs (kept for compatibility)
      'patient-complaints': 'complaint',
      'advices': 'advice',
      // Other categories
      'clinical-findings': 'finding',
      'on-examination': 'finding',
      'final-diagnosis': 'diagnosis',
      'diagnosis': 'diagnosis',
      'medical-history': 'medical-condition',
      'dental-history': 'dental-history',
      'allergies': 'allergy',
      'ongoing-medication': 'current-medication',
      'additional-fees': 'additional-fee'
    };
    return mapping[slug] || slug;
  };

  const backendCategory = getBackendCategory(category);

  // Filtered data based on search query
  const filteredData = data.filter(item => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name || '',
        description: item.description || '',
        cost: item.cost || 0,
        category: item.category || backendCategory
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        cost: 0,
        category: backendCategory
      });
    }
    setShowModal(true);
  };

  // Load data from API
  const fetchData = async () => {
    if (!category) return;
    try {
      // Procedures are handled differently (different API endpoint)
      if (category === 'procedures') {
        const response = await api.get('/treatment-types/');
        setData(response);
        return;
      }

      // Others use the clinical settings API
      const response = await api.get(`/clinical/settings/?category=${backendCategory}`);
      setData(response);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
      toast.error('Failed to load settings data');
    }
  };

  useEffect(() => {
    if (!category) {
      navigate('/admin/practice-settings/procedures', { replace: true });
      return;
    }
    setSearchQuery('');
    fetchData();
  }, [category, navigate]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Name is required');

    try {
      if (category === 'procedures') {
        if (editingItem) {
          await api.put(`/treatment-types/${editingItem.id}/`, formData);
          toast.success('Procedure updated');
        } else {
          await api.post('/treatment-types/', formData);
          toast.success('Procedure added');
        }
      } else {
        // Clinical Settings API
        if (editingItem) {
          await api.put(`/clinical/settings/${editingItem.id}/`, {
            ...formData,
            category: backendCategory
          });
          toast.success('Updated successfully');
        } else {
          await api.post('/clinical/settings/', {
            ...formData,
            category: backendCategory
          });
          toast.success('Added to clinical defaults');
        }
      }
      fetchData();
      setShowModal(false);
    } catch (err) {
      toast.error('Failed to save changes');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        if (category === 'procedures') {
          await api.delete(`/treatment-types/${id}/`);
        } else {
          await api.delete(`/clinical/settings/${id}/`);
        }
        fetchData();
        toast.success('Deleted successfully');
      } catch (err) {
        toast.error('Failed to delete item');
      }
    }
  };


  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      
      {/* Header */}
      <div className="mb-6 flex justify-between items-end">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
          <span>Admin</span>
          <span>/</span>
          <span className="text-gray-900">{title}</span>
        </div>
        
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#29828a] hover:bg-[#216b71] text-white font-medium rounded-xl transition-colors shadow-sm"
        >
          <Plus size={18} /> Add New
        </button>
      </div>

      <div className="space-y-6">
        
        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder={`Search ${title}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 focus:border-[#29828a] focus:ring-1 focus:ring-[#29828a] rounded-lg text-sm outline-none transition-colors"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl border border-gray-200/60 shadow-sm overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200/60 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4 w-1/4">Name</th>
                  <th className="px-6 py-4 w-2/4">{category === 'procedures' ? `Price (${getCurrencySymbol()})` : 'Description'}</th>
                  <th className="px-6 py-4 w-1/6">Status</th>
                  <th className="px-6 py-4 w-1/6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.length > 0 ? (
                  filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">{item.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        {category === 'procedures' ? (
                          <span className="text-sm font-bold text-gray-900">
                            {getCurrencySymbol()}{Number(item.price || 0).toLocaleString('en-US')}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-600 truncate block max-w-sm" title={item.description}>
                            {item.description || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${item.is_active !== false ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {item.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openModal(item)}
                            className="p-1.5 text-gray-400 hover:text-[#29828a] hover:bg-[#29828a]/10 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Search className="w-10 h-10 mb-3 opacity-50" />
                        <p className="text-sm">No results found for "{searchQuery}"</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Modal Blueprint */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">
                {editingItem ? 'Edit Item' : `Add New ${title.split(' ').pop()}`}
              </h3>
            </div>
            
            <form onSubmit={handleSave} className="p-6">
              <div className="space-y-4">
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:border-[#29828a] focus:ring-1 focus:ring-[#29828a] outline-none text-sm transition-all shadow-sm"
                    placeholder="Enter name"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Description (Optional)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:border-[#29828a] focus:ring-1 focus:ring-[#29828a] outline-none text-sm transition-all shadow-sm min-h-[80px]"
                    placeholder="Enter details..."
                  />
                </div>

                {category === 'procedures' ? (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Price ({getCurrencySymbol()})</label>
                    <input
                      type="number"
                      value={formData.price || ''}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:border-[#29828a] focus:ring-1 focus:ring-[#29828a] outline-none text-sm transition-all shadow-sm"
                      placeholder="e.g. 4500"
                      min="0"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:border-[#29828a] focus:ring-1 focus:ring-[#29828a] outline-none text-sm transition-all shadow-sm"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                )}

              </div>

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-gray-600 font-semibold text-sm bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-[#29828a] hover:bg-[#216b71] text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
                >
                  {editingItem ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default PracticeSettings;
