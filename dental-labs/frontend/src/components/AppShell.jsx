import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppShell() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[#f8f9fa] relative w-full overflow-hidden">
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onCollapseChange={setIsSidebarCollapsed}
      />
      
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-screen">
        <Header onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
