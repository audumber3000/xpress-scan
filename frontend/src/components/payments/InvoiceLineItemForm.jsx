import React, { useState, useEffect } from "react";
import { api } from "../../utils/api";

const InvoiceLineItemForm = ({ lineItem, onSave, onCancel }) => {
  const [itemType, setItemType] = useState('Treatment'); // 'Treatment', 'Product', 'Custom'
  
  const [treatments, setTreatments] = useState([]);
  const [inventory, setInventory] = useState([]);
  
  const [medications, setMedications] = useState([]);
  
  const [selectedItemId, setSelectedItemId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  useEffect(() => {
    // Fetch data for dropdowns
    const fetchOptions = async () => {
      try {
        const [treatmentData, inventoryData, medicationData] = await Promise.all([
          api.get('/treatment-types'),
          api.get('/inventory').catch(() => []),
          api.get('/medications/').catch(() => [])
        ]);
        setTreatments(Array.isArray(treatmentData) ? treatmentData : []);
        setInventory(Array.isArray(inventoryData) ? inventoryData : (inventoryData.items || []));
        setMedications(Array.isArray(medicationData) ? medicationData : []);
      } catch (err) {
        console.error("Error fetching line item options", err);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    if (lineItem) {
      setDescription(lineItem.description || "");
      setQuantity(lineItem.quantity || 1);
      setUnitPrice(lineItem.unit_price || 0);
      setItemType('Custom'); // Default to custom if we are editing an existing raw item
    }
  }, [lineItem]);

  const handleItemTypeChange = (e) => {
    setItemType(e.target.value);
    setSelectedItemId("");
    if (!lineItem) {
      setDescription("");
      setUnitPrice(0);
    }
  };

  const handleSelectionChange = (e) => {
    const selectedId = e.target.value;
    setSelectedItemId(selectedId);
    
    if (!selectedId) {
      setDescription("");
      setUnitPrice(0);
      return;
    }

    if (itemType === 'Treatment') {
      const treatment = treatments.find(t => t.id.toString() === selectedId);
      if (treatment) {
        setDescription(treatment.name);
        setUnitPrice(treatment.price || 0);
      }
    } else if (itemType === 'Product') {
      const product = inventory.find(p => p.id.toString() === selectedId);
      if (product) {
        setDescription(product.name);
        setUnitPrice(product.price_per_unit || 0);
      }
    } else if (itemType === 'Medication') {
      const med = medications.find(m => m.id.toString() === selectedId);
      if (med) {
        setDescription(`${med.name} ${med.dosage || ''}`.trim());
        setUnitPrice(med.unit_price || 0);
      }
    }
  };

  const amount = quantity * unitPrice;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim()) {
      return;
    }
    onSave({
      description: description.trim(),
      quantity: parseFloat(quantity),
      unit_price: parseFloat(unitPrice),
      amount: amount
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg space-y-4">
      
      {/* Type Selector */}
      {!lineItem && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-2">
          <label className="inline-flex items-center">
            <input type="radio" className="form-radio text-[#2a276e]" value="Treatment" checked={itemType === 'Treatment'} onChange={handleItemTypeChange} />
            <span className="ml-2 text-sm text-gray-700 font-medium">Treatment</span>
          </label>
          <label className="inline-flex items-center">
            <input type="radio" className="form-radio text-[#2a276e]" value="Medication" checked={itemType === 'Medication'} onChange={handleItemTypeChange} />
            <span className="ml-2 text-sm text-gray-700 font-medium">Medication</span>
          </label>
          <label className="inline-flex items-center">
            <input type="radio" className="form-radio text-[#2a276e]" value="Product" checked={itemType === 'Product'} onChange={handleItemTypeChange} />
            <span className="ml-2 text-sm text-gray-700 font-medium">Inventory Item</span>
          </label>
          <label className="inline-flex items-center">
            <input type="radio" className="form-radio text-[#2a276e]" value="Custom" checked={itemType === 'Custom'} onChange={handleItemTypeChange} />
            <span className="ml-2 text-sm text-gray-700 font-medium">Custom Entry</span>
          </label>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {itemType === 'Custom' ? "Description" : "Select Item"} <span className="text-red-500">*</span>
        </label>
        
        {itemType === 'Treatment' ? (
          <select
            value={selectedItemId}
            onChange={handleSelectionChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent mb-2"
          >
            <option value="">-- Select Treatment --</option>
            {treatments.map(t => (
              <option key={t.id} value={t.id}>{t.name} (₹{t.price})</option>
            ))}
          </select>
        ) : itemType === 'Medication' ? (
          <select
            value={selectedItemId}
            onChange={handleSelectionChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent mb-2"
          >
            <option value="">-- Select Medication --</option>
            {medications.map(m => (
              <option key={m.id} value={m.id}>{m.name} {m.dosage ? `(${m.dosage})` : ''} - ₹{m.unit_price || 0}</option>
            ))}
          </select>
        ) : itemType === 'Product' ? (
          <select
            value={selectedItemId}
            onChange={handleSelectionChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent mb-2"
          >
            <option value="">-- Select Inventory Product --</option>
            {inventory.map(p => (
              <option key={p.id} value={p.id}>{p.name} {p.price_per_unit ? `(₹${p.price_per_unit})` : ''}</option>
            ))}
          </select>
        ) : null}

        {/* Visible Description field is editable regardless of what they selected, allowing custom tweaks */}
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Item description"
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent ${itemType !== 'Custom' && description ? 'bg-gray-100' : ''}`}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
          />
        </div>

        <div>
           <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit Price (₹)
          </label>
          <input
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white p-3 rounded border border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Amount:</span>
          <span className="text-lg font-semibold text-gray-900">
            ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition font-medium"
        >
          {lineItem ? "Update" : "Add"} Item
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default InvoiceLineItemForm;
