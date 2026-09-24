import { Lock } from "lucide-react";
import { usePermissions } from "../../context/usePermissions";
import { EmptyState, Skeleton } from "../ui";

// Second, finer-grained gate layered on top of the role check already applied
// in App.jsx's route table. Role gets you into /coworking/*; permission
// decides which pages inside it you can actually open. The API enforces the
// same permission independently (see requirePermission on the backend) —
// this only controls what renders client-side.
//
// A refusal renders in place rather than redirecting. It used to bounce to the
// coworking dashboard, but the booking board is now the only page in the
// module and it is gated on cabins.view - so for a COWORKING_ADMIN, whose "/"
// resolves to the board, any redirect out of here is a loop back into here.
const CoworkingPermissionGate = ({ permission, children }) => {
  const { can, loading } = usePermissions();

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (permission && !can(permission)) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Lock}
          title="You do not have access to this page"
          description={`Opening it needs the "${permission}" permission on your coworking role. Ask an admin to grant it.`}
        />
      </div>
    );
  }

  return children;
};

export default CoworkingPermissionGate;
