const { createHttpError } = require("../utils/httpError");
const { isAdminRole } = require("./access.service");
const { getDescendantUsers } = require("./hierarchy.service");

/**
 * A Manager manages their own branch of the tree, not the whole tenant. When
 * they name a reporting manager explicitly it has to be themselves or someone
 * beneath them; auto-assignment (the existing least-loaded lookup) is left
 * alone so current create-user flows keep working unchanged.
 */
const assertReportingTargetInActorScope = async ({ actingUser, parentId, companyId }) => {
  if (isAdminRole(actingUser?.role)) return;
  if (!parentId) return;

  if (String(parentId) === String(actingUser._id)) return;

  const descendants = await getDescendantUsers({
    rootUserId: actingUser._id,
    companyId,
    includeInactive: true,
    select: "_id",
  });

  const inScope = descendants.some((row) => String(row._id) === String(parentId));
  if (!inScope) {
    throw createHttpError(
      403,
      "You can only assign a reporting manager inside your own team",
    );
  }
};

/** Blocks the self-promotion path: nobody but an Admin re-roles their own account. */
const assertNotSelfPromotion = ({ actingUser, targetUserId }) => {
  if (isAdminRole(actingUser?.role)) return;
  if (String(actingUser?._id) !== String(targetUserId)) return;
  throw createHttpError(403, "You cannot change your own role");
};

module.exports = { assertReportingTargetInActorScope, assertNotSelfPromotion };
