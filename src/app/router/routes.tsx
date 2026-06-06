import { Suspense, lazy, type ReactElement } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AuthLayout } from "@/app/layout/AuthLayout";
import { RouteErrorBoundary } from "@/app/router/RouteErrorBoundary";
import { RequireAuth } from "@/app/router/RequireAuth";
import { RequireRole } from "@/app/router/RequireRole";

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
const VerifyOtpPage = lazy(() =>
  import("@/features/auth/pages/VerifyOtpPage").then((module) => ({
    default: module.VerifyOtpPage,
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
const InventoryRequisitionFormPage = lazy(() =>
  import("@/features/inventory/pages/InventoryRequisitionFormPage").then(
    (module) => ({
      default: module.InventoryRequisitionFormPage,
    }),
  ),
);
const InventoryRequisitionDetailsPage = lazy(() =>
  import("@/features/inventory/pages/InventoryRequisitionDetailsPage").then(
    (module) => ({
      default: module.InventoryRequisitionDetailsPage,
    }),
  ),
);
const InventoryInfoPage = lazy(() =>
  import("@/features/inventory/pages/InventoryInfoPage").then((module) => ({
    default: module.InventoryInfoPage,
  })),
);
const PurchaseOrdersPage = lazy(() =>
  import("@/features/inventory/pages/PurchaseOrdersPage").then((module) => ({
    default: module.default,
  })),
);
const PurchaseOrderFormPage = lazy(() =>
  import("@/features/inventory/pages/PurchaseOrderFormPage").then((module) => ({
    default: module.default,
  })),
);
const PurchaseOrderDetailsPage = lazy(() =>
  import("@/features/inventory/pages/PurchaseOrderDetailsPage").then(
    (module) => ({
      default: module.default,
    }),
  ),
);
const ProcurementLifecyclePage = lazy(() =>
  import("@/features/inventory/pages/ProcurementLifecyclePage").then(
    (module) => ({
      default: module.ProcurementLifecyclePage,
    }),
  ),
);
const RfqDetailsPage = lazy(() =>
  import("@/features/inventory/pages/RfqDetailsPage").then((module) => ({
    default: module.RfqDetailsPage,
  })),
);
const AddSupplierPage = lazy(() =>
  import("../../features/inventory/pages/AddSupplierPage").then((module) => ({
    default: module.AddSupplierPage,
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
const BudgetStatementPage = lazy(() =>
  import("@/features/finance/pages/BudgetStatementPage").then((module) => ({
    default: module.BudgetStatementPage,
  })),
);
const DocumentsPage = lazy(() =>
  import("@/features/documents/pages/DocumentsPage").then((module) => ({
    default: module.DocumentsPage,
  })),
);
const ReportsPage = lazy(() =>
  import("@/features/reports/pages/ReportsPage").then((module) => ({
    default: module.ReportsPage,
  })),
);
const UnitsPage = lazy(() =>
  import("@/features/units/pages/UnitsPage").then((module) => ({
    default: module.UnitsPage,
  })),
);
const AssetsPage = lazy(() =>
  import("@/features/assets/pages/AssetsPage").then((module) => ({
    default: module.AssetsPage,
  })),
);
const AddAssetPage = lazy(() =>
  import("@/features/assets/pages/AddAssetPage").then((module) => ({
    default: module.AddAssetPage,
  })),
);
const AddVehiclePage = lazy(() =>
  import("@/features/assets/pages/AddVehiclePage").then((module) => ({
    default: module.AddVehiclePage,
  })),
);
const EditVehiclePage = lazy(() =>
  import("@/features/assets/pages/EditVehiclePage").then((module) => ({
    default: module.EditVehiclePage,
  })),
);
const AddFacilityPage = lazy(() =>
  import("@/features/assets/pages/AddFacilityPage").then((module) => ({
    default: module.AddFacilityPage,
  })),
);
const AssetDetailsPage = lazy(() =>
  import("@/features/assets/pages/AssetDetailsPage").then((module) => ({
    default: module.AssetDetailsPage,
  })),
);
const AddAssetDefectPage = lazy(() =>
  import("@/features/assets/pages/AddAssetDefectPage").then((module) => ({
    default: module.AddAssetDefectPage,
  })),
);
const AddAfterActionReportPage = lazy(() =>
  import("@/features/assets/pages/AddAfterActionReportPage").then((module) => ({
    default: module.AddAfterActionReportPage,
  })),
);
const UnitFormPage = lazy(() =>
  import("@/features/units/pages/UnitFormPage").then((module) => ({
    default: module.UnitFormPage,
  })),
);
const UnitsDetailsPage = lazy(() =>
  import("@/features/units/pages/UnitsDetailsPage").then((module) => ({
    default: module.UnitsDetailsPage,
  })),
);
const FlightProgrammePage = lazy(() =>
  import("@/features/flight-programme/pages/FlightProgrammePage").then(
    (module) => ({
      default: module.FlightProgrammePage,
    }),
  ),
);
const OperationsPage = lazy(() =>
  import("@/features/operations/pages/OperationsPage").then((module) => ({
    default: module.OperationsPage,
  })),
);
const AddOperationPage = lazy(() =>
  import("@/features/operations/pages/AddOperationPage").then((module) => ({
    default: module.AddOperationPage,
  })),
);
const OperationDetailsPage = lazy(() =>
  import("@/features/operations/pages/OperationDetailsPage").then((module) => ({
    default: module.OperationDetailsPage,
  })),
);
const AddAfterActionReportPageOperation = lazy(() =>
  import("@/features/operations/pages/AddAfterActionReportPage").then((module) => ({
    default: module.AddAfterActionReportPage,
  })),
);
const EditOperationPage = lazy(() =>
  import("@/features/operations/pages/EditOperationPage").then((module) => ({
    default: module.EditOperationPage,
  })),
);
const PersonnelPage = lazy(() =>
  import("@/features/personnel/pages/PersonnelPage").then((module) => ({
    default: module.PersonnelPage,
  })),
);
const AddPersonnelPage = lazy(() =>
  import("@/features/personnel/pages/AddPersonnelPage").then((module) => ({
    default: module.AddPersonnelPage,
  })),
);
const PersonnelDetailPage = lazy(() =>
  import("@/features/personnel/pages/PersonnelDetailPage").then((module) => ({
    default: module.PersonnelDetailPage,
  })),
);
const EditPersonnelPage = lazy(() =>
  import("@/features/personnel/pages/EditPersonnelPage").then((module) => ({
    default: module.EditPersonnelPage,
  })),
);
const ComingSoonPage = lazy(() =>
  import("@/features/dashboard/pages/ComingSoonPage").then((module) => ({
    default: module.ComingSoonPage,
  })),
);
const SecurityPage = lazy(() =>
  import("@/features/security/pages/SecurityPage").then((module) => ({
    default: module.SecurityPage,
  })),
);
const MaintenancePage = lazy(() =>
  import("@/features/maintenance/pages/MaintenancePage").then((module) => ({
    default: module.MaintenancePage,
  })),
);
const MaintenanceProgramsCrudPage = lazy(() =>
  import("@/features/maintenance/pages/MaintenanceProgramsCrudPage").then(
    (module) => ({
      default: module.MaintenanceProgramsCrudPage,
    }),
  ),
);
const WorkOrderDetailsPage = lazy(() =>
  import("@/features/maintenance/pages/WorkOrderDetailsPage").then((module) => ({
    default: module.WorkOrderDetailsPage,
  })),
);
const UserDetailsPage = lazy(() =>
  import("@/features/users/pages/UserDetailsPage").then((module) => ({
    default: module.UserDetailsPage,
  })),
);
const AddUserPage = lazy(() =>
  import("@/features/users/pages/AddUserPage").then((module) => ({
    default: module.AddUserPage,
  })),
);
const MessagesPage = lazy(() =>
  import("@/features/messages/pages/MessagesPage").then((module) => ({
    default: module.MessagesPage,
  })),
);

const loadingElement = (
  <div className="h-screen w-full flex items-center justify-center bg-[#001219] text-primary-med">
    <div className="animate-spin h-8 w-8 border-2 border-primary-med border-t-transparent rounded-full" />
  </div>
);

const UNITS_ROUTE_PERMISSIONS = ["units.viewAny"];
const ASSETS_ROUTE_PERMISSIONS = ["assets.viewAny", "dashboard.home.view"];
const OPERATIONS_ROUTE_PERMISSIONS = ["dashboard.operations.view", "operations.viewAny"];
const PERSONNEL_ROUTE_PERMISSIONS = ["dashboard.personnel.view", "personnel.viewAny"];
const INVENTORY_ROUTE_PERMISSIONS = ["dashboard.inventories.view", "inventories.viewAny"];
const MESSAGES_ROUTE_PERMISSIONS: string[] = [];
const FINANCE_ROUTE_PERMISSIONS = ["dashboard.finance.view", "expenses.viewAny", "budgets.viewAny"];
const SECURITY_ROUTE_PERMISSIONS = ["roles.viewAny", "permissions.viewAny", "devices.viewAny", "activity-logs.viewAny"];
const REPORTS_ROUTE_PERMISSIONS = ["reports.resources.view", "reports.query"];
const DOCUMENTS_ROUTE_PERMISSIONS = ["documents.viewAny"];
const MAINTENANCE_ROUTE_PERMISSIONS = ["dashboard.maintenance.view", "work-orders.viewAny", "maintenance-programs.viewAny"];

const guardWithPermissions = (
  element: ReactElement,
  requiredPermissions: string[],
) => (
  <RequireRole requiredPermissions={requiredPermissions}>{element}</RequireRole>
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
      {
        path: "verify-otp",
        element: (
          <Suspense fallback={loadingElement}>
            <VerifyOtpPage />
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
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <UnitsPage />
          </Suspense>
        ), UNITS_ROUTE_PERMISSIONS),
      },
      {
        path: "units/add",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <UnitFormPage />
          </Suspense>
        ), UNITS_ROUTE_PERMISSIONS),
      },
      {
        path: "units/:id",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <UnitsDetailsPage />
          </Suspense>
        ), UNITS_ROUTE_PERMISSIONS),
      },
      {
        path: "units/:id/edit",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <UnitFormPage />
          </Suspense>
        ), UNITS_ROUTE_PERMISSIONS),
      },
      {
        path: "assets",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <AssetsPage />
          </Suspense>
        ), ASSETS_ROUTE_PERMISSIONS),
      },
      {
        path: "assets/add",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <AddAssetPage />
          </Suspense>
        ), ASSETS_ROUTE_PERMISSIONS),
      },
      {
        path: "assets/vehicles/add",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <AddVehiclePage />
          </Suspense>
        ), ASSETS_ROUTE_PERMISSIONS),
      },
      {
        path: "assets/vehicles/:id/edit",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <EditVehiclePage />
          </Suspense>
        ), ASSETS_ROUTE_PERMISSIONS),
      },
      {
        path: "assets/facilities/add",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <AddFacilityPage />
          </Suspense>
        ), ASSETS_ROUTE_PERMISSIONS),
      },
      {
        path: "assets/:id",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <AssetDetailsPage />
          </Suspense>
        ), ASSETS_ROUTE_PERMISSIONS),
      },
      {
        path: "assets/:id/defects/add",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <AddAssetDefectPage />
          </Suspense>
        ), ASSETS_ROUTE_PERMISSIONS),
      },
      {
        path: "assets/:id/operations/:operationId/after-action-report",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <AddAfterActionReportPage />
          </Suspense>
        ), ASSETS_ROUTE_PERMISSIONS),
      },
      {
        path: "assets/:id/edit",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <AddAssetPage />
          </Suspense>
        ), ASSETS_ROUTE_PERMISSIONS),
      },
      {
        path: "personnel",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <PersonnelPage />
          </Suspense>
        ), PERSONNEL_ROUTE_PERMISSIONS),
      },
      {
        path: "personnel/add",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <AddPersonnelPage />
          </Suspense>
        ), PERSONNEL_ROUTE_PERMISSIONS),
      },
      {
        path: "personnel/:id",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <PersonnelDetailPage />
          </Suspense>
        ), PERSONNEL_ROUTE_PERMISSIONS),
      },
      {
        path: "personnel/:id/edit",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <EditPersonnelPage />
          </Suspense>
        ), PERSONNEL_ROUTE_PERMISSIONS),
      },
      {
        path: "inventory",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <InventoryPage />
          </Suspense>
        ), INVENTORY_ROUTE_PERMISSIONS),
      },
      {
        path: "inventory/add",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <InventoryFormPage />
          </Suspense>
        ), INVENTORY_ROUTE_PERMISSIONS),
      },
      {
        path: "inventory/requisitions/add",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <InventoryRequisitionFormPage />
          </Suspense>
        ), INVENTORY_ROUTE_PERMISSIONS),
      },
      {
        path: "inventory/requisitions/:id",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <InventoryRequisitionDetailsPage />
          </Suspense>
        ), INVENTORY_ROUTE_PERMISSIONS),
      },
      {
        path: "inventory/purchase-orders",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <PurchaseOrdersPage />
          </Suspense>
        ), INVENTORY_ROUTE_PERMISSIONS),
      },
      {
        path: "inventory/purchase-orders/new",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <PurchaseOrderFormPage />
          </Suspense>
        ), INVENTORY_ROUTE_PERMISSIONS),
      },
      {
        path: "inventory/purchase-orders/:id",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <PurchaseOrderDetailsPage />
          </Suspense>
        ), INVENTORY_ROUTE_PERMISSIONS),
      },
      {
        path: "inventory/rfq/:id",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <RfqDetailsPage />
          </Suspense>
        ), INVENTORY_ROUTE_PERMISSIONS),
      },
      {
        path: "inventory/procurement-lifecycle",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <ProcurementLifecyclePage />
          </Suspense>
        ), INVENTORY_ROUTE_PERMISSIONS),
      },
      {
        path: "inventory/suppliers/add",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <AddSupplierPage />
          </Suspense>
        ), INVENTORY_ROUTE_PERMISSIONS),
      },
      {
        path: "inventory/:id/edit",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <InventoryFormPage />
          </Suspense>
        ), INVENTORY_ROUTE_PERMISSIONS),
      },
      {
        path: "inventory/:id",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <InventoryInfoPage />
          </Suspense>
        ), INVENTORY_ROUTE_PERMISSIONS),
      },
      {
        path: "finance",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <FinancePage />
          </Suspense>
        ), FINANCE_ROUTE_PERMISSIONS),
      },
      {
        path: "finance/add",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <FinanceFormPage />
          </Suspense>
        ), FINANCE_ROUTE_PERMISSIONS),
      },
      {
        path: "finance/budgets/add",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <BudgetFormPage />
          </Suspense>
        ), FINANCE_ROUTE_PERMISSIONS),
      },
      {
        path: "finance/budgets/:id",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <BudgetInfoPage />
          </Suspense>
        ), FINANCE_ROUTE_PERMISSIONS),
      },
      {
        path: "finance/budgets/:id/statement",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <BudgetStatementPage />
          </Suspense>
        ), FINANCE_ROUTE_PERMISSIONS),
      },
      {
        path: "documents",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <DocumentsPage />
          </Suspense>
        ), DOCUMENTS_ROUTE_PERMISSIONS),
      },
      {
        path: "reports",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <ReportsPage />
          </Suspense>
        ), REPORTS_ROUTE_PERMISSIONS),
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
        path: "operations",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <OperationsPage />
          </Suspense>
        ), OPERATIONS_ROUTE_PERMISSIONS),
      },
      {
        path: "operations/add",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <AddOperationPage />
          </Suspense>
        ), OPERATIONS_ROUTE_PERMISSIONS),
      },
      {
        path: "operations/:id",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <OperationDetailsPage />
          </Suspense>
        ), OPERATIONS_ROUTE_PERMISSIONS),
      },
      {
        path: "operations/:id/after-action-report",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <AddAfterActionReportPageOperation />
          </Suspense>
        ), OPERATIONS_ROUTE_PERMISSIONS),
      },
      {
        path: "operations/:id/edit",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <EditOperationPage />
          </Suspense>
        ), OPERATIONS_ROUTE_PERMISSIONS),
      },
      {
        path: "security",
        element: (
          <RequireRole requiredPermissions={SECURITY_ROUTE_PERMISSIONS}>
            <Suspense fallback={loadingElement}>
              <SecurityPage />
            </Suspense>
          </RequireRole>
        ),
      },
      {
        path: "maintenance",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <MaintenancePage />
          </Suspense>
        ), MAINTENANCE_ROUTE_PERMISSIONS),
      },
      {
        path: "maintenance/planning",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <MaintenancePage />
          </Suspense>
        ), MAINTENANCE_ROUTE_PERMISSIONS),
      },
      {
        path: "maintenance/add-task",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <MaintenanceProgramsCrudPage />
          </Suspense>
        ), MAINTENANCE_ROUTE_PERMISSIONS),
      },
      {
        path: "maintenance/compliance",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <MaintenancePage />
          </Suspense>
        ), MAINTENANCE_ROUTE_PERMISSIONS),
      },
      {
        path: "maintenance/work-orders",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <MaintenancePage />
          </Suspense>
        ), MAINTENANCE_ROUTE_PERMISSIONS),
      },
      {
        path: "maintenance/work-orders/:id",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <WorkOrderDetailsPage />
          </Suspense>
        ), MAINTENANCE_ROUTE_PERMISSIONS),
      },
      {
        path: "maintenance/defects",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <MaintenancePage />
          </Suspense>
        ), MAINTENANCE_ROUTE_PERMISSIONS),
      },
      {
        path: "maintenance/tracking",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <MaintenancePage />
          </Suspense>
        ), MAINTENANCE_ROUTE_PERMISSIONS),
      },
      {
        path: "users",
        element: (
          <Suspense fallback={loadingElement}>
            <UserDetailsPage />
          </Suspense>
        ),
      },
      {
        path: "users/add",
        element: (
          <RequireRole requiredPermissions={["users.create"]}>
            <Suspense fallback={loadingElement}>
              <AddUserPage />
            </Suspense>
          </RequireRole>
        ),
      },
      {
        path: "messages",
        element: guardWithPermissions((
          <Suspense fallback={loadingElement}>
            <MessagesPage />
          </Suspense>
        ), MESSAGES_ROUTE_PERMISSIONS),
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
