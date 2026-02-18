const USER_ROLES = {
  ADMIN: "ADMIN",
};

const emitToRoom = ({ io, room, event, payload }) => {
  if (!io || !room || !event) return;
  io.to(room).emit(event, payload);
};

const emitToUser = ({ io, userId, event, payload }) => {
  if (!io || !userId || !event) return;
  io.to(`user:${userId}`).emit(event, payload);
};

const notifyRequestCreated = ({ io, request, companyId, teamId }) => {
  if (!io || !request || !companyId) return;

  emitToRoom({
    io,
    room: `company:${companyId}:role:${USER_ROLES.ADMIN}`,
    event: "inventory:request:created",
    payload: {
      requestId: request._id,
      type: request.type,
      status: request.status,
      companyId,
      teamId: teamId || request.teamId || null,
      requestedBy: request.requestedBy,
      createdAt: request.createdAt,
    },
  });

  if (teamId || request.teamId) {
    emitToUser({
      io,
      userId: teamId || request.teamId,
      event: "inventory:request:created",
      payload: {
        requestId: request._id,
        type: request.type,
        status: request.status,
      },
    });
  }
};

const notifyRequestReviewed = ({ io, request, inventory }) => {
  if (!io || !request?.requestedBy) return;

  emitToUser({
    io,
    userId: request.requestedBy,
    event: "inventory:request:reviewed",
    payload: {
      requestId: request._id,
      type: request.type,
      status: request.status,
      reviewedAt: request.reviewedAt,
      rejectionReason: request.rejectionReason || "",
      inventoryId: inventory?._id || request.inventoryId || null,
    },
  });
};

module.exports = {
  notifyRequestCreated,
  notifyRequestReviewed,
};
