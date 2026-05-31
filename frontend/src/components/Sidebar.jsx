import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";

const mainNavItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    permissionKey: "dashboard",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
      </svg>
    ),
  },
  {
    name: "Appointment",
    path: "/calendar",
    permissionKey: "appointments",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: "Patients",
    path: "/patients",
    permissionKey: "patients",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    name: "Payments",
    path: "/payments",
    permissionKey: "finance",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },

  {
    name: "Inv & Vendors",
    path: "/vendors",
    permissionKeys: ["vendors", "inventory"],
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    name: "Consent Forms",
    path: "/consent-forms",
    permissionKey: "consent",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: "Lab",
    path: "/lab",
    permissionKey: "lab",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    name: "Reports",
    path: "/reports",
    permissionKey: "reports",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: "Marketing",
    path: "/marketing",
    hasSubmenu: true,
    permissionKey: "marketing",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
    submenu: [
      {
        name: "Google Reviews",
        path: "/marketing/reviews",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        )
      },
    ]
  },
];

const adminNavItems = [
  {
    name: "Admin",
    path: "/admin",
    permissionKey: "staff",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

const Sidebar = ({ isMobileOpen, onMobileClose, isCollapsed, onCollapseChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [clinicData, setClinicData] = useState(null);
  const [expandedMenus, setExpandedMenus] = useState({});

  const toggleSubmenu = (menuName) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  // Use external state if provided, otherwise use internal state
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const setCollapsed = onCollapseChange || setInternalCollapsed;

  // Check if we're on mobile — initialise immediately to avoid layout flash
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch clinic data
  useEffect(() => {
    const fetchClinicData = async () => {
      try {
        const response = await api.get("/auth/me");
        setClinicData(response.clinic);
      } catch (error) {
        console.error("Error fetching clinic data:", error);
      }
    };
    
    if (user) {
      fetchClinicData();
    }
  }, [user]);

  const linkClass = (path) => {
    const isActive = location.pathname === path;
    const baseClasses = collapsed 
      ? "flex items-center justify-center py-3.5 px-2 rounded-xl transition-all font-semibold whitespace-nowrap relative"
      : "flex items-center gap-3.5 py-3 px-4 rounded-xl transition-all font-semibold whitespace-nowrap";
    // White background for active tab, transparent for inactive
    const activeClasses = isActive 
      ? "bg-white text-gray-900 shadow-lg"
      : "text-white/80 hover:bg-white/10 hover:text-white";
    return `${baseClasses} ${activeClasses}`;
  };

  // Format clinic name for display
  const formatClinicName = (clinicName) => {
    if (!clinicName) return { first: "Clinic", rest: "Name" };
    
    const words = clinicName.trim().split(/\s+/);
    if (words.length === 1) {
      return { first: words[0], rest: "" };
    }
    
    const firstWord = words[0];
    const restWords = words.slice(1).join(" ");
    
    // Truncate if too long (more than 20 characters for the rest part)
    const truncatedRest = restWords.length > 20 ? restWords.substring(0, 17) + "..." : restWords;
    
    return { first: firstWord, rest: truncatedRest };
  };


  // Mobile sidebar classes
  const mobileClasses = isMobile 
    ? `fixed top-0 left-0 z-50 h-full transform transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`
    : '';

  // Check if current route is in admin section
  const isAdminRoute = useMemo(() => {
    return location.pathname.startsWith('/admin');
  }, [location.pathname]);

  // RBAC: deny-by-default. clinic_owner always passes.
  // All other roles must have read === true for that module key.
  const canAccess = (item) => {
    if (!item.permissionKey && !item.permissionKeys) return true;
    if (!user) return false;
    if (user.role === 'clinic_owner') return true;

    if (Array.isArray(item.permissionKeys) && item.permissionKeys.length > 0) {
      return item.permissionKeys.some((key) => user.permissions?.[key]?.read === true);
    }

    return user.permissions?.[item.permissionKey]?.read === true;
  };

  const visibleMainNav = mainNavItems.filter(canAccess);
  const visibleAdminNav = adminNavItems.filter(canAccess);

  // Desktop sidebar classes - Gradient background (teal for admin, purple for main)
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
      {/* Mobile overlay — tap to close */}
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[45]"
          onClick={onMobileClose}
        />
      )}
      
      <aside className={`${mobileClasses} ${desktopClasses} ${collapsed && !isMobile ? 'shadow-2xl' : ''} ${collapsed && !isMobile ? 'overflow-visible' : ''} ${!isMobile ? 'relative' : ''}`}>
        {/* Dotted pattern effect at bottom - color changes based on admin/main */}
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

        {/* Curved right edge effect removed to prevent bleeding into adjacent layouts */}


        {/* Mobile close button */}
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

        {/* Branding — MolarPlus logo + collapse toggle */}
        <div className="relative mb-3">
          <div className={`flex items-center h-14 pb-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
            {collapsed ? (
              /* Centered group: logo with a small chevron-tab anchored to the logo's right edge */
              <div className="relative flex items-center">
                <img
                  src="/molarplus-icon.png"
                  alt="MolarPlus"
                  className="w-10 h-10 rounded-lg shadow-md"
                />
                {!isMobile && (
                  <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-7 bg-[#1A1640] hover:bg-[#2A2550] text-white rounded-md ring-1 ring-white/10 shadow-lg transition-colors cursor-pointer z-40"
                    title="Show navigation"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                )}
              </div>
            ) : (
              <>
                <img
                  src="/molarplus-logo.svg"
                  alt="MolarPlus"
                  className="h-12 w-auto max-w-none"
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
                {!isMobile && (
                  <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="bg-[#1A1640] hover:bg-[#2A2550] rounded-lg p-2 transition-colors flex-shrink-0"
                    title="Hide navigation"
                  >
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
          {/* Thin separator below the header — same line for both expanded and collapsed */}
          <div className="border-b border-white/10" />
        </div>

        {/* Scrollable nav area — both main and admin sections */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

        {/* Main Nav */}
        <nav className="flex flex-col gap-1.5">
          {visibleMainNav.length === 0 && !collapsed && (
            <div className="mx-3 px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-white/40 text-xs font-medium">No access configured</p>
              <p className="text-white/25 text-[10px] mt-0.5">Contact your admin</p>
            </div>
          )}
          {visibleMainNav.map((item) => {
            const isActive = location.pathname === item.path;
            const isInboxParent = item.name === "Inbox";
            const isSubmenuActive = item.submenu?.some(sub => location.pathname === sub.path);
            
            return (
              <div key={item.name}>
                {/* Main nav item */}
                {item.hasSubmenu ? (
                  <button
                    onClick={() => toggleSubmenu(item.name)}
                    className={`w-full ${linkClass(item.path)} ${collapsed ? 'group' : ''} ${isSubmenuActive ? 'bg-white text-gray-900 shadow-lg' : ''}`}
                    title={collapsed ? item.name : ''}
                  >
                    <div className={`${collapsed ? 'w-6 h-6' : 'w-6 h-6'} flex items-center justify-center transition-all ${isSubmenuActive ? 'text-gray-900' : 'text-white/80'}`}>
                      {item.icon}
                    </div>
                    {!collapsed && (
                      <>
                        <span className="text-base flex-1 text-left">{item.name}</span>
                        {expandedMenus[item.name] ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </>
                    )}
                    {/* Tooltip for collapsed state */}
                    {collapsed && (
                      <span className="absolute left-full ml-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
                        {item.name}
                      </span>
                    )}
                  </button>
                ) : (
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
                    {/* Tooltip for collapsed state */}
                    {collapsed && (
                      <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900/95 text-white text-sm font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl border border-gray-700">
                        {item.name}
                      </span>
                    )}
                  </Link>
                )}
                
                {/* Submenu items — same styling as main nav, just indented */}
                {item.hasSubmenu && expandedMenus[item.name] && !collapsed && (
                  <div className="ml-4 mt-1 flex flex-col gap-1.5">
                    {item.submenu.map((subItem) => {
                      const isSubActive = location.pathname === subItem.path;
                      return (
                        <Link
                          key={subItem.name}
                          to={subItem.path}
                          onClick={() => isMobile && onMobileClose?.()}
                          className={linkClass(subItem.path)}
                        >
                          <div className={`w-6 h-6 flex items-center justify-center transition-all ${isSubActive ? 'text-gray-900' : 'text-white/80'}`}>
                            {subItem.icon}
                          </div>
                          <span className="text-[15px] flex-1">{subItem.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Admin Section */}
        {visibleAdminNav.length > 0 && !collapsed && (
          <div className="mt-6 mb-3">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider px-4">Admin</span>
          </div>
        )}

        {/* Admin Nav */}
        <nav className="flex flex-col gap-1.5">
          {visibleAdminNav.map((item) => {
            const isActive = location.pathname === item.path;
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
                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900/95 text-white text-sm font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl border border-gray-700">
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        </div>{/* end scrollable nav area */}

        {/* Need Help button */}
        <div className={`mt-3 pt-3 border-t border-white/10 ${collapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={() => {
              navigate('/support-tickets');
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
