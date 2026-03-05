const USER_ROLES = {
  ADMIN: "ADMIN",
};
const ADMIN_REQUEST_EVENT = "admin:request:new";

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
  const adminRoom = `company:${companyId}:role:${USER_ROLES.ADMIN}`;
  const resolvedTeamId = teamId || request.teamId || null;
  const eventId = `inventory:${request._id}`;

  emitToRoom({
    io,
    room: adminRoom,
    event: "inventory:request:created",
    payload: {
      eventId,
      requestId: request._id,
      type: request.type,
      status: request.status,
      companyId,
      teamId: resolvedTeamId,
      requestedBy: request.requestedBy,
      createdAt: request.createdAt,
    },
  });

  emitToRoom({
    io,
    room: adminRoom,
    event: ADMIN_REQUEST_EVENT,
    payload: {
      eventId,
      source: "inventory",
      requestType: "INVENTORY",
      requestId: request._id,
      inventoryRequestType: request.type,
      status: request.status,
      companyId,
      teamId: resolvedTeamId,
      requestedBy: request.requestedBy,
      createdAt: request.createdAt,
      message: `New inventory ${String(request.type || "update").toLowerCase()} request`,
    },
  });

  if (resolvedTeamId) {
    emitToUser({
      io,
      userId: resolvedTeamId,
      event: "inventory:request:created",
      payload: {
        eventId,
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
