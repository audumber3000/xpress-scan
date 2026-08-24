import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Laptop, ScrollText, RefreshCw } from 'lucide-react';
import Devices from './Devices';
import AuditLog from './AuditLog';
import SectionTabs from '../../../components/common/SectionTabs';
import SectionHeader from '../../../components/common/SectionHeader';

/**
 * Control Center → Security → Access & Activity.
 *
 * Two halves of the same question. Devices answers "who can get in, and from
 * what machine"; the Audit Log answers "what did they do once they were in".
 * Checking one almost always means checking the other, and as separate menu
 * items that meant leaving the screen mid-investigation.
 *
 * Laid out like Notifications: page heading with a Refresh on the right, tab
 * strip underneath, tab content below. Each tab still owns its own data, so
 * Refresh reaches it through `reloadKey` rather than this page holding state it
 * has no other use for.
 */

const TABS = [
  { id: 'devices', label: 'Devices',   icon: Laptop     },
  { id: 'audit',   label: 'Audit Log', icon: ScrollText },
];

const Activity = () => {
  const location = useLocation();

  // The old /admin/security/audit-log and /security/devices URLs still resolve
  // here, so a bookmark opens on the tab it used to be its own page.
  const [activeTab, setActiveTab] = useState(
    location.pathname.includes('audit-log') ? 'audit' : 'devices'
  );
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      <div className="mb-6">
        <SectionHeader
          title="Access & Activity"
          subtitle="The devices your team signs in from, and a record of what was done from them."
          action={
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          }
        />

        <SectionTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'devices'
        ? <Devices embedded reloadKey={reloadKey} />
        : <AuditLog embedded reloadKey={reloadKey} />}
    </div>
  );
};

export default Activity;
