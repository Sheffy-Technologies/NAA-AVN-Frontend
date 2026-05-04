import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { useAppUpdater } from "@/shared/hooks/useAppUpdater";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { setCredentials } from "@/features/auth/authSlice";
import { useGetMeQuery } from "@/features/security/api";
import { ComposeMessageModal } from "@/features/messages/components/ComposeMessageModal";
import { openCompose } from "@/features/messages/composeSlice";
import { useTheme } from "@/context/ThemeContext";

export const DashboardLayout = () => {
  useAppUpdater();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const location = useLocation();
  const userPermissions = useAppSelector(
    (state) => state.auth.user?.permissions ?? [],
  );
  const { isDark } = useTheme();
  const canCreateMessages = userPermissions.includes("messages.create");
  const isMessagesRoute = location.pathname.startsWith("/dashboard/messages");
  const showComposeFab = canCreateMessages && !isMessagesRoute;

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
    <div className={`flex h-screen overflow-hidden ${isDark ? "bg-[#001219]" : "bg-gray-100"}`}>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className={`w-64 h-full shadow-xl flex ${isDark ? "bg-[#001219] border-r border-[#0A4D66]/30" : "bg-white border-r border-gray-200"}`}>
            <Sidebar />
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="flex-1 bg-black/50"
            aria-label="Close sidebar"
            title="Close sidebar"
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto main-content-bg">
          <div className="min-h-full p-6">
            <Outlet />
          </div>
        </main>
      </div>

      <ComposeMessageModal />

      {showComposeFab && (
        <button
          type="button"
          onClick={() => dispatch(openCompose())}
          title="New message"
          aria-label="New message"
          className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#128C7E] text-white shadow-[0_15px_40px_rgba(0,0,0,0.45)] transition-colors hover:bg-[#20a193]"
        >
          <Icon icon="mdi:message-plus-outline" className="h-6 w-6" />
        </button>
      )}
    </div>
  );
};
