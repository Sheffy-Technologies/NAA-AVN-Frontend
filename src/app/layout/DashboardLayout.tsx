import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { useAppUpdater } from "@/shared/hooks/useAppUpdater";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { setCredentials } from "@/features/auth/authSlice";
import { useGetMeQuery } from "@/features/security/api";

export const DashboardLayout = () => {
  useAppUpdater();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);

  const { data: me } = useGetMeQuery(undefined, { skip: !token });

  useEffect(() => {
    if (me && token) {
      dispatch(
        setCredentials({
          token,
          user: {
            id: String(me.id),
            email: me.email ?? "",
            name: [me.firstname, me.lastname].filter(Boolean).join(" "),
            firstname: me.firstname ?? undefined,
            lastname: me.lastname ?? undefined,
            username: me.username ?? undefined,
            roles: me.roles,
            role_names: me.role_names,
            permissions: me.permissions,
          },
        }),
      );
    }
  }, [me, token, dispatch]);

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
