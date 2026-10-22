import { Navigate, useParams } from "react-router-dom";
import { useGetAfterActionReportQuery } from "../api";

/**
 * /dashboard/after-action-reports/:id — the approvals inbox links AARs by
 * their own id, but an AAR lives on its operation's "After Action Report" tab.
 */
export const AfterActionReportRedirect = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isError } = useGetAfterActionReportQuery(Number(id), { skip: !id });

  if (isError) return <div className="p-10 text-center text-sm opacity-60">After Action Report not found.</div>;
  if (!data) return <div className="p-10 text-center text-sm opacity-60">Opening After Action Report…</div>;

  return <Navigate to={`/dashboard/operations/${data.operation_id}?tab=aar`} replace state={{ from: "/dashboard/approvals", fromLabel: "Approvals" }} />;
};
