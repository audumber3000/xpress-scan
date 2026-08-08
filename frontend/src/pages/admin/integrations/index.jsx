import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ScanLine, MessageCircle } from 'lucide-react';

import XrayPanel from './XrayPanel';
import WhatsAppPanel from './WhatsAppPanel';

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
];

const DEFAULT_TAB = 'xray';

const Integrations = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const active = TABS.some((t) => t.id === tab) ? tab : DEFAULT_TAB;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      <div className="mb-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900">Integrations</h2>
          <p className="text-sm text-gray-500 mt-0.5">Connect the hardware and channels your clinic already uses</p>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex gap-1 -mb-px">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => navigate(`/admin/integrations/${id}`)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors rounded-t-lg ${
                  active === id
                    ? 'border-[#29828a] text-[#29828a] bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {active === 'xray' && <XrayPanel />}
      {active === 'whatsapp' && <WhatsAppPanel />}
    </div>
  );
};

export default Integrations;
