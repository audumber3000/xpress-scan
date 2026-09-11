import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ChevronDown, ChevronRight, HelpCircle, LayoutDashboard, Briefcase, Users, Package, Receipt, Settings } from "lucide-react";
import toast from "react-hot-toast";

const mainNavItems = [
  {
    name: "Dashboard",
    path: "/",
    icon: <LayoutDashboard size={20} strokeWidth={2} />,
  },
  {
    name: "Cases",
    path: "/cases",
    icon: <Briefcase size={20} strokeWidth={2} />,
  },
  {
    name: "Clients",
    path: "/clients",
    icon: <Users size={20} strokeWidth={2} />,
  },
  {
    name: "Catalog",
    path: "/catalog",
    icon: <Package size={20} strokeWidth={2} />,
  },
  {
    name: "Billing",
    path: "/billing",
    icon: <Receipt size={20} strokeWidth={2} />,
  },
];

const adminNavItems = [
  {
    name: "Settings",
    path: "/settings",
    icon: <Settings size={20} strokeWidth={2} />,
  },
];

const Sidebar = ({ isMobileOpen, onMobileClose, isCollapsed, onCollapseChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [expandedMenus, setExpandedMenus] = useState({});

  const toggleSubmenu = (menuName) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const desktopCollapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const collapsed = isMobile ? false : desktopCollapsed;
  const setCollapsed = onCollapseChange || setInternalCollapsed;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const linkClass = (path) => {
    // Special check for dashboard
    const isActive = path === '/' ? location.pathname === '/' || location.pathname === '/dashboard' : location.pathname.startsWith(path);
    const baseClasses = collapsed 
      ? "flex items-center justify-center py-3.5 px-2 rounded-xl transition-all font-semibold whitespace-nowrap relative"
      : "flex items-center gap-3.5 py-3 px-4 rounded-xl transition-all font-semibold whitespace-nowrap";
    const activeClasses = isActive 
      ? "bg-white text-gray-900 shadow-md"
      : "text-white/80 hover:bg-white/10 hover:text-white";
    return `${baseClasses} ${activeClasses}`;
  };

  const mobileClasses = isMobile 
    ? `fixed top-0 left-0 z-50 h-full transform transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`
    : '';

  const isAdminRoute = useMemo(() => {
    return location.pathname.startsWith('/settings');
  }, [location.pathname]);

  const visibleMainNav = mainNavItems;
  const visibleAdminNav = adminNavItems;

  const desktopClasses = !isMobile 
    ? `flex flex-col h-screen transition-all duration-300 ease-in-out ${collapsed ? 'w-20' : 'w-64'} ${collapsed ? 'p-3' : 'p-5'} relative ${
        isAdminRoute 
          ? 'bg-gradient-to-b from-[#0d2a2d] via-[#1F6B72] to-[#29828a]' 
          : 'bg-gradient-to-b from-[#0d0a2d] via-[#1a1548] to-[#2a276e]'
      }`
    : `flex flex-col h-full w-[82%] max-w-[320px] p-5 shadow-2xl ${
        isAdminRoute
          ? 'bg-gradient-to-b from-[#0d2a2d] via-[#1F6B72] to-[#29828a]'
          : 'bg-gradient-to-b from-[#0d0a2d] via-[#1a1548] to-[#2a276e]'
      }`;

  return (
    <>
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[45]"
          onClick={onMobileClose}
        />
      )}
      
      <aside className={`${mobileClasses} ${desktopClasses} ${collapsed && !isMobile ? 'shadow-2xl' : ''} ${collapsed && !isMobile ? 'overflow-visible' : ''} ${!isMobile ? 'relative' : ''}`}>
        <div 
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none opacity-30"
          style={{
            backgroundImage: isAdminRoute 
              ? 'radial-gradient(circle, rgba(45, 149, 150, 0.4) 1px, transparent 1px)'
              : 'radial-gradient(circle, rgba(155, 140, 255, 0.4) 1px, transparent 1px)',
            backgroundSize: '8px 8px',
            maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)'
          }}
        ></div>

        {isMobile && (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close menu"
            className="absolute top-3 right-3 z-20 p-2.5 rounded-lg bg-[#1A1640] hover:bg-[#2A2550] active:scale-95 transition-all"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <div className="relative mb-3">
          <div className={`flex items-center h-14 pb-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
            {collapsed ? (
              <div className="relative flex items-center">
                <div className="w-10 h-10 rounded-lg shadow-md bg-white flex items-center justify-center font-bold text-[#2a276e] text-xl">
                  M
                </div>
                {!isMobile && (
                  <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-7 bg-[#1A1640] hover:bg-[#2A2550] text-white rounded-md ring-1 ring-white/10 shadow-lg transition-colors cursor-pointer z-40"
                    title="Show navigation"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-col leading-tight pt-1">
                  <span className="text-xl font-bold text-white tracking-tight">MolarPlus</span>
                  <span className="text-xs text-indigo-300 uppercase tracking-wider font-semibold">Dental Labs</span>
                </div>
                {!isMobile && (
                  <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="bg-[#1A1640] hover:bg-[#2A2550] rounded-lg p-2 transition-colors flex-shrink-0"
                    title="Hide navigation"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
          <div className="border-b border-white/10" />
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <nav className="flex flex-col gap-1.5">
          {visibleMainNav.map((item) => {
            // Check active
            const isActive = item.path === '/' ? location.pathname === '/' || location.pathname === '/dashboard' : location.pathname.startsWith(item.path);
            
            return (
              <div key={item.name}>
                <Link
                  to={item.path}
                  onClick={() => isMobile && onMobileClose?.()}
                  className={`${linkClass(item.path)} ${collapsed ? 'group' : ''}`}
                  title={collapsed ? item.name : ''}
                >
                  <div className={`${collapsed ? 'w-7 h-7' : 'w-6 h-6'} flex items-center justify-center transition-all ${isActive ? 'text-gray-900' : 'text-white/80'}`}>
                    {item.icon}
                  </div>
                  {!collapsed && <span className="text-[15px] flex-1">{item.name}</span>}
                  {collapsed && (
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900/95 text-white text-sm font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl border border-gray-700">
                      {item.name}
                    </span>
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        {visibleAdminNav.length > 0 && !collapsed && (
          <div className="mt-6 mb-3">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider px-4">Admin</span>
          </div>
        )}

        <nav className="flex flex-col gap-1.5">
          {visibleAdminNav.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => isMobile && onMobileClose?.()}
                className={`${linkClass(item.path)} ${collapsed ? 'group' : ''}`}
                title={collapsed ? item.name : ''}
              >
                <div className={`${collapsed ? 'w-7 h-7' : 'w-6 h-6'} flex items-center justify-center transition-all ${isActive ? 'text-gray-900' : 'text-white/80'}`}>
                  {item.icon}
                </div>
                {!collapsed && <span className="text-[15px] flex-1">{item.name}</span>}
                {collapsed && (
                  <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900/95 text-white text-sm font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl border border-gray-700">
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        </div>

        <div className={`mt-3 pt-3 border-t border-white/10 ${collapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={() => {
              toast("Support portal coming soon", { icon: "🛠️" });
              onMobileClose?.();
            }}
            className={`${
              collapsed
                ? 'flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors group relative'
                : 'flex items-center gap-3 w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors text-sm font-semibold'
            }`}
            title={collapsed ? 'Need Help?' : ''}
          >
            <HelpCircle size={18} className="flex-shrink-0" />
            {!collapsed && 'Need Help?'}
            {collapsed && (
              <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900/95 text-white text-sm font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl border border-gray-700">
                Need Help?
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar; 
