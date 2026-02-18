import { Outlet } from "react-router-dom";

export const AuthLayout = () => {
  return (
    <div className="min-h-screen w-full bg-auth-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
};
