/*
 * Who may do what to an inventory asset.
 *
 * A direct port of the capability flags in
 * frontend/src/modules/inventory/AssetVault.jsx (around line 857). Inventory is
 * the module where a role's rights are least uniform: some roles write
 * directly, some raise a request for approval, and some can only look. Mobile
 * had collapsed all of that into one `canManage` list that granted direct
 * delete to MANAGER and CHANNEL_PARTNER - neither of which web allows.
 *
 * Pulled out of the screen so the rules are readable, testable and shared,
 * rather than inlined next to the button that happens to use them.
 */

/** Roles allowed to raise a create request. Note: includes channel partners. */
export const CREATE_REQUEST_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "EXECUTIVE",
  "FIELD_EXECUTIVE",
  "CHANNEL_PARTNER",
]);

/** Roles allowed to raise an update or status-change request. No partners. */
export const UPDATE_STATUS_REQUEST_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "EXECUTIVE",
  "FIELD_EXECUTIVE",
]);

export type InventoryAccessInput = {
  role: string;
  enforcePageAccess: boolean;
  /** usePermissions().canPageAction, already bound to the current user. */
  canPageAction: (pageKey: string, action: string) => boolean;
};

export type InventoryAccess = {
  /** Edit an asset in place, without approval. */
  canManage: boolean;
  /** Delete an asset outright. ADMIN only, unless explicitly granted. */
  canDeleteDirect: boolean;
  /** Raise a delete request instead of deleting. */
  canRequestDelete: boolean;
  /** Approve or reject other people's requests. */
  canReviewInventoryRequests: boolean;
  /** Reach the create form at all - directly or as a request. */
  canCreateInventory: boolean;
  /** Raise an edit request instead of editing. */
  canRequestEdit: boolean;
  /** Reach the edit form at all. */
  canOpenEditModal: boolean;
  /** Raise a status-change request. */
  canRequestStatusChange: boolean;
};

export const resolveInventoryAccess = ({
  role,
  enforcePageAccess,
  canPageAction,
}: InventoryAccessInput): InventoryAccess => {
  // A page grant only widens where the page model allows it, which is why each
  // flag checks enforcePageAccess rather than the grant alone.
  const granted = (action: string) => enforcePageAccess && canPageAction("inventory", action);

  const canManage = role === "ADMIN" || role === "MANAGER" || granted("edit");
  const canDeleteDirect = role === "ADMIN" || granted("delete");
  const canRequestDelete =
    !canDeleteDirect && (UPDATE_STATUS_REQUEST_ROLES.has(role) || granted("delete"));
  const canReviewInventoryRequests = role === "ADMIN" || granted("approve");
  const canCreateInventory = CREATE_REQUEST_ROLES.has(role) || granted("create");
  const canRequestEdit = UPDATE_STATUS_REQUEST_ROLES.has(role) || granted("edit");

  return {
    canManage,
    canDeleteDirect,
    canRequestDelete,
    canReviewInventoryRequests,
    canCreateInventory,
    canRequestEdit,
    canOpenEditModal: canManage || canRequestEdit,
    canRequestStatusChange: UPDATE_STATUS_REQUEST_ROLES.has(role),
  };
};
