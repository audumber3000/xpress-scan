import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Pill, Layers } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import TreatmentsPricing from '../TreatmentsPricing';
import MedicationGroupsTab from '../../components/vendors/MedicationGroupsTab';
import SectionTabs from '../../components/common/SectionTabs';
import SectionHeader from '../../components/common/SectionHeader';

/**
 * Control Center → Medications.
 *
 * The two screens that answer "what do we prescribe": the drug catalogue, and
 * the prescription sets built out of it. They were split across two places
 * before, with the catalogue riding as a tab on Treatment & Pricing and sets
 * sitting on their own, which meant adding a drug and then putting it in a set
 * was a trip through two unrelated menu items.
 *
 * Pricing keeps Treatment & Pricing to itself, which is the right split: one
 * screen is about what a patient is charged, these two are about what they are
 * given.
 */

const TABS = [
  { id: 'catalogue', label: 'Medications', icon: Pill },
  { id: 'sets', label: 'Prescription Sets', icon: Layers },
];

const Medications = () => {
  const { setTitle } = useHeader();
  const navigate = useNavigate();
  const location = useLocation();

  // /admin/prescription-sets still resolves here, so the links and bookmarks
  // that predate this page land on the tab they were pointing at.
  const [tab, setTab] = useState(
    location.pathname.includes('prescription-sets') ? 'sets' : 'catalogue'
  );

  useEffect(() => {
    setTitle(
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Control Center</span>
        </button>
      </div>
    );
  }, [setTitle, navigate]);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      <div className="mb-6">
        <SectionHeader
          title="Medications"
          subtitle="The drugs you prescribe, and the sets you apply in one tap on a case paper."
        />

        <SectionTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'catalogue'
        ? <TreatmentsPricing mode="medications" embedded />
        : <MedicationGroupsTab />}
    </div>
  );
};

export default Medications;
