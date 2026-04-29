import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useHeader } from '../contexts/HeaderContext';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Users, Settings as SettingsIcon, FileText, Bell, CreditCard, PlusCircle, Activity, ChevronDown, CheckCircle2, DollarSign, Stethoscope, Shield, Calendar } from 'lucide-react';

const AdminHub = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setTitle } = useHeader();
  const { user } = useAuth();
  
  React.useEffect(() => {
    setTitle && setTitle('Admin Hub');
  }, [setTitle]);

  const getInitialOpenSection = () => {
    if (location.pathname.includes('/admin/clinic')) return 'branches';
    if (location.pathname.includes('/admin/practice-settings')) return 'practice_settings';
    return '';
  };
  const [openSection, setOpenSection] = useState(getInitialOpenSection);
  const userBranches = (user?.clinics?.length > 0 ? user.clinics : [user?.clinic]).filter(Boolean);

  const toggleSection = (id) => {
    setOpenSection(openSection === id ? '' : id);
  };

  // Helper for Sidebar items
  const SidebarItem = ({ id, icon: Icon, label, hasChildren, path, activePath }) => {
    const isExpanded = openSection === id;
    const isActive = path
      ? location.pathname.startsWith(path)
      : activePath
        ? location.pathname.includes(activePath)
        : false;

    return (
      <div className="mb-0.5">
        <button
          onClick={() => {
              if (path && !hasChildren) {
                navigate(path);
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

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden">
      {/* Secondary Sidebar Navigation */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full shrink-0 shadow-sm z-10">
        <div className="p-6 border-b border-gray-100/80 mt-1">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <SettingsIcon size={22} className="text-[#29828a]" />
            Admin Hub
          </h2>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold ml-8">Configuration</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          
          <SidebarItem id="branches" icon={Building2} label="Branches" hasChildren activePath="/admin/clinic" />
          {openSection === 'branches' && (
            <div className="ml-9 border-l-2 border-gray-100 pl-3 space-y-1.5 mb-3 mt-1">
               {userBranches.map((branch) => (
                 <button key={branch.id} onClick={() => navigate('/admin/clinic')} className={`w-full text-left px-3 py-2 text-[13px] rounded-lg transition-colors ${location.pathname.includes('/clinic') && user?.clinic?.id === branch.id ? 'text-[#29828a] font-semibold bg-[#29828a]/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
                   {branch.name}
                 </button>
               ))}
               <button onClick={() => navigate('/add-clinic')} className="w-full text-left px-3 py-2 text-[13px] rounded-lg text-[#29828a] font-medium flex items-center gap-2 hover:bg-gray-50">
                 <PlusCircle size={14} /> Add New Branch
               </button>
            </div>
          )}

          <SidebarItem id="team" icon={Users} label="Staff" path="/admin/staff" />

          <SidebarItem id="practice_settings" icon={Activity} label="Practice Settings" hasChildren activePath="/admin/practice-settings" />
          {openSection === 'practice_settings' && (
            <div className="ml-9 border-l-2 border-gray-100 pl-3 space-y-1.5 mb-3 mt-1 max-h-[35vh] overflow-y-auto custom-scrollbar">
               {['Procedures', 'Chief Complaints', 'Medical History', 'Clinical Advice', 'On Examination', 'Dental History', 'Diagnosis', 'Allergies', 'Ongoing Medication', 'Additional Fees'].map((tab) => {
                  const slug = tab.toLowerCase().replace(/\s+/g, '-');
                  const isActive = location.pathname.includes(`/practice-settings/${slug}`);
                  return (
                    <button 
                      key={tab} 
                      onClick={() => navigate(`/admin/practice-settings/${slug}`)}
                      className={`w-full text-left px-3 py-2 text-[13px] rounded-lg transition-colors ${isActive ? 'text-[#29828a] font-semibold bg-[#29828a]/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
                    >
                      {tab}
                    </button>
                  );
               })}
            </div>
          )}

          <SidebarItem id="templates" icon={FileText} label="Templates" path="/admin/templates-editor" />
          <SidebarItem id="notifications" icon={Bell} label="Notifications" path="/admin/notifications" />
          <SidebarItem id="subscription" icon={CreditCard} label="Subscription" path="/admin/subscription" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
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
