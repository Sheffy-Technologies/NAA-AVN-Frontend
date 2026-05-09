import { Outlet } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";

export const AuthLayout = () => {
  const { isDark } = useTheme();
  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-4 ${isDark ? "bg-auth-gradient" : "bg-gray-100"}`}>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
};
