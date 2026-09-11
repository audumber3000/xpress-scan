import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";
import { Search, X, Menu, Settings, RefreshCw } from "lucide-react";
import { api } from "../utils/api";

// Simple fallback avatar generator
const generateAvatarUrl = (name) => {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=2a276e&color=fff`;
};

const Header = ({ onOpenMobileSidebar }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { title, titlePath, refreshFunction, refreshPath, loading, handleRefresh } = useHeader();
  
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  const isDashboardPage = location.pathname === '/' || location.pathname === '/dashboard';

  const getRouteTitle = (pathname) => {
    const staticTitles = {
      '/': 'Dashboard',
      '/dashboard': 'Dashboard',
      '/cases': 'Cases',
      '/cases/new': 'New Case',
      '/clients': 'Clients',
      '/clients/new': 'New Client',
      '/catalog': 'Catalog',
      '/billing': 'Billing',
      '/settings': 'Settings',
    };

    if (staticTitles[pathname]) return staticTitles[pathname];
    if (pathname.startsWith('/cases/')) return 'Case Details';
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

  const userNameRaw = user?.first_name 
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.name || user?.email?.split("@")[0] || "User";

  const userName = userNameRaw;
  const userEmail = user?.email || "";
  const userAvatar = generateAvatarUrl(userName);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  // Fetch notifications - mock for lab
  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      // Future API call: const data = await api.get('/activity-log');
      setNotifications([]); 
    } catch { /* silent */ } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Search cases/clients
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await api.get(`/search?q=${encodeURIComponent(searchQuery)}&limit=8`);
        setSearchResults(Array.isArray(data) ? data : []);
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

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 shadow-sm">
      {/* Inline search bar */}
      {showSearch && (
        <div className="absolute inset-0 bg-white z-40 flex items-center px-4 gap-3 animate-fadeIn" ref={searchRef}>
          <Search size={18} className="text-[#2a276e] flex-shrink-0" />
          <div className="flex-1 relative">
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search cases or clients…"
              className="w-full text-sm outline-none text-gray-900 placeholder-gray-400 bg-transparent"
            />
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
      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
        {onOpenMobileSidebar && (
          <button
            onClick={onOpenMobileSidebar}
            className="md:hidden p-2 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        )}

        {/* Lab Indicator (replaces Clinic Switcher) */}
        <div className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200">
          <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 shadow-sm bg-[#2a276e] flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {(user?.lab?.name || "L")[0]?.toUpperCase()}
            </span>
          </div>
          <div className="hidden md:flex flex-col items-start leading-tight min-w-0">
            <span className="text-sm font-bold text-[#2a276e] truncate max-w-[140px]">
              {user?.lab?.name || "Dental Lab"}
            </span>
            <span className="text-xs text-gray-500 truncate max-w-[140px]">
              Lab Portal
            </span>
          </div>
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
                <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right side - Icons and User Profile */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Search Icon */}
        <button
          onClick={() => setShowSearch(true)}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          title="Search"
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
              <span className="text-xs text-gray-500 leading-tight">Admin</span>
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
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20 animate-fadeIn">
                <div className="px-4 py-3 border-b border-gray-200">
                  <p className="text-sm font-semibold text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                </div>
                <button
                  onClick={() => {
                    navigate("/settings");
                    setShowProfileDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Settings
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
      {showNotifications && createPortal(
        <>
          <div className="fixed inset-0 bg-black/30 z-[60] animate-fadeIn" onClick={() => setShowNotifications(false)} />
          <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[70] flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Activity Feed</h3>
                <p className="text-xs text-gray-400 mt-0.5">Latest activities</p>
              </div>
              <button onClick={() => setShowNotifications(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">No activity yet</p>
                </div>
            </div>
          </div>
        </>, document.body
      )}
    </header>
  );
};

export default Header;
