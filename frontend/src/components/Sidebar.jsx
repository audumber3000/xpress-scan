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
      {
        name: "WhatsApp",
        path: "/inbox",
        icon: (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        )
      },
      {
        name: "Mail",
        path: "/mail",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
      }
    ]
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
      : "flex items-center gap-3 py-3 px-4 rounded-xl transition-all font-medium whitespace-nowrap";
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

  // Desktop sidebar classes - Gradient background (teal for admin, purple for main)
  const desktopClasses = !isMobile 
    ? `flex flex-col h-screen transition-all duration-300 ease-in-out ${collapsed ? 'w-20' : 'w-64'} ${collapsed ? 'p-3' : 'p-5'} relative ${
        isAdminRoute 
          ? 'bg-gradient-to-b from-[#0d2a2d] via-[#1F6B72] to-[#29828a]' 
          : 'bg-gradient-to-b from-[#0d0a2d] via-[#1a1548] to-[#2a276e]'
      }`
    : `flex flex-col h-full w-64 p-5 ${
        isAdminRoute
          ? 'bg-gradient-to-b from-[#0d2a2d] via-[#1F6B72] to-[#29828a]'
          : 'bg-gradient-to-b from-[#0d0a2d] via-[#1a1548] to-[#2a276e]'
      }`;

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onMobileClose}
        />
      )}
      
      <aside className={`${mobileClasses} ${desktopClasses} ${collapsed && !isMobile ? 'shadow-2xl' : ''} ${collapsed && !isMobile ? 'overflow-visible' : ''} relative`}>
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
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} mb-6 ${collapsed ? 'px-2' : ''} relative`}>
          {/* Logo: Show clinic logo if available, otherwise tooth icon */}
          {clinicData?.logo ? (
            <img 
              src={clinicData.logo} 
              alt={clinicData.name || "Clinic Logo"} 
              className={`${collapsed ? 'w-10 h-10' : 'w-11 h-11'} rounded-xl object-cover flex-shrink-0 transition-all`}
            />
          ) : (
            <div className={`${collapsed ? 'w-10 h-10' : 'w-11 h-11'} flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex-shrink-0 transition-all shadow-lg`}>
              {/* Tooth Icon */}
              <i className={`las la-tooth ${collapsed ? 'text-xl' : 'text-2xl'} text-white`}></i>
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-base font-bold text-white leading-tight">
                {clinicData?.name || "Clino Health"}
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

        {/* Main Menu Section */}
        {!collapsed && (
          <div className="mb-3">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider px-4">Main Menu</span>
          </div>
        )}

        {/* Main Nav */}
        <nav className="flex flex-col gap-1.5">
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isInboxParent = item.name === "Inbox";
            const isSubmenuActive = item.submenu?.some(sub => location.pathname === sub.path);
            
            return (
              <div key={item.name}>
                {/* Main nav item */}
                {item.hasSubmenu ? (
                  <button
                    onClick={() => setInboxExpanded(!inboxExpanded)}
                    className={`w-full ${linkClass(item.path)} ${collapsed ? 'group' : ''} ${isSubmenuActive ? 'bg-white text-gray-900 shadow-lg' : ''}`}
                    title={collapsed ? item.name : ''}
                  >
                    <div className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} flex items-center justify-center transition-all ${isSubmenuActive ? 'text-gray-900' : 'text-white/80'}`}>
                      {item.icon}
                    </div>
                    {!collapsed && (
                      <>
                        <span className="text-sm flex-1 text-left">{item.name}</span>
                        {inboxExpanded ? (
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
                    className={`${linkClass(item.path)} ${collapsed ? 'group' : ''}`}
                    title={collapsed ? item.name : ''}
                  >
                    <div className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} flex items-center justify-center transition-all ${isActive ? 'text-gray-900' : 'text-white/80'}`}>
                      {item.icon}
                    </div>
                    {!collapsed && <span className="text-sm">{item.name}</span>}
                    {/* Tooltip for collapsed state */}
                    {collapsed && (
                      <span className="absolute left-full ml-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
                        {item.name}
                      </span>
                    )}
                  </Link>
                )}
                
                {/* Submenu items */}
                {item.hasSubmenu && inboxExpanded && !collapsed && (
                  <div className="ml-8 mt-1 flex flex-col gap-1">
                    {item.submenu.map((subItem) => {
                      const isSubActive = location.pathname === subItem.path;
                      return (
                        <Link
                          key={subItem.name}
                          to={subItem.path}
                          className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-all text-sm ${
                            isSubActive
                              ? 'bg-white/20 text-white font-medium'
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {subItem.icon}
                          </div>
                          <span>{subItem.name}</span>
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
        {!collapsed && (
          <div className="mt-6 mb-3">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider px-4">Admin</span>
          </div>
        )}

        {/* Admin Nav with Scroll */}
        <nav className="flex-1 overflow-y-auto flex flex-col gap-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {adminNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.name} 
                to={item.path} 
                className={`${linkClass(item.path)} ${collapsed ? 'group' : ''}`}
                title={collapsed ? item.name : ''}
              >
                <div className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} flex items-center justify-center transition-all ${isActive ? 'text-gray-900' : 'text-white/80'}`}>
                  {item.icon}
                </div>
                {!collapsed && <span className="text-sm">{item.name}</span>}
                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <span className="absolute left-full ml-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

      </aside>
    </>
  );
};

export default Sidebar; 