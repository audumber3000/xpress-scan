import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";
import { Gem, Crown, Search, X, Clock, Menu } from "lucide-react";
import { FaSync } from "react-icons/fa";
import { api } from "../utils/api";
import { generateAvatarUrl } from "../utils/avatar";
import { SkeletonBox } from "./Skeleton";
import GlobalSearchModal from "./GlobalSearchModal";
import { useNavigationGuard } from "../contexts/NavigationGuardContext";

const Header = ({ onOpenMobileSidebar }) => {
  const { user, signOut, switchClinic, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { attemptNavigate } = useNavigationGuard();
  // Guarded navigate — prompts to save if a case paper has unsaved edits.
  const gnav = (to) => attemptNavigate(() => navigate(to));
  const location = useLocation();
  const { title, titlePath, refreshFunction, refreshPath, loading, handleRefresh } = useHeader();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showClinicDropdown, setShowClinicDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // Search state
  const [showSearch, setShowSearch] = useState(false);

  const isDashboardPage = location.pathname === '/dashboard';

  // On first login the clinic object may not be hydrated yet (login response
  // didn't include it; /auth/me fills it in a moment later). Show a shimmer
  // instead of flashing the literal "Select Clinic" fallback during that gap.
  const clinicHydrating = !user?.clinic?.name && (authLoading || !!user?.clinic_id);

  const getRouteTitle = (pathname) => {
    const staticTitles = {
      '/dashboard': 'Dashboard',
      '/calendar': 'Appointments',
      '/patients': 'Patients',
      '/patient-files': 'Patient Files',
      '/payments': 'Payments',
      '/vendors': 'Inventory & Vendors',
      '/consent-forms': 'Consent Forms',
      '/lab': 'Laboratory',
      '/reports': 'Reports',
      '/marketing/reviews': 'Google Reviews',
      '/marketing/posters': 'Marketing Posters',
      '/admin': 'Admin Hub',
      '/admin/attendance': 'Attendance',
      '/admin/staff': 'Staff Management',
      '/admin/treatments': 'Treatments & Pricing',
      '/admin/permissions': 'Permissions',
      '/admin/clinic': 'Clinic Info',
      '/admin/templates': 'Message Templates',
      '/admin/doctors': 'Referring Doctors',
      '/admin/templates-editor': 'Templates Editor',
      '/admin/notifications': 'Notifications',
      '/admin/subscription': 'Subscription & Billing',
      '/settings': 'Settings',
      '/user-management': 'Settings',
      '/doctor-profile': 'Profile Settings',
      '/subscription': 'Subscription & Billing',
      '/support': 'Support',
      '/support-tickets': 'Help Center',
      '/add-clinic': 'Add Branch',
      '/checkout': 'Checkout',
      '/mail': 'Mail',
      '/mail/callback': 'Mail',
      '/patient-intake': 'Patient Intake',
    };

    if (staticTitles[pathname]) return staticTitles[pathname];
    if (pathname.startsWith('/admin/practice-settings/')) return 'Practice Settings';
    if (pathname.startsWith('/patient-profile/')) return 'Patient Profile';
    if (pathname.startsWith('/consent/sign/')) return 'Consent Form';
    return '';
  };

  const routeTitle = getRouteTitle(location.pathname);
  const routeOwnsTitle = titlePath === location.pathname;
  const customTitle = routeOwnsTitle ? title : '';
  const customTitleIsText = typeof customTitle === 'string' && customTitle.trim();
  const customTitleIsNode = customTitle && typeof customTitle !== 'string';
  const pageTitle = routeTitle || customTitleIsText || '';
  const activeRefreshFunction = refreshPath === location.pathname ? refreshFunction : null;
  const canShowPageHeader = !isDashboardPage && pageTitle;

  const handleHeaderRefresh = () => {
    if (activeRefreshFunction) {
      handleRefresh();
      return;
    }
    window.location.reload();
  };

  // Improved user info extraction
  const userRole = user?.role || "staff";
  const userNameRaw =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.name ||
    user?.email?.split("@")[0] ||
    "User";

  // Add professional title based on role
  const titlePrefix = (userRole === 'clinic_owner' || userRole === 'doctor') ? 'Dr. ' : '';
  const userName = `${titlePrefix}${userNameRaw}`;

  const userEmail = user?.email || "";
  const userAvatar =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    generateAvatarUrl(userEmail || userName);

  // Get role info
  const getRoleInfo = (role) => {
    switch (role) {
      case "clinic_owner":
        return { label: "Clinic Owner", color: "text-purple-700" };
      case "doctor":
        return { label: "Doctor", color: "text-blue-700" };
      case "receptionist":
        return { label: "Receptionist", color: "text-[#2a276e]" };
      default:
        return { label: "Staff", color: "text-gray-700" };
    }
  };

  const roleInfo = getRoleInfo(userRole);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleClinicSwitch = (clinicId) => {
    // Switching clinic reloads the page and replaces all data — guard it so an
    // open case paper with unsaved edits prompts first.
    attemptNavigate(async () => {
      setIsSwitching(true);
      try {
        await switchClinic(clinicId);
        setShowClinicDropdown(false);
        // Refresh current page to load new clinic data
        window.location.reload();
      } catch (error) {
        console.error("Failed to switch clinic:", error);
      } finally {
        setIsSwitching(false);
      }
    });
  };
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const data = await api.get('/activity-log');
      setNotifications(Array.isArray(data) ? data : []);
    } catch { /* silent */ } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Open global search with ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 shadow-sm">
      {/* Centered command-palette search (opens from the search icon or ⌘K) */}
      <GlobalSearchModal open={showSearch} onClose={() => setShowSearch(false)} />

      {/* Left side - Page title and refresh button */}
      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
        {/* Mobile menu button — opens the sidebar drawer */}
        {onOpenMobileSidebar && (
          <button
            onClick={onOpenMobileSidebar}
            className="md:hidden p-2 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        )}

        {/* Clinic Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowClinicDropdown(!showClinicDropdown)}
            className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-xl bg-[#f0f0fd] hover:bg-[#e4e3f9] border border-[#c5c2f0] transition-all duration-200"
            disabled={isSwitching}
            title="Switch Clinic"
          >
            {/* Clinic thumbnail / avatar */}
            <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
              <img
                src={user?.clinic?.logo_url || "https://images.unsplash.com/photo-1629909615184-74f495363b67?w=80&h=80&fit=crop&auto=format"}
                alt={user?.clinic?.name || "Clinic"}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1629909615184-74f495363b67?w=80&h=80&fit=crop&auto=format"; }}
              />
            </div>

            {/* Name + subtitle */}
            <div className="hidden md:flex flex-col items-start leading-tight min-w-0">
              {clinicHydrating ? (
                <>
                  <SkeletonBox className="h-4 w-28 mb-1" />
                  <SkeletonBox className="h-3 w-20" />
                </>
              ) : (
                <>
                  <span className="text-sm font-bold text-[#2a276e] truncate max-w-[140px]">
                    {user?.clinic?.name || "Select Clinic"}
                  </span>
                  <span className="text-xs text-gray-500 truncate max-w-[140px]">
                    {user?.clinic?.address?.split(",")[0] || user?.clinic?.email || "Clinic"}
                  </span>
                </>
              )}
            </div>

            {/* Chevron */}
            <svg
              className={`w-4 h-4 text-[#2a276e] flex-shrink-0 transition-transform duration-200 ${showClinicDropdown ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          {showClinicDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowClinicDropdown(false)} />
              <div className="absolute left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                {/* Label */}
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400">Branches</p>
                </div>

                {/* Clinic list */}
                {(user?.clinics?.length > 0 ? user.clinics : [user?.clinic]).filter(Boolean).map((clinic) => {
                  const isActive = user?.clinic_id === clinic.id;
                  return (
                    <button
                      key={clinic.id}
                      onClick={() => handleClinicSwitch(clinic.id)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors ${isActive ? 'bg-gray-50' : ''}`}
                      disabled={isSwitching || isActive}
                    >
                      <img
                        src={clinic.logo_url || "https://images.unsplash.com/photo-1629909615184-74f495363b67?w=80&h=80&fit=crop&auto=format"}
                        alt={clinic.name}
                        className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                        onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1629909615184-74f495363b67?w=80&h=80&fit=crop&auto=format"; }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className={`text-sm font-semibold truncate ${isActive ? 'text-[#2a276e]' : 'text-gray-800'}`}>
                          {clinic.name}
                        </span>
                        <span className="text-xs text-gray-400 truncate">
                          {clinic.address || clinic.email || "—"}
                        </span>
                      </div>
                    </button>
                  );
                })}  

                {/* Add new branch */}
                <div className="border-t border-gray-100 mt-1 px-4 py-2">
                  <button
                    onClick={() => { setShowClinicDropdown(false); gnav("/add-clinic"); }}
                    className="w-full flex items-center justify-between py-1.5 text-sm font-semibold text-[#2a276e] hover:text-[#1a1548] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add new branch
                    </div>
                    {user?.clinic?.subscription_plan !== 'professional' && (
                      <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {canShowPageHeader && (
          <>
            <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
            <div className="flex items-center gap-2 min-w-0">
              {customTitleIsNode && (
                <div className="hidden sm:flex items-center shrink-0">{customTitle}</div>
              )}
              <h1 className="text-xl font-bold text-gray-900 truncate">{pageTitle}</h1>
              <button
                onClick={handleHeaderRefresh}
                disabled={loading}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 shrink-0"
                title={`Refresh ${pageTitle.toLowerCase()}`}
              >
                <FaSync className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right side - Icons and User Profile */}
      <div className="flex items-center gap-2 md:gap-3">
        <>
            {/* Search Icon */}
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              title="Search patients"
            >
              <Search size={20} />
            </button>

            <div className="w-px h-6 bg-gray-300 hidden md:block mx-1"></div>

            {/* Notifications Icon */}
            <button
               onClick={() => { setShowNotifications(true); fetchNotifications(); }}
               className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors relative"
               title="Activity Feed"
            >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
               </svg>
               {notifications.length > 0 && (
                 <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white">
                   {notifications.length}
                 </span>
               )}
            </button>

            <div className="w-px h-6 bg-gray-300 hidden md:block mx-1"></div>

            {/* Plan Indicator */}
            <div className="flex items-center">
              {user?.clinic?.is_trial ? (
                <button
                  onClick={() => gnav("/subscription")}
                  className="flex items-center gap-1.5 md:gap-2 px-2.5 py-1.5 md:px-4 md:py-2 rounded-xl bg-gradient-to-r from-blue-100 via-blue-50 to-white border border-blue-200/60 shadow-sm hover:shadow transition-all"
                  title={
                    typeof user?.clinic?.trial_days_remaining === 'number'
                      ? `Trial · ${user.clinic.trial_days_remaining} day${user.clinic.trial_days_remaining === 1 ? '' : 's'} left`
                      : 'Trial Plan'
                  }
                >
                  <Clock size={16} className="text-blue-500 flex-shrink-0" />
                  <span className="text-xs md:text-[15px] font-semibold text-gray-800 tracking-wide whitespace-nowrap">
                    <span className="hidden sm:inline">Trial</span>
                    {typeof user?.clinic?.trial_days_remaining === 'number' ? (
                      <>
                        <span className="hidden sm:inline"> · </span>
                        {user.clinic.trial_days_remaining}d left
                      </>
                    ) : (
                      <span className="sm:hidden">Trial</span>
                    )}
                  </span>
                </button>
              ) : user?.clinic?.subscription_plan === 'professional' ? (
                <button
                  onClick={() => gnav("/subscription")}
                  className="flex items-center gap-1.5 md:gap-2 px-2.5 py-1.5 md:px-4 md:py-2 rounded-xl bg-gradient-to-r from-amber-100 via-amber-50 to-white border border-amber-200/50 shadow-sm hover:shadow transition-all"
                  title="Professional Plan"
                >
                  <Crown size={16} className="text-amber-500 fill-amber-400 flex-shrink-0" />
                  <span className="text-xs md:text-[15px] font-semibold text-gray-800 tracking-wide">Pro</span>
                </button>
              ) : (
                <button
                  onClick={() => gnav("/subscription")}
                  className="flex items-center gap-1.5 md:gap-2 px-2.5 py-1.5 md:px-4 md:py-2 rounded-xl bg-[#feedd5] border border-[#fdd2a4]/40 shadow-sm hover:shadow transition-all"
                  title="Starter Plan"
                >
                  <Gem size={16} className="text-blue-500 fill-[#8b5cf6] opacity-90 flex-shrink-0" />
                  <span className="text-xs md:text-[15px] font-medium text-[#2d3748] whitespace-nowrap">Starter</span>
                </button>
              )}
            </div>

            <div className="w-px h-6 bg-gray-300 hidden md:block mx-1"></div>
        </>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <img
              src={userAvatar}
              alt="User"
              className="w-8 h-8 rounded-full border border-gray-300"
            />
            <div className="hidden md:flex flex-col items-start">
              <span className="text-sm font-semibold text-gray-900 leading-tight">{userName}</span>
              <span className="text-xs text-gray-500 leading-tight">{roleInfo.label}</span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform hidden sm:block ${showProfileDropdown ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Profile Dropdown */}
          {showProfileDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowProfileDropdown(false)}
              ></div>
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                <div className="px-4 py-3 border-b border-gray-200">
                  <p className="text-sm font-semibold text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                  <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded ${roleInfo.color} bg-purple-50`}>
                    {roleInfo.label}
                  </span>
                </div>
                <button
                  onClick={() => {
                    gnav("/doctor-profile");
                    setShowProfileDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile Settings
                  </div>
                </button>
                <button
                  onClick={() => {
                    gnav("/subscription");
                    setShowProfileDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Subscription
                  </div>
                </button>
                <div className="border-t border-gray-200 my-1"></div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

      </div>

      {/* Notification Activity Drawer */}
      {showNotifications && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[60]" onClick={() => setShowNotifications(false)} />
          <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[70] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Activity Feed</h3>
                <p className="text-xs text-gray-400 mt-0.5">Latest {notifications.length} activities</p>
              </div>
              <button onClick={() => setShowNotifications(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {notifLoading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2">
                  <div className="w-6 h-6 border-2 border-[#29828a] border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-gray-400">Loading...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">No activity yet</p>
                  <p className="text-xs text-gray-300">Actions like adding patients, saving prescriptions, and creating invoices will appear here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {notifications.map((n) => {
                    const icons = {
                      patient_added: '👤',
                      appointment_booked: '📅',
                      prescription_saved: '💊',
                      invoice_created: '🧾',
                      payment_received: '💳',
                      general: '🔔',
                    };
                    const icon = icons[n.event_type] || icons.general;
                    const timeAgo = (() => {
                      const diff = Date.now() - new Date(n.created_at);
                      const m = Math.floor(diff / 60000);
                      if (m < 1) return 'Just now';
                      if (m < 60) return `${m}m ago`;
                      const h = Math.floor(m / 60);
                      if (h < 24) return `${h}h ago`;
                      return `${Math.floor(h / 24)}d ago`;
                    })();
                    return (
                      <li
                        key={n.id}
                        className={`px-5 py-3.5 hover:bg-gray-50 transition-colors ${n.link ? 'cursor-pointer' : ''}`}
                        onClick={() => n.link && gnav(n.link)}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-800 leading-snug">{n.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {n.actor_name && <span className="text-xs text-[#29828a] font-medium">{n.actor_name}</span>}
                              <span className="text-xs text-gray-400">{timeAgo}</span>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="p-4 border-t border-gray-100">
              <button
                onClick={fetchNotifications}
                className="w-full py-2 text-xs font-semibold text-[#29828a] hover:bg-[#29828a]/5 rounded-lg transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
};

export default Header;
