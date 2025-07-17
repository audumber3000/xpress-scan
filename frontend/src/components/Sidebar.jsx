import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const navItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /></svg>
    ),
  },
  {
    name: "Patients",
    path: "/patients",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 3.13a4 4 0 010 7.75M8 3.13a4 4 0 000 7.75" /></svg>
    ),
  },
  {
    name: "Reports",
    path: "/reports",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 17v-2a4 4 0 014-4h4m-6 4v2m0 0v2m0-2h2m-2 0H7" /></svg>
    ),
  },
  {
    name: "Voice Reporting",
    path: "/voice-reporting",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 18c2.21 0 4-1.79 4-4V7a4 4 0 10-8 0v7c0 2.21 1.79 4 4 4zm6-4v-1a6 6 0 00-12 0v1a6 6 0 0012 0zm-6 7a7 7 0 007-7h-2a5 5 0 01-10 0H5a7 7 0 007 7z" /></svg>
    ),
  },
];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    getUser();
    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const linkClass = (path) =>
    `flex items-center gap-3 py-2 px-4 rounded-lg transition font-medium text-gray-700 whitespace-nowrap ${location.pathname === path ? "bg-green-100 text-green-700 border border-green-500" : "hover:bg-green-50"}`;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // Get user info
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "";
  const userAvatar = user?.user_metadata?.avatar_url || "https://randomuser.me/api/portraits/men/32.jpg";

  return (
    <aside className="flex flex-col h-screen w-72 bg-white border-r border-gray-200 p-4">
      {/* Branding */}
      <div className="flex items-center gap-3 h-16 mb-4">
        <span className="bg-green-100 text-green-600 rounded-full p-2">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
        </span>
        <span className="text-2xl font-bold text-gray-900">Medisight</span>
      </div>
      {/* Main Nav */}
      <nav className="flex flex-col gap-1 mb-6">
        {navItems.map((item) => (
          <Link key={item.name} to={item.path} className={linkClass(item.path)}>
            {item.icon}
            {item.name}
          </Link>
        ))}
      </nav>
      {/* User Profile & Sign Out */}
      <div className="mt-auto flex flex-col gap-2">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
          <img src={userAvatar} alt="User" className="w-10 h-10 rounded-full" />
          <div>
            <div className="font-semibold text-gray-900 text-sm">{userName}</div>
            <div className="text-xs text-gray-500 truncate max-w-[140px]" title={userEmail}>{userEmail}</div>
          </div>
        </div>
        <button onClick={handleSignOut} className="w-full py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-semibold transition text-sm">Sign Out</button>
      </div>
    </aside>
  );
};

export default Sidebar; 