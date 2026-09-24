import { Lock } from "lucide-react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "../../context/usePermissions";
import { EmptyState, Skeleton } from "../ui";

// Employee page selections control route access. Accounts using role defaults
// retain the built-in role matrix. The API applies its own access checks.
const PageAccessGate = ({ page, allowedRoles, children }) => {
  const { canPage, enforcePageAccess, isAdmin, role, loading } = usePermissions();

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const hasEmployeePages = enforcePageAccess && !isAdmin;

  if (hasEmployeePages) {
    if (page && !canPage(page)) {
      return (
        <div className="p-6">
          <EmptyState
            icon={Lock}
            title="You do not have access to this page"
            description="Your account does not include this page. Ask an admin to update your page access."
          />
        </div>
      );
    }
    return children;
  }

  // Role defaults: the built-in matrix decides. Routes
  // that already did their own role check pass no allowedRoles.
  if (allowedRoles && !isAdmin && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PageAccessGate;
