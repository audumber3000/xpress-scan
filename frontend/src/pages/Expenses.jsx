import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, Activity, Building2, Plus } from 'lucide-react';
import { api } from '../utils/api';
import PayablesTable from '../components/vendors/PayablesTable';
import MoneyLedger from '../components/expenses/MoneyLedger';
import VendorTable from '../components/vendors/VendorTable';
import VendorFormDrawer from '../components/vendors/VendorFormDrawer';
import HelpBulb from '../components/common/HelpBulb';

/**
 * Money going out, opposite Payments.
 *
 * Payables and the money ledger used to sit in two different sections:
 * payables under Inventory, where the question is what is on the shelf, and
 * the ledger inside Payments, next to the invoices that are money coming in.
 * A lab bill is not stock, and outflow beside collections is how the two get
 * read as one number.
 *
 * Inventory keeps its own Activity tab. That one is stock movement, not money,
 * and it belongs where the stock is.
 *
 * Tab order follows the work: what is owed, what has been paid, who it goes to.
 */

const TABS = [
  { id: 'payables', label: 'Payables', icon: Wallet, hint: 'Lab bills and consultant fees not yet settled' },
  { id: 'ledger', label: 'Ledger', icon: Activity, hint: 'Everything in and out, most recent first' },
  { id: 'vendors', label: 'Vendors', icon: Building2, hint: 'Labs, suppliers and consultants you pay' },
];

const Expenses = () => {
  const [activeTab, setActiveTab] = useState('payables');
  const [refreshKey, setRefreshKey] = useState(0);
  const [vendors, setVendors] = useState([]);
  const [vendorDrawer, setVendorDrawer] = useState({ open: false, vendor: null });

  const loadVendors = useCallback(async () => {
    try { setVendors(await api.get('/vendors') || []); } catch { setVendors([]); }
  }, []);

  useEffect(() => { if (activeTab === 'vendors') loadVendors(); }, [activeTab, loadVendors]);

  const active = TABS.find((t) => t.id === activeTab);

  return (
    <div className="p-4 md:p-6 h-full flex flex-col min-h-0">
      <div className="flex items-center gap-1 border-b border-gray-200 mb-3 overflow-x-auto no-scrollbar">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === id
                ? 'border-[#2a276e] text-[#2a276e]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon size={16} strokeWidth={activeTab === id ? 2.5 : 2} />
            {label}
          </button>
        ))}
        <HelpBulb section="inventory" className="ml-auto" />
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        {active?.hint && <p className="text-xs text-gray-500">{active.hint}</p>}
        {activeTab === 'vendors' && (
          <button
            onClick={() => setVendorDrawer({ open: true, vendor: null })}
            className="ml-auto inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-[#2a276e] hover:bg-[#1a1548] text-white text-sm font-bold"
          >
            <Plus size={15} /> Add vendor
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'payables' && (
          // Settling writes an Expense, so the ledger beside it picks the
          // payment up with no extra wiring.
          <PayablesTable onSettled={() => setRefreshKey((k) => k + 1)} />
        )}
        {activeTab === 'ledger' && <MoneyLedger refreshKey={refreshKey} />}
        {activeTab === 'vendors' && (
          <VendorTable
            vendors={vendors}
            onEditVendor={(v) => setVendorDrawer({ open: true, vendor: v })}
          />
        )}
      </div>

      {vendorDrawer.open && (
        <VendorFormDrawer
          vendor={vendorDrawer.vendor}
          onClose={() => setVendorDrawer({ open: false, vendor: null })}
          onSaved={() => { setVendorDrawer({ open: false, vendor: null }); loadVendors(); }}
        />
      )}
    </div>
  );
};

export default Expenses;
