import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";
import {
  Search, X, Menu, Bell, ChevronRight, Keyboard,
  UserRound, CreditCard, LifeBuoy, LogOut, Settings, BadgeCheck,
  UserPlus, CalendarDays, Pill, Receipt, Trash2,
} from "lucide-react";
import ShortcutsDrawer from "./ShortcutsDrawer";
import { canAccess } from "../utils/permissions";
import {
  ALL_SHORTCUTS, ACTION_HELP, ACTION_SEARCH, matchesCombo, isTypingTarget,
} from "../utils/shortcuts";
import { FaSync } from "react-icons/fa";
import { api } from "../utils/api";
import { generateAvatarUrl } from "../utils/avatar";
import { SkeletonBox } from "./Skeleton";
import GlobalSearchModal from "./GlobalSearchModal";
import { useNavigationGuard } from "../contexts/NavigationGuardContext";

/**
 * One row in the profile menu: icon, label, an optional right-hand value or
 * count, and a chevron. Kept at module scope so it isn't re-created per render.
 */
const MenuRow = ({ icon, iconClass = "text-[#2a276e]", label, value, badge = 0, onClick, danger = false }) => {
  const Icon = icon;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${danger ? 'hover:bg-red-50' : 'hover:bg-gray-50'}`}
    >
      <Icon size={18} className={danger ? 'text-red-600' : iconClass} />
      <span className={`flex-1 text-sm font-medium truncate ${danger ? 'text-red-600' : 'text-gray-700'}`}>
        {label}
      </span>
      {badge > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {value && <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{value}</span>}
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </button>
  );
};

/** Small grey section label inside the profile menu. */
const MenuLabel = ({ children }) => (
  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400">{children}</p>
);

/**
 * Shared style for the header's circular icon buttons (search, shortcuts,
 * activity). Fixed 40px so the three read as one set inside the 56px header.
 */
const ICON_BUTTON =
  'w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 flex items-center justify-center flex-shrink-0 transition-colors';

/**
 * Activity event -> icon and tint. Replaces the emoji this list used to render,
 * which sat oddly next to the rest of the app's Lucide iconography.
 */
const ACTIVITY_ICONS = {
  patient_added: { icon: UserPlus, className: 'bg-blue-50 text-blue-600' },
  appointment_booked: { icon: CalendarDays, className: 'bg-violet-50 text-violet-600' },
  prescription_saved: { icon: Pill, className: 'bg-teal-50 text-teal-600' },
  invoice_created: { icon: Receipt, className: 'bg-amber-50 text-amber-600' },
  payment_received: { icon: CreditCard, className: 'bg-green-50 text-green-600' },
  general: { icon: Bell, className: 'bg-gray-100 text-gray-500' },
};

/** "3h ago" / "2d ago" — relative age of an activity entry. */
const timeAgo = (createdAt) => {
  const diff = Date.now() - new Date(createdAt);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/** "main_branch" -> "Main". Anything unrecognised is left off. */
const branchLabel = (clinicLabel) => {
  if (clinicLabel === 'main_branch') return 'Main';
  if (clinicLabel === 'branch') return 'Branch';
  return '';
};

/** Shown for clinics that haven't uploaded a logo. */
const DEFAULT_CLINIC_IMAGE =
  'https://images.unsplash.com/photo-1629909615184-74f495363b67?w=80&h=80&fit=crop&auto=format';

/** ClinicTile — the clinic's logo, falling back to the default clinic image. */
const ClinicTile = ({ clinic, size = 'md' }) => {
  const box = size === 'md' ? 'w-11 h-11' : 'w-9 h-9';
  return (
    <div className={`${box} rounded-lg overflow-hidden flex-shrink-0 bg-white shadow-sm`}>
      <img
        src={clinic?.logo_url || DEFAULT_CLINIC_IMAGE}
        alt=""
        className="w-full h-full object-cover"
        // A dead logo URL falls back to the default rather than a broken image.
        onError={(e) => {
          if (e.currentTarget.src !== DEFAULT_CLINIC_IMAGE) e.currentTarget.src = DEFAULT_CLINIC_IMAGE;
        }}
      />
    </div>
  );
};

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
  const [showShortcuts, setShowShortcuts] = useState(false);

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
      '/vendors': 'Inventory',
      '/consent-forms': 'Consent Forms',
      '/lab': 'Laboratory',
      '/reports': 'Reports',
      '/marketing/reviews': 'Google Reviews',
      '/marketing/posters': 'Marketing Posters',
      '/admin': 'Control Center',
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
      '/user-management': 'Settings',
      '/doctor-profile': 'Profile Settings',
      '/subscription': 'Subscription & Billing',
      '/support': 'Support',
      '/support-tickets': 'Support Center',
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

  const userPhone = user?.phone || "";

  /**
   * The header's plan button: a title, a supporting line and a chevron on the
   * brand gradient. Every state links to /subscription.
   */
  const getPlanInfo = () => {
    const clinic = user?.clinic;
    const isPro = clinic?.subscription_plan === 'professional';
    const isTrial = !!clinic?.is_trial;

    if (isTrial) {
      const days = clinic.trial_days_remaining;
      return {
        title: 'Trial Plan',
        subtitle: typeof days === 'number' ? `${days} day${days === 1 ? '' : 's'} left` : 'Active',
      };
    }
    if (isPro) return { title: 'Professional Plan', subtitle: 'Manage your plan' };
    return { title: 'Starter Plan', subtitle: 'Upgrade your plan' };
  };
  const planInfo = getPlanInfo();

  // The search shortcut is ⌘K on Mac and Ctrl+K elsewhere (incl. the Windows desktop build).
  const isMac = typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  const searchHint = isMac ? '⌘K' : 'Ctrl K';

  const canSeeAdminHub = userRole === 'clinic_owner' || user?.permissions?.staff?.read === true;

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

  // The feed is shared across the clinic, so clearing empties it for every
  // colleague too — say so plainly rather than wiping on a single click.
  const handleClearNotifications = async () => {
    const ok = window.confirm(
      'Clear the activity feed?\n\n' +
      'This removes all entries for everyone in this clinic, not just you. It cannot be undone.'
    );
    if (!ok) return;
    setNotifLoading(true);
    try {
      await api.delete('/activity-log');
      setNotifications([]);
    } catch {
      // Refetch so the list reflects reality if the delete didn't land.
      fetchNotifications();
    } finally {
      setNotifLoading(false);
    }
  };

  // Global keyboard shortcuts, driven off the same registry the panel renders.
  useEffect(() => {
    const handler = (e) => {
      const match = ALL_SHORTCUTS.find((s) => matchesCombo(e, s.combo));
      if (!match) return;

      // Help works even mid-typing; the rest yield to text fields so Alt+S in a
      // notes box doesn't navigate away.
      if (match.id !== ACTION_HELP && isTypingTarget(e.target)) return;

      // Only claim the key once we know we'll act on it — a shortcut the user
      // lacks permission for should fall through to the browser untouched.
      if (match.path && !canAccess(user, match)) return;

      e.preventDefault();

      if (match.id === ACTION_HELP) { setShowShortcuts((v) => !v); return; }
      if (match.id === ACTION_SEARCH) { setShowSearch(true); return; }
      if (match.path) attemptNavigate(() => navigate(match.path));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [user, navigate, attemptNavigate]);

  // Esc closes the activity drawer, matching the shortcuts panel — and matching
  // what that drawer's footer tells the user.
  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e) => { if (e.key === 'Escape') setShowNotifications(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showNotifications]);

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

      {/* Keyboard shortcuts reference (opens from the header icon or F9) */}
      <ShortcutsDrawer open={showShortcuts} onClose={() => setShowShortcuts(false)} />

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

        {/* Clinic Switcher — on md+ the negative margin cancels the header's own
            left padding so the band sits flush against the sidebar, and the
            matching pl puts the content back where it was. */}
        <div className="relative">
          <button
            onClick={() => setShowClinicDropdown(!showClinicDropdown)}
            className="flex items-center gap-3 pl-2 pr-3 py-1.5 bg-[#f0f0fd] hover:bg-[#e4e3f9] transition-colors duration-200 md:-ml-6 md:h-14 md:py-0 md:pl-6"
            disabled={isSwitching}
            title="Switch Clinic"
          >
            {/* Clinic logo, or a branded initials tile */}
            <ClinicTile clinic={user?.clinic} size="md" />

            {/* Name + full address */}
            <div className="hidden md:flex flex-col items-start leading-tight min-w-0">
              {clinicHydrating ? (
                <>
                  <SkeletonBox className="h-4 w-28 mb-1" />
                  <SkeletonBox className="h-3 w-20" />
                </>
              ) : (
                <>
                  <span className="text-sm font-bold text-[#2a276e] truncate max-w-[180px]">
                    {user?.clinic?.name || "Select Clinic"}
                  </span>
                  <span className="text-xs text-gray-500 truncate max-w-[180px]">
                    {user?.clinic?.address || user?.clinic?.email || "Clinic"}
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
                      <ClinicTile clinic={clinic} size="sm" />
                      <div className="flex flex-col min-w-0">
                        <span className={`text-sm font-semibold truncate ${isActive ? 'text-[#2a276e]' : 'text-gray-800'}`}>
                          {clinic.name}
                          {branchLabel(clinic.clinic_label) && (
                            <span className="ml-1.5 text-xs font-medium text-gray-400">
                              {branchLabel(clinic.clinic_label)}
                            </span>
                          )}
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
              <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">{pageTitle}</h1>
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

      {/* Right side — quick actions stay in the header; the avatar collapses to
          just the cartoon and opens the account menu. */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Current plan — hidden on mobile, where it can't fit alongside the
            icons; the profile menu's "Subscription & billing" covers it there. */}
        <button
          onClick={() => gnav("/subscription")}
          className="hidden lg:flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg bg-gradient-to-r from-[#2a276e] to-[#5b57c4] hover:brightness-110 shadow-sm transition-all"
          title={`${planInfo.title} — ${planInfo.subtitle}`}
        >
          <span className="flex flex-col items-start leading-tight min-w-0">
            <span className="text-sm font-bold text-white whitespace-nowrap">{planInfo.title}</span>
            <span className="text-xs text-white/75 whitespace-nowrap">{planInfo.subtitle}</span>
          </span>
          <ChevronRight size={16} className="text-white/80 flex-shrink-0" />
        </button>

        <div className="hidden lg:block w-px h-6 bg-gray-200 mx-1"></div>

        {/* Search */}
        <button
          onClick={() => setShowSearch(true)}
          className={ICON_BUTTON}
          title={`Search patients (${searchHint})`}
          aria-label="Search patients"
        >
          <Search size={20} className="sm:w-[22px] sm:h-[22px]" />
        </button>

        {/* Keyboard shortcuts — pointless without a physical keyboard, so it
            doesn't earn space on mobile. */}
        <button
          onClick={() => setShowShortcuts(true)}
          className={`${ICON_BUTTON} hidden sm:flex`}
          title="Keyboard shortcuts (F9)"
          aria-label="Keyboard shortcuts"
        >
          <Keyboard size={22} />
        </button>

        {/* Activity feed */}
        <button
          onClick={() => { setShowNotifications(true); fetchNotifications(); }}
          className={`${ICON_BUTTON} relative`}
          title="Activity Feed"
          aria-label={notifications.length > 0 ? `Activity feed, ${notifications.length} unread` : 'Activity feed'}
        >
          <Bell size={20} className="sm:w-[22px] sm:h-[22px]" />
          {notifications.length > 0 && (
            <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center border border-white">
              {notifications.length > 99 ? '99+' : notifications.length}
            </span>
          )}
        </button>

        <div className="w-px h-6 bg-gray-200 hidden md:block mx-1"></div>

        {/* User — cartoon only */}
        <div className="relative">
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="relative rounded-full p-0.5 hover:ring-2 hover:ring-[#2a276e]/20 transition-all"
            title={userName}
            aria-label="Open profile menu"
            aria-haspopup="menu"
            aria-expanded={showProfileDropdown}
          >
            <img
              src={userAvatar}
              alt=""
              className="w-9 h-9 rounded-full border border-gray-300 bg-white"
            />
          </button>

          {/* Profile menu */}
          {showProfileDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowProfileDropdown(false)}
              ></div>
              <div
                role="menu"
                className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-gray-200 z-20 overflow-hidden"
              >
                {/* Identity card */}
                <div className="flex items-center gap-3 p-4 bg-[#f0f0fd] border-b border-gray-200">
                  <img
                    src={userAvatar}
                    alt=""
                    className="w-14 h-14 rounded-full border border-[#c5c2f0] bg-white flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-gray-900 truncate">{userName}</p>
                      {/* Decorative only — there is no verification data behind this.
                          Don't treat it as a signal that anything was verified. */}
                      <BadgeCheck size={15} className="text-white fill-[#00ba7c] flex-shrink-0" />
                    </div>
                    {userPhone && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{userPhone}</p>
                    )}
                    {userEmail && (
                      <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                    )}
                    <span
                      className={`inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-white border border-[#c5c2f0] ${roleInfo.color}`}
                    >
                      {roleInfo.label}
                    </span>
                  </div>
                </div>

                <MenuLabel>Profile actions</MenuLabel>
                <MenuRow
                  icon={UserRound}
                  label="Profile settings"
                  onClick={() => { setShowProfileDropdown(false); gnav("/doctor-profile"); }}
                />
                {canSeeAdminHub && (
                  <MenuRow
                    icon={Settings}
                    label="Control Center"
                    onClick={() => { setShowProfileDropdown(false); gnav("/admin"); }}
                  />
                )}
                <MenuRow
                  icon={CreditCard}
                  label="Subscription & billing"
                  onClick={() => { setShowProfileDropdown(false); gnav("/subscription"); }}
                />
                <MenuRow
                  icon={LifeBuoy}
                  label="Support Center"
                  onClick={() => { setShowProfileDropdown(false); gnav("/support-tickets"); }}
                />

                <div className="border-t border-gray-200 mt-1"></div>

                <MenuRow
                  icon={LogOut}
                  label="Sign out"
                  danger
                  onClick={handleSignOut}
                />

                {/* Version */}
                <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200">
                  <p className="text-xs text-gray-400 text-center">
                    Current Version: {__APP_VERSION__}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notification Activity Drawer */}
      {showNotifications && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[60]" onClick={() => setShowNotifications(false)} />
          <div className="fixed inset-y-0 right-0 w-[420px] max-w-full bg-white shadow-2xl z-[70] flex flex-col">
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-gray-900">Activity Feed</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {notifications.length > 0
                    ? `Latest ${notifications.length} ${notifications.length === 1 ? 'activity' : 'activities'}`
                    : 'Everything happening in your clinic'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={fetchNotifications}
                  disabled={notifLoading}
                  className="p-2 rounded-lg text-gray-400 hover:text-[#2a276e] hover:bg-gray-50 transition-colors disabled:opacity-50"
                  title="Refresh"
                  aria-label="Refresh activity"
                >
                  <FaSync className={`w-3.5 h-3.5 ${notifLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                  aria-label="Close activity feed"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {notifLoading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-[#2a276e] rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">Loading…</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 px-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#2a276e]/5 flex items-center justify-center">
                    <Bell size={22} className="text-[#2a276e]/40" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">No activity yet</p>
                  <p className="text-xs text-gray-400">
                    Adding patients, saving prescriptions and creating invoices will show up here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {notifications.map((n) => {
                    const meta = ACTIVITY_ICONS[n.event_type] || ACTIVITY_ICONS.general;
                    const Icon = meta.icon;
                    return (
                      <li
                        key={n.id}
                        className={`px-6 py-4 transition-colors ${n.link ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                        onClick={() => n.link && gnav(n.link)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${meta.className}`}>
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-800 leading-snug">{n.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {n.actor_name && (
                                <span className="text-xs font-medium text-[#2a276e]">{n.actor_name}</span>
                              )}
                              {n.actor_name && <span className="text-xs text-gray-300">•</span>}
                              <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                            </div>
                          </div>
                          {n.link && <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-1" />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-400">Press Esc to close</p>
              {/* Owner-only: the backend rejects anyone else, so don't offer it. */}
              {userRole === 'clinic_owner' && notifications.length > 0 && (
                <button
                  onClick={handleClearNotifications}
                  disabled={notifLoading}
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 size={13} />
                  Clear all
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
};

export default Header;
