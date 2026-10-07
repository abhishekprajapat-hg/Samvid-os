const buildProfileLeadScope = ({ companyId, userId, role }) => ({
  companyId,
  ...(role === "FIELD_EXECUTIVE"
    ? {
      $or: [
        { assignedTo: userId },
        { assignedFieldExecutive: userId },
      ],
    }
    : { assignedTo: userId }),
});

module.exports = { buildProfileLeadScope };
