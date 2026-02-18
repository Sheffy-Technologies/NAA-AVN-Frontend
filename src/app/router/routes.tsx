import { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AuthLayout } from "@/app/layout/AuthLayout";
import { RouteErrorBoundary } from "@/app/router/RouteErrorBoundary";
import { RequireAuth } from "@/app/router/RequireAuth";

// Auth Pages
const LoginPage = lazy(() =>
  import("@/features/auth/pages/LoginPage").then((module) => ({
    default: module.LoginPage,
  })),
);
const RegisterPage = lazy(() =>
  import("@/features/auth/pages/RegisterPage").then((module) => ({
    default: module.RegisterPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("@/features/auth/pages/ForgotPasswordPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);

// Dashboard Pages
const DashboardLayout = lazy(() =>
  import("@/app/layout/DashboardLayout").then((module) => ({
    default: module.DashboardLayout,
  })),
);
const DashboardPage = lazy(() =>
  import("@/features/dashboard/pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const InventoryPage = lazy(() =>
  import("@/features/inventory/pages/InventoryPage").then((module) => ({
    default: module.InventoryPage,
  })),
);
const InventoryFormPage = lazy(() =>
  import("@/features/inventory/pages/InventoryFormPage").then((module) => ({
    default: module.InventoryFormPage,
  })),
);
const InventoryInfoPage = lazy(() =>
  import("@/features/inventory/pages/InventoryInfoPage").then((module) => ({
    default: module.InventoryInfoPage,
  })),
);
const FinancePage = lazy(() =>
  import("@/features/finance/pages/FinancePage").then((module) => ({
    default: module.FinancePage,
  })),
);
const FinanceFormPage = lazy(() =>
  import("@/features/finance/pages/FinanceFormPage").then((module) => ({
    default: module.FinanceFormPage,
  })),
);
const BudgetFormPage = lazy(() =>
  import("@/features/finance/pages/BudgetFormPage").then((module) => ({
    default: module.BudgetFormPage,
  })),
);
const BudgetInfoPage = lazy(() =>
  import("@/features/finance/pages/BudgetInfoPage").then((module) => ({
    default: module.BudgetInfoPage,
  })),
);
const UnitsPage = lazy(() =>
  import("@/features/units/pages/UnitsPage").then((module) => ({
    default: module.UnitsPage,
  })),
);
const UnitFormPage = lazy(() =>
  import("@/features/units/pages/UnitFormPage").then((module) => ({
    default: module.UnitFormPage,
  })),
);
const FlightProgrammePage = lazy(() =>
  import("@/features/flight-programme/pages/FlightProgrammePage").then(
    (module) => ({
      default: module.FlightProgrammePage,
    }),
  ),
);
const PersonnelPage = lazy(() =>
  import("@/features/personnel/pages/PersonnelPage").then((module) => ({
    default: module.PersonnelPage,
  })),
);
const PersonnelDetailPage = lazy(() =>
  import("@/features/personnel/pages/PersonnelDetailPage").then((module) => ({
    default: module.PersonnelDetailPage,
  })),
);
const ComingSoonPage = lazy(() =>
  import("@/features/dashboard/pages/ComingSoonPage").then((module) => ({
    default: module.ComingSoonPage,
  })),
);

const loadingElement = (
  <div className="h-screen w-full flex items-center justify-center bg-[#00090D] text-primary-med">
    <div className="animate-spin h-8 w-8 border-2 border-primary-med border-t-transparent rounded-full" />
  </div>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/auth/login" replace />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/auth",
    element: <AuthLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: "login",
        element: (
          <Suspense fallback={loadingElement}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: "register",
        element: (
          <Suspense fallback={loadingElement}>
            <RegisterPage />
          </Suspense>
        ),
      },
      {
        path: "forgot-password",
        element: (
          <Suspense fallback={loadingElement}>
            <ForgotPasswordPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: "/dashboard",
    element: (
      <RequireAuth>
        <Suspense fallback={loadingElement}>
          <DashboardLayout />
        </Suspense>
      </RequireAuth>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={loadingElement}>
            <DashboardPage />
          </Suspense>
        ),
      },
      {
        path: "units",
        element: (
          <Suspense fallback={loadingElement}>
            <UnitsPage />
          </Suspense>
        ),
      },
      {
        path: "units/add",
        element: (
          <Suspense fallback={loadingElement}>
            <UnitFormPage />
          </Suspense>
        ),
      },
      {
        path: "personnel",
        element: (
          <Suspense fallback={loadingElement}>
            <PersonnelPage />
          </Suspense>
        ),
      },
      {
        path: "personnel/:id",
        element: (
          <Suspense fallback={loadingElement}>
            <PersonnelDetailPage />
          </Suspense>
        ),
      },
      {
        path: "inventory",
        element: (
          <Suspense fallback={loadingElement}>
            <InventoryPage />
          </Suspense>
        ),
      },
      {
        path: "inventory/add",
        element: (
          <Suspense fallback={loadingElement}>
            <InventoryFormPage />
          </Suspense>
        ),
      },
      {
        path: "inventory/:id/edit",
        element: (
          <Suspense fallback={loadingElement}>
            <InventoryFormPage />
          </Suspense>
        ),
      },
      {
        path: "inventory/:id",
        element: (
          <Suspense fallback={loadingElement}>
            <InventoryInfoPage />
          </Suspense>
        ),
      },
      {
        path: "finance",
        element: (
          <Suspense fallback={loadingElement}>
            <FinancePage />
          </Suspense>
        ),
      },
      {
        path: "finance/add",
        element: (
          <Suspense fallback={loadingElement}>
            <FinanceFormPage />
          </Suspense>
        ),
      },
      {
        path: "finance/budgets/add",
        element: (
          <Suspense fallback={loadingElement}>
            <BudgetFormPage />
          </Suspense>
        ),
      },
      {
        path: "finance/budgets/:id",
        element: (
          <Suspense fallback={loadingElement}>
            <BudgetInfoPage />
          </Suspense>
        ),
      },
      {
        path: "flight-programme",
        element: (
          <Suspense fallback={loadingElement}>
            <FlightProgrammePage />
          </Suspense>
        ),
      },
      {
        path: "*",
        element: (
          <Suspense fallback={loadingElement}>
            <ComingSoonPage />
          </Suspense>
        ),
      },
    ],
  },
]);
