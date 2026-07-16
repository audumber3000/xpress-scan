import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useHeader } from '../contexts/HeaderContext';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Users, Settings as SettingsIcon, FileText, Bell, CreditCard, PlusCircle, Activity, ChevronDown, Stethoscope, Shield, Calendar } from 'lucide-react';

/**
 * Control Center navigation, grouped by category.
 *
 * Single source of truth for the menu. A null title renders the group ungrouped
 * at the top.
 *
 * Two /admin child routes are deliberately NOT listed and are reachable only by
 * direct URL: `templates` (Message Templates) and `doctors` (Referring Doctors),
 * both retired from the menu as unused. Referring Doctors in particular was a
 * dead CRUD screen — nothing read the table, and patients record "referred by"
 * as free text. Their routes are left in place so existing links don't 404.
 */
const NAV_GROUPS = [
  {
    title: null,
    items: [
      { id: 'branches', icon: Building2, label: 'Branches', hasChildren: true, activePath: '/admin/clinic' },
      { id: 'staff', icon: Users, label: 'Staff', path: '/admin/staff' },
      { id: 'attendance', icon: Calendar, label: 'Attendance', path: '/admin/attendance' },
      { id: 'permissions', icon: Shield, label: 'Permissions', path: '/admin/permissions' },
    ],
  },
  {
    title: 'Clinical',
    items: [
      { id: 'practice_settings', icon: Activity, label: 'Practice Settings', hasChildren: true, activePath: '/admin/practice-settings' },
      { id: 'treatments', icon: Stethoscope, label: 'Treatments & Pricing', path: '/admin/treatments' },
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
    title: 'Plans & Billing',
    items: [
      { id: 'subscription', icon: CreditCard, label: 'Subscription', path: '/admin/subscription' },
    ],
  },
];

const PRACTICE_SETTING_TABS = [
  'Procedures', 'Chief Complaints', 'Medical History', 'Clinical Advice',
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
    if (location.pathname.includes('/admin/clinic')) return 'branches';
    if (location.pathname.includes('/admin/practice-settings')) return 'practice_settings';
    return '';
  };
  const [openSection, setOpenSection] = useState(getInitialOpenSection);
  // Mobile only: false = show the config menu, true = show the selected section.
  // Ignored on desktop (md+), where both panes always render side by side.
  const [mobileShowContent, setMobileShowContent] = useState(false);
  const userBranches = (user?.clinics?.length > 0 ? user.clinics : [user?.clinic]).filter(Boolean);

  const toggleSection = (id) => {
    setOpenSection(openSection === id ? '' : id);
  };

  // Navigate to a section and, on mobile, switch from the menu to the content view.
  const goTo = (path) => {
    navigate(path);
    setMobileShowContent(true);
  };

  // Helper for Sidebar items
  const SidebarItem = ({ id, icon: Icon, label, hasChildren, path, activePath }) => {
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
          </div>
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
        <div className="p-6 border-b border-gray-100/80 mt-1">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <SettingsIcon size={22} className="text-[#29828a]" />
            Control Center
          </h2>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold ml-8">Configuration</p>
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
                  />

                  {/* Branches expands to the clinics this user can switch between. */}
                  {item.id === 'branches' && openSection === 'branches' && (
                    <div className="ml-9 border-l-2 border-gray-100 pl-3 space-y-1.5 mb-3 mt-1">
                      {/* Each branch links to its own profile — previously every
                          one navigated to /admin/clinic, which always showed the
                          active clinic no matter which branch you clicked. */}
                      {userBranches.map((branch) => {
                        const isOpen = location.pathname.includes('/clinic')
                          && Number(new URLSearchParams(location.search).get('clinic') || user?.clinic?.id) === branch.id;
                        return (
                          <button key={branch.id} onClick={() => goTo(`/admin/clinic?clinic=${branch.id}`)} className={`w-full text-left px-3 py-2 text-[13px] rounded-lg transition-colors ${isOpen ? 'text-[#29828a] font-semibold bg-[#29828a]/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
                            {branch.name}
                          </button>
                        );
                      })}
                      <button onClick={() => goTo('/add-clinic')} className="w-full text-left px-3 py-2 text-[13px] rounded-lg text-[#29828a] font-medium flex items-center gap-2 hover:bg-gray-50">
                        <PlusCircle size={14} /> Add New Branch
                      </button>
                    </div>
                  )}

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
        <div className="flex-1 overflow-y-auto w-full h-full relative z-10 bg-[#f8fafc]">
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
