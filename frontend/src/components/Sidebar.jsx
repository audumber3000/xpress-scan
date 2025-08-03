import React, { useState } from "react";
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

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const linkClass = (path) =>
    `flex items-center gap-3 py-2 px-4 rounded-lg transition font-medium text-gray-700 whitespace-nowrap ${location.pathname === path ? "bg-green-100 text-green-700 border border-green-500" : "hover:bg-green-50"}`;

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

  return (
    <aside className="flex flex-col h-screen w-72 bg-white border-r border-gray-200 p-4">
      {/* Branding */}
      <div className="flex items-center gap-3 h-16 mb-4">
        <span className="bg-green-100 text-green-600 rounded-full p-2">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
        </span>
        <div className="flex flex-col">
          <span className="text-3xl font-extrabold text-black tracking-tight" style={{ fontFamily: 'serif', letterSpacing: '-0.03em' }}>
            Dhanvantri
          </span>
          <span className="text-sm font-medium text-gray-600 tracking-wide">
            Radiology Center
          </span>
        </div>
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
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 cursor-pointer hover:bg-green-50 transition" onClick={() => navigate("/doctor-profile")}>
          <img src={userAvatar} alt="User" className="w-10 h-10 rounded-full" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 text-sm">{userName}</div>
            <div className="text-xs text-gray-500 truncate max-w-[140px]" title={userEmail}>{userEmail}</div>
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${roleInfo.color} mt-1`}>
              <span className="text-gray-600">Role:</span>
              {roleInfo.icon}
              {roleInfo.label}
            </div>
          </div>
        </div>
        <button onClick={handleSignOut} className="w-full py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-semibold transition text-sm">Sign Out</button>
      </div>
    </aside>
  );
};

export default Sidebar; 