import React, { useState } from 'react';
import SectionError from '../../../components/common/SectionError';
import { useAddonCatalogue } from '../../../utils/addons';
import AddOnCard from './AddOnCard';

/**
 * Add-on Features: extras a clinic buys on top of its plan.
 *
 * Billed per clinic location, because each branch has its own WhatsApp number
 * and its own Google profile, so the heading names the clinic the cards are
 * for. The monthly/annual toggle is the same control the plan cards use, and
 * it re-prices every card at once.
 */
const AddOnsTab = ({ clinicName, isOwner, onBuy }) => {
  const { catalogue, failed, loading, reload } = useAddonCatalogue();
  const [cycle, setCycle] = useState('monthly');
  const pctOff = catalogue.addons.find((a) => a.annual_pct_off)?.annual_pct_off || 20;

  return (
    <div className="max-w-5xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900">Add-ons{clinicName ? ` for ${clinicName}` : ''}</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Extra features on top of your plan, billed for this clinic location.
            {!isOwner && ' Only the clinic owner can add them.'}
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          {[
            { id: 'monthly', label: 'Monthly' },
            { id: 'annual', label: 'Annual' },
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => setCycle(b.id)}
              className={`flex min-h-[2.25rem] items-center gap-1.5 rounded-md px-4 py-2 text-xs font-bold transition-colors ${
                cycle === b.id ? 'border border-gray-200 bg-white text-[#29828a]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {b.label}
              {b.id === 'annual' && (
                <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-bold text-green-700">SAVE {pctOff}%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {failed && (
        <SectionError
          className="mb-4"
          title="Couldn't load your add-ons"
          detail="The cards below show prices only, not what this clinic already has."
          onRetry={reload}
          retrying={loading}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {catalogue.addons.map((item) => (
          <AddOnCard
            key={item.key}
            item={item}
            cycle={cycle}
            taxLabel={catalogue.tax_label}
            clinicName={clinicName}
            isOwner={isOwner}
            managerEmail={catalogue.gbp_manager_email}
            onBuy={onBuy}
          />
        ))}
      </div>
    </div>
  );
};

export default AddOnsTab;
