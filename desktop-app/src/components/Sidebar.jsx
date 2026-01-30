import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";
import { ChevronDown, ChevronRight } from "lucide-react";

const mainNavItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
      </svg>
    ),
  },
  {
    name: "Appointment",
    path: "/calendar",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: "Patients",
    path: "/patients",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    name: "Patient Files",
    path: "/patient-files",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    name: "X-ray",
    path: "/xray",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: "Payments",
    path: "/payments",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    name: "Inbox",
    path: "/inbox",
    hasSubmenu: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    submenu: [
      { name: "WhatsApp", path: "/inbox", icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg> },
      { name: "Mail", path: "/mail", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> }
    ]
  },
  {
    name: "Settings",
    path: "/user-management",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const adminNavItems = [
  {
    name: "Admin",
    path: "/admin",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

const Sidebar = ({ isMobileOpen, onMobileClose, isCollapsed, onCollapseChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [clinicData, setClinicData] = useState(null);
  const [inboxExpanded, setInboxExpanded] = useState(false);

  // Use external state if provided, otherwise use internal state
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const setCollapsed = onCollapseChange || setInternalCollapsed;

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
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
      ? "flex items-center justify-center py-3 px-3 rounded-xl transition-all font-medium whitespace-nowrap relative"
      : "flex items-center gap-3 py-2 px-4 rounded-lg transition font-medium whitespace-nowrap";
    // Light, faded background for active tab - no button feel, just subtle highlight
    const activeClasses = isActive 
      ? collapsed
        ? "bg-white/8 text-white"
        : "bg-white/8 text-white"
      : collapsed
        ? "text-[#9B8CFF] hover:bg-white/5 hover:text-white"
        : "text-white/70 hover:bg-white/5 hover:text-white";
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

  // Desktop sidebar classes - Deep Indigo Blue background (#0E0B2D)
  // When collapsed, add curved right edge and better spacing
  const desktopClasses = !isMobile 
    ? `flex flex-col h-screen bg-[#0E0B2D] transition-all duration-300 ease-in-out ${collapsed ? 'w-20' : 'w-64'} ${collapsed ? 'p-3' : 'p-4'} ${collapsed ? 'rounded-r-2xl' : ''} relative`
    : 'flex flex-col h-full w-64 bg-[#0E0B2D] p-4';

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onMobileClose}
        />
      )}
      
      <aside className={`${mobileClasses} ${desktopClasses} ${collapsed && !isMobile ? 'shadow-2xl' : ''} ${collapsed && !isMobile ? 'overflow-visible' : ''}`}>
        {/* Curved right edge effect when collapsed */}
        {collapsed && !isMobile && (
          <div 
            className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at right center, transparent 0%, transparent 40%, #0E0B2D 60%)'
            }}
          ></div>
        )}


        {/* Mobile close button */}
        {isMobile && (
          <button
            onClick={onMobileClose}
            className="absolute top-4 right-4 p-2 rounded-lg bg-[#1A1640] hover:bg-[#2A2550] transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Branding */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} h-16 mb-4 ${collapsed ? 'px-2' : ''} relative`}>
          {/* Logo: Show clinic logo if available, otherwise MolarPlus logo */}
          {clinicData?.logo ? (
            <img 
              src={clinicData.logo} 
              alt={clinicData.name || "Clinic Logo"} 
              className={`${collapsed ? 'w-10 h-10' : 'w-12 h-12'} rounded-full object-cover flex-shrink-0 border-2 border-white/20 transition-all`}
            />
          ) : (
            <img 
              src="/molarplus-logo.svg" 
              alt="MolarPlus" 
              className={`${collapsed ? 'w-10 h-10' : 'w-12 h-12'} flex-shrink-0 object-contain transition-all`}
            />
          )}
          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-3xl font-extrabold text-white tracking-tight" style={{ fontFamily: 'serif', letterSpacing: '-0.03em' }}>
                {formatClinicName(clinicData?.name).first}
              </span>
              <span className="text-sm font-medium text-white/80 tracking-wide">
                {formatClinicName(clinicData?.name).rest}
              </span>
            </div>
          )}
          {/* Collapse button when expanded */}
          {!isMobile && !collapsed && (
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
          {/* Expand button when collapsed - pops out from right edge */}
          {!isMobile && collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="absolute right-0 top-4 translate-x-[70%] flex items-center justify-center w-7 h-7 bg-[#0E0B2D] text-white hover:bg-[#1A1640] transition-colors cursor-pointer z-40 rounded-l-lg rounded-r-lg"
              title="Show navigation"
              style={{
                boxShadow: '-4px 0 8px rgba(0, 0, 0, 0.1)'
              }}
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
        </div>

        {/* Main Menu */}
        {!collapsed && (
          <div className="mb-3">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider px-4">Main Menu</span>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto flex flex-col gap-1.5 mb-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isSubmenuActive = item.submenu?.some(sub => location.pathname === sub.path);

            if (item.hasSubmenu) {
              return (
                <div key={item.name}>
                  <button
                    onClick={() => setInboxExpanded(!inboxExpanded)}
                    className={`w-full ${linkClass(item.path)} ${collapsed ? 'group' : ''} ${isSubmenuActive ? 'bg-white/8 text-white' : ''}`}
                    title={collapsed ? item.name : ''}
                  >
                    <div className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} flex items-center justify-center transition-all ${isSubmenuActive ? 'text-white' : 'text-[#9B8CFF]'}`}>
                      {item.icon}
                    </div>
                    {!collapsed && (
                      <>
                        <span className="text-sm flex-1 text-left">{item.name}</span>
                        {inboxExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </>
                    )}
                    {collapsed && (
                      <span className="absolute left-full ml-2 px-2 py-1 bg-[#1A1640] text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-[rgba(155,140,255,0.2)]">
                        {item.name}
                      </span>
                    )}
                  </button>
                  {item.submenu && inboxExpanded && !collapsed && (
                    <div className="ml-8 mt-1 flex flex-col gap-1">
                      {item.submenu.map((subItem) => {
                        const isSubActive = location.pathname === subItem.path;
                        return (
                          <Link
                            key={subItem.name}
                            to={subItem.path}
                            className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-all text-sm ${isSubActive ? 'bg-white/20 text-white font-medium' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                          >
                            <div className="w-4 h-4 flex items-center justify-center">{subItem.icon}</div>
                            <span>{subItem.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link 
                key={item.name} 
                to={item.path} 
                className={`${linkClass(item.path)} ${collapsed ? 'group' : ''}`}
                title={collapsed ? item.name : ''}
              >
                <div className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} flex items-center justify-center transition-all ${isActive ? 'text-white' : 'text-[#9B8CFF]'} ${collapsed && isActive ? 'scale-110' : ''}`}>
                  {item.icon}
                </div>
                {!collapsed && <span className="text-sm">{item.name}</span>}
                {collapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-[#1A1640] text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-[rgba(155,140,255,0.2)]">
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Admin section */}
          {!collapsed && (
            <div className="mt-4 mb-3">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider px-4">Admin</span>
            </div>
          )}
          {adminNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.name} 
                to={item.path} 
                className={`${linkClass(item.path)} ${collapsed ? 'group' : ''}`}
                title={collapsed ? item.name : ''}
              >
                <div className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} flex items-center justify-center transition-all ${isActive ? 'text-white' : 'text-[#9B8CFF]'}`}>
                  {item.icon}
                </div>
                {!collapsed && <span className="text-sm">{item.name}</span>}
                {collapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-[#1A1640] text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-[rgba(155,140,255,0.2)]">
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Subscription Section - Only when expanded */}
        {!collapsed && (
          <div className="flex flex-col pt-3 border-t border-[rgba(155,140,255,0.2)]">
            <div className="px-3 py-2.5 bg-[#1A1640] rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span className="text-sm font-semibold text-white">Subscription</span>
                </div>
                <span className="text-xs font-medium text-white bg-[#6C4CF3] px-2 py-0.5 rounded-full border border-[#9B8CFF]">Free (current)</span>
              </div>

              {/* Tutorial Link */}
              <button
                onClick={() => window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank')}
                className="w-full flex items-center gap-2 text-sm text-white/80 hover:text-white transition group mb-3"
              >
                <div className="w-7 h-7 bg-red-500/50 rounded-lg flex items-center justify-center group-hover:bg-red-500 transition flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
                <span className="text-xs font-medium">Watch tutorial</span>
              </button>

              {/* Upgrade Button */}
              <button 
                onClick={() => navigate("/subscription")}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-all text-sm shadow-sm"
              >
                Upgrade to Pro
              </button>

              {/* Trial notification */}
              {true && (
                <p className="text-xs text-amber-300 text-center mt-2">
                  Trial ends in 7 days
                </p>
              )}
            </div>
          </div>
        )}

        {/* Upgrade button when collapsed */}
        {collapsed && (
          <div className="flex flex-col pt-3 border-t border-[rgba(155,140,255,0.2)]">
            <button
              onClick={() => navigate("/subscription")}
              className="relative bg-orange-500 hover:bg-orange-600 rounded-xl p-3 transition-all group w-full"
              title="Upgrade - Trial ends in 7 days"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0E0B2D]"></span>
              {/* Tooltip */}
              <span className="absolute left-full ml-2 px-2 py-1 bg-[#1A1640] text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-[rgba(155,140,255,0.2)]">
                Upgrade
              </span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar; 