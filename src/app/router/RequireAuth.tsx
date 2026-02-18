import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "@/shared/hooks/redux";

type RequireAuthProps = {
  children: React.ReactElement;
};

export const RequireAuth = ({ children }: RequireAuthProps) => {
  const location = useLocation();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{ from: location }}
      />
    );
  }

  return children;
};

