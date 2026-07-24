const {
  USER_ROLES,
  MANAGEMENT_ROLES,
  EXECUTIVE_ROLES,
  CHAT_ROOM_TYPES,
} = require("../constants/chat.constants");

const toObjectIdString = (value) => String(value || "");

const uniqueIds = (ids = []) =>
  [...new Set(ids.map((id) => toObjectIdString(id)).filter(Boolean))];

const isExecutiveRole = (role) => EXECUTIVE_ROLES.includes(role);

const isAdminRole = (role) => role === USER_ROLES.ADMIN || role === USER_ROLES.SUPER_ADMIN;

const isManagerRole = (role) => MANAGEMENT_ROLES.includes(role);

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

  const initiatorCompanyId = toObjectIdString(initiator.companyId);
  const recipientCompanyId = toObjectIdString(recipient.companyId);
  if (
    (initiatorCompanyId || recipientCompanyId)
    && initiatorCompanyId !== recipientCompanyId
  ) {
    return { allowed: false, reason: "Cannot message users outside your company" };
  }

  return { allowed: true, type: CHAT_ROOM_TYPES.DIRECT };
};

const buildContactQueryForUser = (user) => {
  const userId = toObjectIdString(user?._id);
  const companyId = toObjectIdString(user?.companyId);

  const baseQuery = {
    isActive: true,
    _id: { $ne: userId },
  };

  if (companyId) {
    baseQuery.companyId = companyId;
  }

  return baseQuery;
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
