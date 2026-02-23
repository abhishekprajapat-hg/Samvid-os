const User = require("../models/User");
const {
  DEFAULT_DESCENDANT_DEPTH,
  EXECUTIVE_ROLES,
} = require("../constants/role.constants");

const toId = (value) => String(value || "");

const uniqueObjectIds = (items = []) => {
  const seen = new Set();
  const deduped = [];

  items.forEach((item) => {
    const id = toId(item);
    if (!id || seen.has(id)) return;
    seen.add(id);
    deduped.push(item);
  });

  return deduped;
};

const getDescendantUsers = async ({
  rootUserId,
  companyId,
  maxDepth = DEFAULT_DESCENDANT_DEPTH,
  includeInactive = false,
  select = "_id role parentId isActive",
}) => {
  const resolvedRootId = toId(rootUserId);
  if (!resolvedRootId) return [];

  const rows = [];
  const visited = new Set([resolvedRootId]);
  let frontier = [resolvedRootId];
  let depth = 0;

  while (frontier.length && depth < maxDepth) {
    const query = {
      parentId: { $in: frontier },
    };
    if (companyId) {
      query.companyId = companyId;
    }
    if (!includeInactive) {
      query.isActive = true;
    }

    const children = await User.find(query).select(select).lean();
    if (!children.length) break;

    const nextFrontier = [];
    children.forEach((child) => {
      const childId = toId(child._id);
      if (!childId || visited.has(childId)) return;

      visited.add(childId);
      rows.push(child);
      nextFrontier.push(childId);
    });

    frontier = nextFrontier;
    depth += 1;
  }

  return rows;
};

const getDescendantExecutiveIds = async ({
  rootUserId,
  companyId,
  includeInactive = false,
}) => {
  const descendants = await getDescendantUsers({
    rootUserId,
    companyId,
    includeInactive,
    select: "_id role parentId isActive",
  });

  return descendants
    .filter((row) => EXECUTIVE_ROLES.includes(row.role))
    .map((row) => row._id);
};

const getDescendantByRoleCount = async ({
  rootUserId,
  companyId,
  roles = [],
}) => {
  if (!roles.length) return {};

  const descendants = await getDescendantUsers({
    rootUserId,
    companyId,
    select: "_id role parentId isActive",
  });

  const targetRoles = new Set(roles);
  const counts = {};
  roles.forEach((role) => {
    counts[role] = 0;
  });

  descendants.forEach((row) => {
    if (!targetRoles.has(row.role)) return;
    counts[row.role] += 1;
  });

  return counts;
};

const getAncestorByRoles = async ({
  user,
  targetRoles = [],
  companyId = null,
  maxHops = DEFAULT_DESCENDANT_DEPTH,
  select = "_id name role parentId companyId isActive",
}) => {
  if (!user || !targetRoles.length) return null;

  const targetRoleSet = new Set(targetRoles);

  let cursor = user;
  let hops = 0;

  while (cursor && hops <= maxHops) {
    if (targetRoleSet.has(cursor.role)) {
      return cursor;
    }

    if (!cursor.parentId) break;

    const parentQuery = {
      _id: cursor.parentId,
    };
    if (companyId) {
      parentQuery.companyId = companyId;
    }

    const parent = await User.findOne(parentQuery).select(select).lean();
    if (!parent) break;

    cursor = parent;
    hops += 1;
  }

  return null;
};

const getFirstLevelChildrenByRole = async ({
  parentRole,
  childRoles = [],
  companyId,
}) => {
  if (!parentRole || !childRoles.length) return [];

  const parents = await User.find({
    role: parentRole,
    isActive: true,
    companyId,
  })
    .select("_id createdAt")
    .sort({ createdAt: 1 })
    .lean();

  if (!parents.length) return [];

  const parentIds = parents.map((parent) => parent._id);
  const counts = await User.aggregate([
    {
      $match: {
        parentId: { $in: parentIds },
        role: { $in: childRoles },
        isActive: true,
        companyId,
      },
    },
    {
      $group: {
        _id: "$parentId",
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map(
    counts.map((row) => [toId(row._id), Number(row.count || 0)]),
  );

  const sorted = [...parents].sort((left, right) => {
    const leftCount = countMap.get(toId(left._id)) || 0;
    const rightCount = countMap.get(toId(right._id)) || 0;
    if (leftCount !== rightCount) return leftCount - rightCount;

    const leftCreatedAt = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightCreatedAt = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;

    return toId(left._id).localeCompare(toId(right._id));
  });

  return uniqueObjectIds(sorted);
};

module.exports = {
  toId,
  getDescendantUsers,
  getDescendantExecutiveIds,
  getDescendantByRoleCount,
  getAncestorByRoles,
  getFirstLevelChildrenByRole,
};
