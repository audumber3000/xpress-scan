import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
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
    name: "Patients",
    path: "/patients",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    name: "Reports",
    path: "/reports",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: "Voice Reporting",
    path: "/voice-reporting",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
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
    name: "Communication",
    path: "/communication",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    name: "Calendar",
    path: "/calendar",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
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

const Sidebar = ({ isMobileOpen, onMobileClose, isCollapsed, onCollapseChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isMobile, setIsMobile] = useState(false);

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

  const linkClass = (path) => {
    const baseClasses = "flex items-center gap-3 py-2 px-4 rounded-lg transition font-medium text-gray-700 whitespace-nowrap";
    const activeClasses = location.pathname === path ? "bg-green-100 text-green-700 border border-green-500" : "hover:bg-green-50";
    return `${baseClasses} ${activeClasses}`;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  // Improved user info extraction for Google OAuth
  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.name ||
    user?.email?.split("@")[0] ||
    "User";

  const userEmail = user?.email || "";
  const userAvatar =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    "https://randomuser.me/api/portraits/men/32.jpg";

  // Get role icon and color
  const getRoleInfo = (role) => {
    switch (role) {
      case "clinic_owner":
        return {
          icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: "bg-purple-100 text-purple-700 border-purple-200",
          label: "Clinic Owner"
        };
      case "doctor":
        return {
          icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
          color: "bg-blue-100 text-blue-700 border-blue-200",
          label: "Doctor"
        };
      case "receptionist":
        return {
          icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
          color: "bg-green-100 text-green-700 border-green-200",
          label: "Receptionist"
        };
      default:
        return {
          icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
          color: "bg-gray-100 text-gray-700 border-gray-200",
          label: userName || "Staff"
        };
    }
  };

  const userRole = user?.role || "staff";
  const roleInfo = getRoleInfo(userRole);

  // Mobile sidebar classes
  const mobileClasses = isMobile 
    ? `fixed top-0 left-0 z-50 h-full transform transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`
    : '';

  // Desktop sidebar classes
  const desktopClasses = !isMobile 
    ? `flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-72'} ${collapsed ? 'p-2' : 'p-4'}`
    : 'flex flex-col h-full w-72 bg-white p-4';

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onMobileClose}
        />
      )}
      
      <aside className={`${mobileClasses} ${desktopClasses}`}>


        {/* Mobile close button */}
        {isMobile && (
          <button
            onClick={onMobileClose}
            className="absolute top-4 right-4 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Branding */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} h-16 mb-4`}>
          <span className="bg-green-100 text-green-600 rounded-full p-2 flex-shrink-0">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <style>
                {`
                  .scan-line { animation: scan-sweep 4.5s ease-in-out infinite; }
                  
                  @keyframes scan-sweep {
                    0% { transform: translateY(10px); opacity: 0; }
                    15% { opacity: 1; }
                    35% { transform: translateY(-10px); opacity: 1; }
                    50% { transform: translateY(-10px); opacity: 1; }
                    65% { transform: translateY(10px); opacity: 1; }
                    85% { opacity: 1; }
                    100% { transform: translateY(10px); opacity: 0; }
                  }
                `}
              </style>
              
              {/* Simple skeleton - bigger size */}
              {/* Head */}
              <circle cx="12" cy="5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              
              {/* Spine */}
              <line x1="12" y1="7.5" x2="12" y2="19" stroke="currentColor" strokeWidth="1.5"/>
              
              {/* Ribs - simple curved lines */}
              <path d="M12 9c-2.5 0-4 1.5-4 1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
              <path d="M12 9c2.5 0 4 1.5 4 1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
              <path d="M12 11c-3 0-4.5 1.5-4.5 1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
              <path d="M12 11c3 0 4.5 1.5 4.5 1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
              <path d="M12 13c-3 0-4.5 1.5-4.5 1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
              <path d="M12 13c3 0 4.5 1.5 4.5 1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
              <path d="M12 15c-2.5 0-4 1.5-4 1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
              <path d="M12 15c2.5 0 4 1.5 4 1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
              
              {/* Arms */}
              <line x1="12" y1="10" x2="7" y2="13" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="12" y1="10" x2="17" y2="13" stroke="currentColor" strokeWidth="1.5"/>
              
              {/* Legs */}
              <line x1="12" y1="19" x2="9" y2="22" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="12" y1="19" x2="15" y2="22" stroke="currentColor" strokeWidth="1.5"/>
              
              {/* Scanning line - moves up and down */}
              <line x1="6" y1="12" x2="18" y2="12" 
                    stroke="currentColor" strokeWidth="2" opacity="0.8" className="scan-line"/>
            </svg>
          </span>
          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-3xl font-extrabold text-black tracking-tight" style={{ fontFamily: 'serif', letterSpacing: '-0.03em' }}>
                Dhanvantri
              </span>
              <span className="text-sm font-medium text-gray-600 tracking-wide">
                Radiology Center
              </span>
            </div>
          )}
          {/* Collapse/Expand button - positioned next to branding */}
          {!isMobile && !collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="bg-gray-100 hover:bg-gray-200 rounded-lg p-2 transition-colors flex-shrink-0"
              title="Hide navigation"
            >
              <svg 
                className="w-4 h-4 text-gray-600" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {/* Expand button when collapsed */}
          {!isMobile && collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="bg-gray-100 hover:bg-gray-200 rounded-lg p-2 transition-colors"
              title="Show navigation"
            >
              <svg 
                className="w-4 h-4 text-gray-600 rotate-180" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Main Nav */}
        <nav className="flex flex-col gap-1 mb-6">
          {navItems.map((item) => (
            <Link 
              key={item.name} 
              to={item.path} 
              className={`${linkClass(item.path)} ${collapsed ? 'justify-center px-2' : ''}`}
              title={collapsed ? item.name : ''}
            >
              <div className={collapsed ? 'w-8 h-8' : 'w-5 h-5'}>
                {item.icon}
              </div>
              {!collapsed && item.name}
            </Link>
          ))}
        </nav>

        {/* User Profile & Sign Out */}
        <div className="mt-auto flex flex-col gap-2">
          <div 
            className={`flex items-center gap-3 p-3 rounded-lg bg-gray-50 cursor-pointer hover:bg-green-50 transition ${collapsed ? 'justify-center' : ''}`} 
            onClick={() => navigate("/doctor-profile")}
            title={collapsed ? `${userName} - ${userEmail}` : ''}
          >
            <img src={userAvatar} alt="User" className="w-10 h-10 rounded-full flex-shrink-0" />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm">{userName}</div>
                <div className="text-xs text-gray-500 truncate max-w-[140px]" title={userEmail}>{userEmail}</div>
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${roleInfo.color} mt-1`}>
                  <span className="text-gray-600">Role:</span>
                  {roleInfo.icon}
                  {roleInfo.label}
                </div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button onClick={handleSignOut} className="w-full py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-semibold transition text-sm">
              Sign Out
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar; 