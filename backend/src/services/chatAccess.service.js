const {
  USER_ROLES,
  EXECUTIVE_ROLES,
  CHAT_ROOM_TYPES,
} = require("../constants/chat.constants");

const toObjectIdString = (value) => String(value || "");

const uniqueIds = (ids = []) =>
  [...new Set(ids.map((id) => toObjectIdString(id)).filter(Boolean))];

const isExecutiveRole = (role) => EXECUTIVE_ROLES.includes(role);

const isAdminRole = (role) => role === USER_ROLES.ADMIN;

const isManagerRole = (role) => role === USER_ROLES.MANAGER;

const getTeamIdForUser = (user) => {
  if (!user) return "";
  if (isManagerRole(user.role)) return toObjectIdString(user._id);
  if (isExecutiveRole(user.role)) return toObjectIdString(user.parentId);
  return "";
};

const isManagerOf = (managerUser, memberUser) =>
  isManagerRole(managerUser?.role)
  && toObjectIdString(memberUser?.parentId) === toObjectIdString(managerUser?._id);

const isSameManager = (leftUser, rightUser) => {
  const leftManagerId = toObjectIdString(leftUser?.parentId);
  const rightManagerId = toObjectIdString(rightUser?.parentId);
  return Boolean(leftManagerId) && leftManagerId === rightManagerId;
};

const buildDirectKey = (leftId, rightId) =>
  [toObjectIdString(leftId), toObjectIdString(rightId)].sort().join(":");

const canInitiateDirectChat = ({ initiator, recipient }) => {
  if (!initiator || !recipient) {
    return { allowed: false, reason: "Invalid users for chat validation" };
  }

  if (toObjectIdString(initiator._id) === toObjectIdString(recipient._id)) {
    return { allowed: false, reason: "Cannot message yourself" };
  }

  if (!initiator.isActive || !recipient.isActive) {
    return { allowed: false, reason: "Inactive users cannot chat" };
  }

  if (isAdminRole(initiator.role)) {
    return { allowed: true, type: CHAT_ROOM_TYPES.DIRECT };
  }

  if (isManagerRole(initiator.role)) {
    if (isAdminRole(recipient.role) || isManagerRole(recipient.role)) {
      return { allowed: true, type: CHAT_ROOM_TYPES.DIRECT };
    }

    if (isExecutiveRole(recipient.role) && isManagerOf(initiator, recipient)) {
      return { allowed: true, type: CHAT_ROOM_TYPES.DIRECT };
    }

    return { allowed: false, reason: "Manager can chat only with admin, managers, and own team" };
  }

  if (initiator.role === USER_ROLES.EXECUTIVE) {
    if (isAdminRole(recipient.role)) {
      return {
        allowed: true,
        type: CHAT_ROOM_TYPES.ESCALATION,
        escalation: {
          managerToNotify: initiator.parentId || null,
        },
      };
    }

    if (isManagerRole(recipient.role) && isManagerOf(recipient, initiator)) {
      return { allowed: true, type: CHAT_ROOM_TYPES.DIRECT };
    }

    if (recipient.role === USER_ROLES.EXECUTIVE && isSameManager(initiator, recipient)) {
      return { allowed: true, type: CHAT_ROOM_TYPES.DIRECT };
    }

    return {
      allowed: false,
      reason: "Executive can chat with manager, same-team executives, or admin escalation only",
    };
  }

  if (initiator.role === USER_ROLES.FIELD_EXECUTIVE) {
    if (isAdminRole(recipient.role)) {
      return {
        allowed: true,
        type: CHAT_ROOM_TYPES.ESCALATION,
        escalation: {
          managerToNotify: initiator.parentId || null,
        },
      };
    }

    if (isManagerRole(recipient.role) && isManagerOf(recipient, initiator)) {
      return { allowed: true, type: CHAT_ROOM_TYPES.DIRECT };
    }

    return {
      allowed: false,
      reason: "Field Executive can chat with manager or admin escalation only",
    };
  }

  return { allowed: false, reason: "Role not allowed for direct chat" };
};

const buildContactQueryForUser = (user) => {
  const userId = toObjectIdString(user?._id);
  const managerId = toObjectIdString(user?.parentId);

  const baseQuery = {
    isActive: true,
    _id: { $ne: userId },
  };

  if (isAdminRole(user?.role)) {
    return baseQuery;
  }

  if (isManagerRole(user?.role)) {
    return {
      ...baseQuery,
      $or: [
        { role: USER_ROLES.ADMIN },
        { role: USER_ROLES.MANAGER },
        { role: { $in: EXECUTIVE_ROLES }, parentId: user._id },
      ],
    };
  }

  if (user?.role === USER_ROLES.EXECUTIVE) {
    const query = {
      ...baseQuery,
      $or: [
        { role: USER_ROLES.ADMIN },
        {
          role: USER_ROLES.EXECUTIVE,
          parentId: user.parentId || null,
        },
      ],
    };

    if (managerId) {
      query.$or.push({ role: USER_ROLES.MANAGER, _id: user.parentId });
    }

    return query;
  }

  if (user?.role === USER_ROLES.FIELD_EXECUTIVE) {
    const query = {
      ...baseQuery,
      $or: [{ role: USER_ROLES.ADMIN }],
    };

    if (managerId) {
      query.$or.push({ role: USER_ROLES.MANAGER, _id: user.parentId });
    }

    return query;
  }

  return { _id: null };
};

const getLeadParticipantIdsFromLeadDoc = (lead) =>
  uniqueIds([
    lead?.assignedManager,
    lead?.assignedExecutive,
    lead?.assignedFieldExecutive,
  ]);

module.exports = {
  toObjectIdString,
  uniqueIds,
  isExecutiveRole,
  isAdminRole,
  isManagerRole,
  getTeamIdForUser,
  isManagerOf,
  isSameManager,
  buildDirectKey,
  canInitiateDirectChat,
  buildContactQueryForUser,
  getLeadParticipantIdsFromLeadDoc,
};
