import { useContext } from "react";
import PermissionContext from "./permissionContext";

// Fails closed: if the provider hasn't mounted (or a component is rendered
// outside it), `can()` denies everything rather than allowing everything.
// The backend is the real enforcement point either way (see
// requirePermission in backend/src/middleware/permission.middleware.js) —
// this hook only drives UI-level hiding/disabling.
//
// Page access is the one thing that does NOT fail closed here: outside the
// provider there is no role config to enforce, and denying every page would
// black out the app rather than protect it. requirePageAccess on the API is the
// gate that matters.
const DENY_ALL_FALLBACK = {
  role: "",
  isAdmin: false,
  permissions: [],
  pages: [],
  dataScope: "ASSIGNED",
  enforcePageAccess: false,
  loading: false,
  error: null,
  can: () => false,
  canPage: () => true,
  canPageAction: () => true,
  refresh: async () => {},
};

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  return context || DENY_ALL_FALLBACK;
};
