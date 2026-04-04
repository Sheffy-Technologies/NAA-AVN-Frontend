import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { useAppUpdater } from "@/shared/hooks/useAppUpdater";

export const DashboardLayout = () => {
  useAppUpdater();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#00090D] overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="w-64 h-full bg-[#00090D] border-r border-[#0A4D66]/30 shadow-xl flex">
            <Sidebar />
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="flex-1 bg-black/50"
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#0A4D66] scrollbar-track-transparent">
          <div
            className="min-h-full p-6"
            style={{ background: "var(--auth-bg-gradient)" }}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
