import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { toast } from 'react-toastify';
import { getCurrencySymbol } from '../../utils/currency';
import GearLoader from '../GearLoader';

const ExpenseModal = ({ expenseId, onClose, onSave }) => {
  const [vendors, setVendors] = useState([]);
  const [formData, setFormData] = useState({
    amount: '',
    vendor_id: '',
    category: 'Inventory',
    payment_method: 'UPI',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [billFile, setBillFile] = useState(null);
  const [currentBillUrl, setCurrentBillUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isCreating = expenseId === 'new';

  useEffect(() => {
    fetchVendors();
    if (!isCreating) {
      fetchExpenseDetails();
    } else {
      setFormData({
        amount: '',
        vendor_id: '',
        category: 'Inventory',
        payment_method: 'UPI',
        notes: '',
        date: new Date().toISOString().split('T')[0]
      });
      setBillFile(null);
      setCurrentBillUrl('');
    }
  }, [expenseId]);

  const fetchVendors = async () => {
    try {
      const data = await api.get('/vendors');
      setVendors(Array.isArray(data) ? data : data.items || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    }
  };

  const fetchExpenseDetails = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/ledger/expenses/${expenseId}`);
      if (data) {
        setFormData({
          amount: data.amount,
          vendor_id: data.vendor_id || '',
          category: data.category || 'Other',
          payment_method: data.payment_method || 'UPI',
          notes: data.notes || '',
          date: data.date ? new Date(data.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        });
        setCurrentBillUrl(data.bill_file_url || '');
      }
    } catch (error) {
      console.error("Error fetching expense:", error);
      toast.error("Failed to load expense details");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setBillFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || isNaN(formData.amount)) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        amount: parseFloat(formData.amount),
        vendor_id: formData.vendor_id ? parseInt(formData.vendor_id) : 0, // 0 for deselection on backend
        category: formData.category,
        payment_method: formData.payment_method,
        notes: formData.notes,
        date: new Date(formData.date).toISOString()
      };

      let expenseResultId = expenseId;

      if (isCreating) {
        const newExpense = await api.post('/ledger/expenses', payload);
        expenseResultId = newExpense.id;
      } else {
        await api.put(`/ledger/expenses/${expenseId}`, payload);
      }
      
      // Upload file if new file exists
      if (billFile && expenseResultId) {
        try {
          const fileData = new FormData();
          fileData.append('file', billFile);
          await api.post(`/ledger/expenses/${expenseResultId}/bill`, fileData);
          toast.success(`Expense ${isCreating ? 'recorded' : 'updated'} and bill uploaded!`);
        } catch (uploadError) {
          console.error("Error uploading bill:", uploadError);
          toast.warning(`Expense ${isCreating ? 'recorded' : 'updated'}, but failed to upload bill (R2 missing)`);
        }
      } else {
        toast.success(`Expense ${isCreating ? 'recorded' : 'updated'} successfully!`);
      }

      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving expense:", error);
      toast.error("Failed to save expense details");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this expense? This affects your ledger balance.")) return;
    try {
      setDeleting(true);
      await api.delete(`/ledger/expenses/${expenseId}`);
      toast.success("Expense deleted successfully");
      onSave();
      onClose();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete expense");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{isCreating ? "Add New Expense" : "Expense Details"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <GearLoader size="w-8 h-8" />
          </div>
        ) : (
          <>
            {/* Form Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <form id="expense-form" onSubmit={handleSubmit} className="space-y-6">
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({getCurrencySymbol()})*</label>
                    <input
                      type="number"
                      name="amount"
                      required
                      value={formData.amount}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor (Optional)</label>
                  <select
                    name="vendor_id"
                    value={formData.vendor_id}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                  >
                    <option value="">-- No Vendor / Miscellaneous --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                    >
                      <option value="Inventory">Inventory / Supplies</option>
                      <option value="Salary">Salary</option>
                      <option value="Rent">Rent</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    <select
                      name="payment_method"
                      value={formData.payment_method}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                    >
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Description</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                    placeholder="Details about this expense..."
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attach Bill (Image/PDF)</label>
                  {currentBillUrl && !billFile && (
                    <div className="mb-3 px-4 py-3 bg-blue-50 text-blue-800 rounded-lg text-sm flex items-center justify-between">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        Current Bill Uploaded
                      </span>
                      <a href={currentBillUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">View</a>
                    </div>
                  )}
                  <div className="mt-1 flex justify-center px-6 pt-6 pb-6 border-2 border-gray-300 border-dashed rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="space-y-1 text-center">
                      <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="flex text-sm text-gray-600 justify-center mt-4">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-[#2a276e] hover:text-[#1e1c4f] focus-within:outline-none px-3 py-1 shadow-sm border border-gray-200">
                          <span>Select a file to upload</span>
                          <input type="file" className="sr-only" onChange={handleFileChange} accept="image/*,.pdf" />
                        </label>
                      </div>
                      {billFile && <p className="text-sm text-green-600 font-medium mt-3">{billFile.name}</p>}
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-between items-center mt-auto">
              <div>
                {!isCreating && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving || deleting}
                    className="px-4 py-2 border border-red-300 text-red-700 bg-white hover:bg-red-50 rounded-lg transition-colors text-sm font-medium flex items-center"
                  >
                    {deleting ? 'Deleting...' : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete
                      </>
                    )}
                  </button>
                )}
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  disabled={saving || deleting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="expense-form"
                  className="px-6 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1e1c4f] transition-colors flex items-center shadow-sm"
                  disabled={saving || deleting}
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : "Save"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ExpenseModal;
