import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Ticket, LogOut, Menu,
  IndianRupee, CreditCard, Activity, Bell, TrendingUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SectionLabel } from '../components/ui';

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/overview', icon: LayoutDashboard, label: 'Overview' },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/clinics', icon: Building2, label: 'Clinics' },
      { to: '/growth', icon: TrendingUp, label: 'Growth' },
      { to: '/financials', icon: IndianRupee, label: 'Financials' },
      { to: '/subscriptions', icon: CreditCard, label: 'Subscriptions' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/activity', icon: Activity, label: 'Activity' },
      { to: '/notifications-data', icon: Bell, label: 'Notifications' },
    ],
  },
  {
    label: 'Support',
    items: [
      { to: '/tickets', icon: Ticket, label: 'Tickets' },
    ],
  },
];

function NavItem({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `group flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all ${
          isActive
            ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 shadow-sm'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
        }`
      }
    >
      <Icon size={16} strokeWidth={1.8} />
      <span className="flex-1">{label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-slate-200/80 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
          <span className="text-white text-xs font-black tracking-tight">M+</span>
        </div>
        <div className="leading-none">
          <span className="text-sm font-bold text-slate-900 tracking-tight">MolarPlus</span>
          <span className="block text-[10px] font-medium text-slate-400 -mt-0.5">Admin Console</span>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label ? (
              <SectionLabel>{group.label}</SectionLabel>
            ) : (
              <div className="pt-3" />
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavItem key={item.to} {...item} onClick={() => setMobileOpen(false)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="flex-shrink-0 border-t border-slate-200/80 p-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center">
            <span className="text-brand-700 text-[11px] font-bold">{user?.name?.[0]?.toUpperCase() || 'A'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={15} strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] border-r border-slate-200/80 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 flex flex-col w-[220px] shadow-xl h-full">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 h-14 px-4 bg-white border-b border-slate-200/80">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100">
            <Menu size={18} />
          </button>
          <div className="w-6 h-6 rounded bg-brand-600 flex items-center justify-center">
            <span className="text-white text-[9px] font-black">M+</span>
          </div>
          <span className="text-sm font-semibold text-slate-800">MolarPlus</span>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
