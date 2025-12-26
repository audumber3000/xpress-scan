import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";

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
  const [clinicData, setClinicData] = useState(null);

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
    const baseClasses = "flex items-center gap-3 py-2 px-4 rounded-lg transition font-medium text-gray-700 whitespace-nowrap";
    const activeClasses = location.pathname === path ? "bg-green-100 text-green-700 border border-green-500" : "hover:bg-green-50";
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
          {/* Logo: Show clinic logo if available, otherwise tooth icon */}
          {clinicData?.logo ? (
            <img 
              src={clinicData.logo} 
              alt={clinicData.name || "Clinic Logo"} 
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <span className="bg-green-100 text-green-600 rounded-full p-2 flex-shrink-0">
              {/* Simple Tooth Icon - Fallback */}
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C10.34 2 9 3.34 9 5C9 5.87 9.32 6.67 9.84 7.28C8.78 8.13 8 9.46 8 11C8 11.7 8.13 12.36 8.37 12.97C7.55 13.23 6.87 13.77 6.42 14.47C5.97 15.17 5.76 16 5.76 16.84C5.76 18.58 7.18 20 8.92 20C10.2 20 11.3 19.23 11.78 18.13C11.92 18.21 12.07 18.26 12.22 18.26C12.37 18.26 12.52 18.21 12.66 18.13C13.14 19.23 14.24 20 15.52 20C17.26 20 18.68 18.58 18.68 16.84C18.68 16 18.47 15.17 18.02 14.47C17.57 13.77 16.89 13.23 16.07 12.97C16.31 12.36 16.44 11.7 16.44 11C16.44 9.46 15.66 8.13 14.6 7.28C15.12 6.67 15.44 5.87 15.44 5C15.44 3.34 14.1 2 12.44 2H12Z"/>
              </svg>
            </span>
          )}
          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-3xl font-extrabold text-black tracking-tight" style={{ fontFamily: 'serif', letterSpacing: '-0.03em' }}>
                {formatClinicName(clinicData?.name).first}
              </span>
              <span className="text-sm font-medium text-gray-600 tracking-wide">
                {formatClinicName(clinicData?.name).rest}
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

        {/* Main Nav with Scroll - More space */}
        <nav className="flex-1 overflow-y-auto flex flex-col gap-1 mb-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
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

        {/* Combined Upgrade & User Profile - No extra card wrapper */}
        <div className="flex flex-col pt-3 border-t border-gray-200">
          {/* Collapsed view - Simple icon button */}
          {collapsed && (
            <>
              <button
                onClick={() => navigate("/subscription")}
                className="relative bg-orange-500 hover:bg-orange-600 rounded-lg p-3 transition-all mb-2"
                title="Upgrade - Trial ends in 7 days"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
              </button>
              <div 
                className="flex items-center justify-center p-2 rounded-lg bg-gray-50 cursor-pointer hover:bg-green-50 transition" 
                onClick={() => navigate("/doctor-profile")}
                title={`${userName} - ${userEmail}`}
              >
                <img src={userAvatar} alt="User" className="w-10 h-10 rounded-full flex-shrink-0" />
              </div>
            </>
          )}

          {/* Expanded sections - Cleaner design */}
          {!collapsed && (
            <>
              {/* Subscription Section */}
              <div className="px-3 py-2.5 bg-gray-50 rounded-lg mb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-800">Subscription</span>
                  </div>
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">Free (current)</span>
                </div>

                {/* Tutorial Link */}
                <button
                  onClick={() => window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank')}
                  className="w-full flex items-center gap-2 text-sm text-gray-700 hover:text-orange-600 transition group mb-3"
                >
                  <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
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

                {/* Trial notification - Only show if on trial */}
                {/* TODO: Replace this condition with actual subscription status check */}
                {true && (
                  <p className="text-xs text-amber-700 text-center mt-2">
                    Trial ends in 7 days
                  </p>
                )}
              </div>

              {/* User Profile Section */}
              <div 
                className="px-3 py-2.5 bg-gray-50 rounded-lg cursor-pointer hover:bg-green-50 transition"
                onClick={() => navigate("/doctor-profile")}
                title="Click to view profile & sign out"
              >
                <div className="flex items-center gap-2.5">
                  <img src={userAvatar} alt="User" className="w-9 h-9 rounded-full flex-shrink-0 border-2 border-gray-200" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm truncate">{userName}</div>
                    <div className="text-xs text-gray-500 truncate" title={userEmail}>{userEmail}</div>
                    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border ${roleInfo.color} mt-0.5`}>
                      {roleInfo.icon}
                      <span>{roleInfo.label}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar; 