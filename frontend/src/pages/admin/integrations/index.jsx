import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ScanLine, MessageCircle, CreditCard } from 'lucide-react';

import XrayPanel from './XrayPanel';
import WhatsAppPanel from './WhatsAppPanel';
import PaymentsPanel from './PaymentsPanel';
import SectionTabs from '../../../components/common/SectionTabs';
import SectionHeader from '../../../components/common/SectionHeader';

/**
 * Integrations — one Control Center section, one tab per integration.
 *
 * The tab lives in the URL (/admin/integrations/:tab) so a tab is linkable and
 * survives a refresh, and so the older /admin/integrations/whatsapp links kept
 * working when this went from two nav items to one.
 */

const TABS = [
  { id: 'xray',     label: 'X-ray & Imaging', icon: ScanLine },
  { id: 'whatsapp', label: 'WhatsApp',        icon: MessageCircle },
  { id: 'payments', label: 'Payments',        icon: CreditCard },
];

const DEFAULT_TAB = 'xray';

const Integrations = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const active = TABS.some((t) => t.id === tab) ? tab : DEFAULT_TAB;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      <div className="mb-6">
        <SectionHeader
          title="Integrations"
          subtitle="Connect the hardware and channels your clinic already uses"
        />

        <SectionTabs tabs={TABS} active={active} onChange={(id) => navigate(`/admin/integrations/${id}`)} />
      </div>

      {active === 'xray' && <XrayPanel />}
      {active === 'whatsapp' && <WhatsAppPanel />}
      {active === 'payments' && <PaymentsPanel />}
    </div>
  );
};

export default Integrations;
