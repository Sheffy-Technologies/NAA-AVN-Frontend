import React from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/shared/hooks/redux";

type RequireRoleProps = {
  children: React.ReactElement;
  /**
   * At least one of these Spatie permission names must be present in the
   * authenticated user's permissions array for access to be granted.
   */
  requiredPermissions: string[];
};

export const RequireRole = ({ children, requiredPermissions }: RequireRoleProps) => {
  const permissions = useAppSelector(
    (state) => state.auth.user?.permissions ?? [],
  );

  const hasAccess = requiredPermissions.some((p) => permissions.includes(p));

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
