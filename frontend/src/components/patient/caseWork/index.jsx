import React, { useState, useMemo } from 'react';
import { Beaker, Pill, Images, Package, Plus } from 'lucide-react';
import LabOrdersTab from './LabOrdersTab';
import PrescriptionsTab from './PrescriptionsTab';
import DocumentsTab from './DocumentsTab';
import ClinicalNotesCard from './ClinicalNotesCard';
import InventoryUsedSection from '../InventoryUsedSection';

/**
 * Everything else the visit produced, in one card.
 *
 * These four were four separate full-width sections stacked down the page —
 * lab orders, prescriptions, documents, stock used — each with its own heading
 * and its own empty state. Three of them are empty on a typical visit, so the
 * page was mostly headings announcing that nothing had happened, and the
 * clinical note ended up so far below the chart that it was written blind.
 *
 * One card with tabs instead. The count on each tab is the thing the old
 * headings could not tell you without scrolling to them: whether there is
 * anything in there at all.
 */

const ACTION_BTN =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#2a276e] text-white text-[13px] font-semibold ' +
  'whitespace-nowrap cursor-pointer transition-[background-color,transform] duration-150 ease-out ' +
  'hover:bg-[#1a1548] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a276e]';

const CaseWorkPanel = ({
  // Lab orders
  labOrders = [],
  onNewLabOrder,
  onEditLabOrder,
  // Prescriptions
  visitPrescriptions = [],
  selectedCasePaper,
  isNewCasePaper,
  onNewPrescription,
  // Documents
  patientDocuments = [],
  onUploadClick,
  // Inventory
  consumptions = [],
  inventoryItems = [],
  medicationItems = [],
  onAddConsumption,
  onDeleteConsumption,
  onBillConsumption,
  // Notes
  notes,
  onNotesChange,
}) => {
  const [active, setActive] = useState('lab');

  /* Only this visit's prescriptions. A brand-new paper has no id yet, so its
     medicines are the ones not yet attached to any paper. */
  const prescriptions = useMemo(() => (
    isNewCasePaper
      ? visitPrescriptions.filter((rx) => !rx.case_paper_id)
      : visitPrescriptions.filter((rx) =>
          String(rx.case_paper_id) === String(selectedCasePaper?.id))
  ), [visitPrescriptions, selectedCasePaper, isNewCasePaper]);

  /* Medicines, not prescriptions. Two medicines written on one prescription is
     "2" here, because two is what the doctor handed over. */
  const medicineCount = useMemo(() => prescriptions.reduce(
    (n, rx) => n + (rx.items || []).filter((i) => (i?.medicine_name || '').trim()).length, 0
  ), [prescriptions]);

  const TABS = [
    { id: 'lab', label: 'Lab Orders', Icon: Beaker, count: labOrders.length,
      action: { label: 'New order', onClick: onNewLabOrder } },
    { id: 'rx', label: 'Prescriptions', Icon: Pill, count: medicineCount,
      action: { label: 'New prescription', onClick: onNewPrescription } },
    { id: 'docs', label: 'Documents', Icon: Images, count: patientDocuments.length,
      action: { label: 'Upload', onClick: onUploadClick } },
    // No header action: this tab adds through its own item-and-quantity row,
    // which needs both fields before it can do anything.
    { id: 'stock', label: 'Inventory Used', Icon: Package, count: consumptions.length, action: null },
  ];

  const current = TABS.find((t) => t.id === active) || TABS[0];

  return (
    <section className="pt-8 border-t border-gray-100 grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl flex flex-col min-h-[320px]">
        <div className="flex items-center justify-between gap-3 px-3 pt-2 border-b border-gray-200">
          <div role="tablist" aria-label="Visit record" className="flex gap-1 -mb-px overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {TABS.map(({ id, label, Icon, count }) => {
              const on = active === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(id)}
                  className={`flex items-center gap-2 shrink-0 whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold border-b-2 cursor-pointer transition-[color,border-color] duration-150 ease-out ${
                    on
                      ? 'border-[#2a276e] text-[#2a276e]'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                  {/* The count is the point of the tab strip: four collapsed
                      sections would otherwise hide whether any of them holds
                      anything. Zero shows as nothing rather than as "0", which
                      would read as a value someone entered. */}
                  {count > 0 && (
                    <span className={`min-w-[19px] h-[19px] px-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-bold ${
                      on ? 'bg-[#2a276e] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {current.action && (
            <button type="button" onClick={current.action.onClick} className={`${ACTION_BTN} mb-2`}>
              <Plus size={14} strokeWidth={2.5} />
              {current.action.label}
            </button>
          )}
        </div>

        <div key={active} className="flex-1 p-3 animate-view-fade-in">
          {active === 'lab' && <LabOrdersTab labOrders={labOrders} onEditLabOrder={onEditLabOrder} />}
          {active === 'rx' && <PrescriptionsTab prescriptions={prescriptions} />}
          {active === 'docs' && <DocumentsTab documents={patientDocuments} onUploadClick={onUploadClick} />}
          {active === 'stock' && (
            <InventoryUsedSection
              showHeader={false}
              consumptions={consumptions}
              inventoryItems={inventoryItems}
              medicationItems={medicationItems}
              onAdd={onAddConsumption}
              onDelete={onDeleteConsumption}
              onBill={onBillConsumption}
            />
          )}
        </div>
      </div>

      <ClinicalNotesCard value={notes} onChange={onNotesChange} casePaper={selectedCasePaper} />
    </section>
  );
};

export default CaseWorkPanel;
