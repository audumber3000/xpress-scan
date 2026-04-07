import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useInboxActions } from "../contexts/InboxContext";
import { useHeader } from "../contexts/HeaderContext";
import { Gem, Crown, Search, X } from "lucide-react";
import { FaSync } from "react-icons/fa";
import { api } from "../utils/api";

const Header = () => {
  const { user, signOut, switchClinic } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { inboxActions } = useInboxActions();
  const { title, refreshFunction, loading, handleRefresh } = useHeader();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showClinicDropdown, setShowClinicDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  
  const isInboxPage = location.pathname === '/inbox';
  const isDashboardPage = location.pathname === '/dashboard';

  // Improved user info extraction
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

  const userRole = user?.role || "staff";
  const roleInfo = getRoleInfo(userRole);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleClinicSwitch = async (clinicId) => {
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

  // Search patients
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await api.get(`/patients?search=${encodeURIComponent(searchQuery)}&limit=8`);
        setSearchResults(Array.isArray(data) ? data : (data?.patients || []));
      } catch { setSearchResults([]); } finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Close search on outside click
  useEffect(() => {
    if (!showSearch) return;
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) { setShowSearch(false); setSearchQuery(''); setSearchResults([]); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSearch]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [showSearch]);
  
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
      {/* Inline search bar — expands over the left side of the header */}
      {showSearch && (
        <div className="absolute inset-0 bg-white z-40 flex items-center px-4 gap-3" ref={searchRef}>
          <Search size={18} className="text-[#29828a] flex-shrink-0" />
          <div className="flex-1 relative">
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search patient by name or phone…"
              className="w-full text-sm outline-none text-gray-900 placeholder-gray-400 bg-transparent"
            />
            {/* Results dropdown */}
            {(searchResults.length > 0 || searchLoading || searchQuery) && (
              <div className="absolute top-full left-0 mt-2 w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                {searchLoading && (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">Searching…</div>
                )}
                {!searchLoading && searchQuery && searchResults.length === 0 && (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">No patients found</div>
                )}
                {!searchLoading && searchResults.length > 0 && (
                  <ul className="max-h-72 overflow-y-auto py-1">
                    {searchResults.map(p => (
                      <li key={p.id}>
                        <button
                          onClick={() => { navigate(`/patient-profile/${p.id}`); setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-[#29828a]/5 flex items-center gap-3 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#29828a]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-[#29828a]">{(p.name || p.full_name || '?')[0]?.toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{p.name || p.full_name}</p>
                            <p className="text-xs text-gray-400">{p.phone || p.mobile || 'No phone'}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Left side - Page title and refresh button */}
      <div className="flex items-center gap-4 flex-1">
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
              <span className="text-sm font-bold text-[#2a276e] truncate max-w-[140px]">
                {user?.clinic?.name || "Select Clinic"}
              </span>
              <span className="text-xs text-gray-500 truncate max-w-[140px]">
                {user?.clinic?.address?.split(",")[0] || user?.clinic?.email || "Clinic"}
              </span>
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
                    onClick={() => { setShowClinicDropdown(false); navigate("/add-clinic"); }}
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

        {!isDashboardPage && title && (
          <>
            <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{title}</h1>
              {refreshFunction && (
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                  title={typeof title === 'string' ? `Refresh ${title.toLowerCase()}` : 'Refresh'}
                >
                  <FaSync className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right side - Icons and User Profile */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Inbox-specific icons - only show on inbox page */}
        {isInboxPage && inboxActions?.status !== undefined && (
          <>
            {/* Refresh Status Icon */}
            <button
              onClick={inboxActions.onRefresh}
              disabled={inboxActions.loading}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              title="Refresh Status"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Connect/Disconnect Button */}
            {inboxActions.status === "ready" ? (
              <button
                onClick={inboxActions.onDisconnect}
                disabled={inboxActions.loading}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                title="Disconnect WhatsApp"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Disconnect
              </button>
            ) : (
              <button
                onClick={inboxActions.onConnect}
                disabled={inboxActions.loading || inboxActions.initializing}
                className="px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20BA5A] text-white text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                title="Connect WhatsApp"
              >
                {inboxActions.initializing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Connect
                  </>
                )}
              </button>
            )}
          </>
        )}

        {/* Default icons - only show when NOT on inbox page */}
        {!isInboxPage && (
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
              {user?.clinic?.subscription_plan === 'professional' ? (
                <button
                  onClick={() => navigate("/subscription")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-100 via-amber-50 to-white border border-amber-200/50 shadow-sm hover:shadow transition-all"
                  title="Professional Plan"
                >
                  <Crown size={18} className="text-amber-500 fill-amber-400" />
                  <span className="text-[15px] font-semibold text-gray-800 tracking-wide">Pro</span>
                </button>
              ) : (
                <button
                  onClick={() => navigate("/subscription")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#feedd5] border border-[#fdd2a4]/40 shadow-sm hover:shadow transition-all"
                  title="Starter Plan"
                >
                  <Gem size={18} className="text-blue-500 fill-[#8b5cf6] opacity-90" />
                  <span className="text-[15px] font-medium text-[#2d3748]">Starter</span>
                </button>
              )}
            </div>

            <div className="w-px h-6 bg-gray-300 hidden md:block mx-1"></div>
          </>
        )}

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
              className={`w-4 h-4 text-gray-500 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`}
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
                    navigate("/doctor-profile");
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
                    navigate("/subscription");
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
                        onClick={() => n.link && navigate(n.link)}
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

