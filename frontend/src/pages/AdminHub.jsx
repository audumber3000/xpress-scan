import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import SetupProgress from '../components/admin/SetupProgress';
import { api } from '../utils/api';
import { useHeader } from '../contexts/HeaderContext';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Users, FileText, Bell, CreditCard, SlidersHorizontal, ChevronDown, Stethoscope, Shield, History, Plug, Tag, Pill, AlertTriangle } from 'lucide-react';
import { planLabel } from '../utils/plans';

/**
 * Control Center navigation, grouped by category.
 *
 * Single source of truth for the menu. A null title renders the group ungrouped
 * at the top.
 *
 * Several /admin child routes are deliberately NOT listed and are reachable
 * only by direct URL:
 *   - `templates` (Message Templates) and `doctors` (Referring Doctors), both
 *     retired from the menu as unused. Referring Doctors in particular was a
 *     dead CRUD screen — nothing read the table, and patients record
 *     "referred by" as free text.
 *   - `prescription-sets`, now a tab of Medications.
 *   - `security/devices` and `security/audit-log`, now tabs of Access &
 *     Activity.
 *   - `permissions`, now edited on the staff member themselves in Staff.
 * Their routes are all left in place so existing links don't 404.
 */
const NAV_GROUPS = [
  {
    title: null,
    items: [
      { id: 'clinic_details', icon: Building2, label: 'Clinic Details', path: '/admin/clinic' },
      // Attendance and Permissions are tabs of the Staff screen, reached from
      // there. Repeating them here made one section read as three.
      { id: 'staff', icon: Users, label: 'Staff', path: '/admin/staff' },
    ],
  },
  {
    title: 'Clinical',
    items: [
      { id: 'practice_settings', icon: SlidersHorizontal, label: 'Practice Settings', hasChildren: true, activePath: '/admin/practice-settings' },
      { id: 'treatments', icon: Stethoscope, label: 'Treatments & Pricing', path: '/admin/treatments' },
      { id: 'offers', icon: Tag, label: 'Offers & Discounts', path: '/admin/offers' },
    ],
  },
  {
    // Its own section, not a tab of Treatments. Both screens here answer "what
    // do we prescribe"; Treatments & Pricing answers "what do we charge", which
    // is a different job done by different people.
    title: 'Medication',
    items: [
      { id: 'medications', icon: Pill, label: 'Medications', path: '/admin/medications' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { id: 'templates_editor', icon: FileText, label: 'Templates Editor', path: '/admin/templates-editor' },
      { id: 'notifications', icon: Bell, label: 'Notifications', path: '/admin/notifications' },
    ],
  },
  {
    title: 'Security',
    items: [
      { id: 'security_contact', icon: Shield, label: 'Verification', path: '/admin/security/verification' },
      // Devices and Audit Log were two menu items and are now two tabs of one:
      // "who can get in" and "what they did" are read together, and splitting
      // them meant leaving the screen halfway through looking something up.
      { id: 'security_activity', icon: History, label: 'Access & Activity', path: '/admin/security/activity' },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { id: 'integrations', icon: Plug, label: 'Integrations', path: '/admin/integrations' },
    ],
  },
  {
    title: 'Plans & Billing',
    items: [
      { id: 'subscription', icon: CreditCard, label: 'Subscription', path: '/admin/subscription' },
    ],
  },
];

const PRACTICE_SETTING_TABS = [
  // 'Procedures' lives in Treatment & Pricing now, so it's not duplicated here.
  'Chief Complaints', 'Medical History', 'Clinical Advice',
  'On Examination', 'Dental History', 'Diagnosis', 'Allergies',
  'Ongoing Medication', 'Additional Fees',
];

const AdminHub = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setTitle } = useHeader();
  const { user } = useAuth();
  
  React.useEffect(() => {
    setTitle && setTitle('Control Center');
  }, [setTitle]);

  const getInitialOpenSection = () => {
    if (location.pathname.includes('/admin/practice-settings')) return 'practice_settings';
    return '';
  };
  const [openSection, setOpenSection] = useState(getInitialOpenSection);
  // Mobile only: false = show the config menu, true = show the selected section.
  // Ignored on desktop (md+), where both panes always render side by side.
  const [mobileShowContent, setMobileShowContent] = useState(false);

  // Setup checklist behind the progress ring. Re-read whenever the section
  // changes, so ticking something off in one screen shows up when you leave it.
  const [setupStatus, setSetupStatus] = useState(null);
  const loadSetupStatus = React.useCallback(() => {
    api.get('/clinics/me/setup-status')
      .then(setSetupStatus)
      .catch(() => setSetupStatus(null));  // the menu works fine without it
  }, []);
  React.useEffect(() => { loadSetupStatus(); }, [loadSetupStatus, location.pathname]);

  const toggleSection = (id) => {
    setOpenSection(openSection === id ? '' : id);
  };

  // Menu items that are still waiting on something, keyed by nav id. The
  // checklist behind the progress ring already knows this, so nothing extra is
  // fetched: the ring says "6 of 8 done" and this says which two.
  const needsAttention = React.useMemo(() => {
    const byKey = Object.fromEntries((setupStatus?.items || []).map((i) => [i.key, i]));
    return {
      // Nobody goes looking for the recovery contact until they are locked out,
      // which is exactly too late. The menu is where it has to be said.
      security_contact: byKey.recovery ? !byKey.recovery.done : false,
    };
  }, [setupStatus]);

  // Navigate to a section and, on mobile, switch from the menu to the content view.
  const goTo = (path) => {
    navigate(path);
    setMobileShowContent(true);
  };

  // Helper for Sidebar items
  /**
   * The plan, and whether it needs attention, on the Subscription row itself.
   *
   * Otherwise the only way to find out what you are paying for is to open the
   * page, and the one state that matters most — a stopped plan — is invisible
   * from the menu you are standing in.
   */
  const planBadge = () => {
    const clinic = user?.clinic;
    if (!clinic) return null;
    const name = planLabel(clinic.subscription_plan);
    switch (clinic.plan_state) {
      case 'trial_ended':  return { text: 'Trial ended', tone: 'bad' };
      case 'lapsed':       return { text: 'Payment failed', tone: 'bad' };
      case 'grant_ended':  return { text: 'Renew', tone: 'bad' };
      case 'renewal_due':
      case 'grant_due':
        return { text: clinic.plan_state_days ? `${clinic.plan_state_days}d left` : 'Due', tone: 'warn' };
      default:
        break;
    }
    if (clinic.is_trial) {
      const d = clinic.trial_days_remaining;
      return { text: typeof d === 'number' ? `Trial ${d}d` : 'Trial', tone: 'trial' };
    }
    return { text: name, tone: 'calm' };
  };

  const BADGE_TONES = {
    bad: 'bg-red-100 text-red-700',
    warn: 'bg-amber-100 text-amber-700',
    trial: 'bg-[#29828a]/10 text-[#29828a]',
    calm: 'bg-gray-100 text-gray-500',
  };

  const SidebarItem = ({ id, icon: Icon, label, hasChildren, path, activePath, warn, badge }) => {
    const isExpanded = openSection === id;
    // Match on a path boundary, not a bare prefix — otherwise /admin/templates
    // would also light up while you're on /admin/templates-editor.
    const isActive = path
      ? location.pathname === path || location.pathname.startsWith(`${path}/`)
      : activePath
        ? location.pathname.includes(activePath)
        : false;

    return (
      <div className="mb-0.5">
        <button
          onClick={() => {
              if (path && !hasChildren) {
                goTo(path);
              }
              if (hasChildren) toggleSection(id);
          }}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-gradient-to-r from-[#29828a]/10 to-transparent border-l-4 border-[#29828a] text-[#29828a] font-semibold' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent hover:border-gray-200'}`}
        >
          <div className="flex items-center gap-3">
              <Icon size={20} className={isActive ? 'text-[#29828a]' : 'text-gray-500'} />
              <span className="font-medium tracking-wide text-[14px]">{label}</span>
              {/* Amber, not teal: teal is where you are, amber is what is
                  waiting. A count would be false precision here, so it is the
                  sign itself that carries the meaning. */}
              {warn && (
                <AlertTriangle
                  size={15}
                  className="text-amber-500 shrink-0"
                  aria-label="Not verified yet"
                />
              )}
          </div>
          {badge && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${BADGE_TONES[badge.tone]}`}>
              {badge.text}
            </span>
          )}
          {hasChildren && (
              <ChevronDown size={16} className={`transition-transform duration-300 text-gray-400 ${isExpanded ? 'rotate-180' : ''}`} />
          )}
        </button>
      </div>
    );
  };

  // h-full, not h-screen: this renders inside <main>, which already sits below
  // the 56px header. h-screen made the hub taller than its container, pushing
  // the menu's own scroller below the fold.
  return (
    <div className="flex h-full w-full bg-[#f8fafc] overflow-hidden">
      {/* Secondary Sidebar Navigation — full-width on mobile, fixed pane on desktop */}
      <div className={`${mobileShowContent ? 'hidden md:flex' : 'flex'} w-full md:w-72 bg-white border-r border-gray-200 flex-col h-full shrink-0 shadow-sm z-10`}>
        {/* Title flush left, setup ring on the right. The cog that used to sit
            beside the title said nothing the word "Configuration" didn't. */}
        <div className="p-6 border-b border-gray-100/80 mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Control Center</h2>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Configuration</p>
          </div>
          <SetupProgress status={setupStatus} onRefresh={loadSetupStatus} />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.title || 'main'} className="mb-4 last:mb-0">
              {group.title && (
                <p className="px-4 pt-2 pb-1.5 text-xs text-gray-900 uppercase tracking-wider font-bold">
                  {group.title}
                </p>
              )}

              {group.items.map((item) => (
                <React.Fragment key={item.id}>
                  <SidebarItem
                    id={item.id}
                    icon={item.icon}
                    label={item.label}
                    hasChildren={item.hasChildren}
                    path={item.path}
                    activePath={item.activePath}
                    warn={needsAttention[item.id]}
                    badge={item.id === 'subscription' ? planBadge() : null}
                  />

                  {/* Practice Settings expands to its per-category editors. */}
                  {item.id === 'practice_settings' && openSection === 'practice_settings' && (
                    <div className="ml-9 border-l-2 border-gray-100 pl-3 space-y-1.5 mb-3 mt-1 max-h-[35vh] overflow-y-auto custom-scrollbar">
                      {PRACTICE_SETTING_TABS.map((tab) => {
                        const slug = tab.toLowerCase().replace(/\s+/g, '-');
                        const isActive = location.pathname.includes(`/practice-settings/${slug}`);
                        return (
                          <button
                            key={tab}
                            onClick={() => goTo(`/admin/practice-settings/${slug}`)}
                            className={`w-full text-left px-3 py-2 text-[13px] rounded-lg transition-colors ${isActive ? 'text-[#29828a] font-semibold bg-[#29828a]/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
                          >
                            {tab}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area — full-screen on mobile (with a Back bar), flex pane on desktop */}
      <div className={`${mobileShowContent ? 'flex' : 'hidden md:flex'} flex-1 flex-col h-full overflow-hidden relative`}>
        {/* Mobile-only: back to the config menu */}
        <button
          onClick={() => setMobileShowContent(false)}
          className="md:hidden flex items-center gap-1.5 px-4 py-3 text-sm font-semibold text-[#29828a] bg-white border-b border-gray-200 shrink-0"
        >
          <ChevronDown size={18} className="rotate-90" />
          Control Center menu
        </button>
        {/* No z-index here on purpose. `relative z-10` used to sit on this div,
            which made it a stacking context capped at 10 — so a drawer inside a
            Control Center page resolved its z-50 *within* that box and still
            painted under the app header (z-30). Keeping `relative` (z-auto) is
            harmless: it anchors absolute children without trapping fixed ones. */}
        <div className="flex-1 overflow-y-auto w-full h-full relative bg-[#f8fafc]">
            {/* The routed dynamic sub-component renders here */}
            <div className="w-full min-h-full">
               <Outlet />
            </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHub;
