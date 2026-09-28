/*
 * The realtime events web turns into alerts - a port of the normalisers in
 * frontend/src/context/chatNotificationProvider.jsx and the helpers in
 * components/layout/AdminRequestAlertToast.jsx.
 *
 * Every admin-facing socket event (a payment awaiting approval, an inventory
 * change request, a deal closed, a delete request...) arrives in a slightly
 * different shape. This reduces each to one record with a stable id, so the
 * same event heard twice alerts once, and says which ones can be approved or
 * rejected from the alert itself. Kept free of React for testing; see
 * test/realtimeEvents.test.cjs.
 */

export type AdminRequestEvent = {
  eventId: string;
  source: "password" | "user-delete" | "lead" | "inventory";
  requestType: string;
  createdAt: string;
  preview: string;
  leadId: string;
  requestId: string;
  inventoryId: string;
  payload: any;
};

const str = (value: unknown) => String(value ?? "").trim();

export const normalizeAdminRequestEvent = (payload: any = {}): AdminRequestEvent | null => {
  if (!payload || typeof payload !== "object") return null;

  const source = str(payload.source).toLowerCase() || (payload.leadId || payload.lead ? "lead" : "inventory");

  if (source === "password") {
    const requestId = str(payload.requestId);
    if (!requestId) return null;
    const requestedByName = str(payload.requestedBy?.name) || "User";
    return {
      eventId: str(payload.eventId) || `password:${requestId}`,
      source: "password",
      requestType: "PASSWORD_CHANGE",
      createdAt: payload.createdAt || new Date().toISOString(),
      preview: `${requestedByName} requested password change`,
      leadId: "",
      requestId,
      inventoryId: "",
      payload,
    };
  }

  if (source === "user-delete") {
    const requestId = str(payload.requestId);
    if (!requestId) return null;
    const targetName = str(payload.targetUser?.name || payload.snapshot?.name) || "User";
    const requestedByName = str(payload.requestedBy?.name);
    return {
      eventId: str(payload.eventId) || `user-delete:${requestId}`,
      source: "user-delete",
      requestType: "USER_DELETE",
      createdAt: payload.createdAt || new Date().toISOString(),
      preview: requestedByName
        ? `${requestedByName} requested deletion for ${targetName}`
        : `Delete request for ${targetName}`,
      leadId: "",
      requestId,
      inventoryId: "",
      payload,
    };
  }

  if (source === "lead") {
    const leadId = str(payload.leadId || payload.lead?._id);
    if (!leadId) return null;
    const leadName = str(payload.lead?.name) || "Lead";
    const leadRequestType = str(payload.requestType).toUpperCase();
    const paymentMode = str(payload.payment?.mode);
    const paymentType = str(payload.payment?.paymentType);
    const createdAt = payload.createdAt || new Date().toISOString();
    const timestamp = new Date(createdAt).getTime();
    const base = { source: "lead" as const, createdAt, leadId, inventoryId: "", payload };

    if (leadRequestType === "LEAD_DEAL_CLOSED") {
      return {
        ...base,
        eventId: str(payload.eventId) || `lead-closed:${leadId}:${timestamp}`,
        requestType: "LEAD_DEAL_CLOSED",
        preview: `${leadName} deal closed`,
        requestId: "",
      };
    }
    if (leadRequestType === "LEAD_REMAINING_PAYMENT_COLLECTED") {
      return {
        ...base,
        eventId: str(payload.eventId) || `lead-remaining-collected:${leadId}:${timestamp}`,
        requestType: "LEAD_REMAINING_PAYMENT_COLLECTED",
        preview: `${leadName} remaining payment collected`,
        requestId: "",
      };
    }
    if (leadRequestType === "LEAD_STATUS_APPROVAL") {
      const requestId = str(payload.requestId);
      return {
        ...base,
        eventId: str(payload.eventId) || `lead-status-request:${requestId || leadId}:${timestamp}`,
        requestType: "LEAD_STATUS_APPROVAL",
        preview: `${leadName} close approval request`,
        requestId,
      };
    }
    return {
      ...base,
      eventId: str(payload.eventId) || `lead-payment:${leadId}:${timestamp}`,
      requestType: "LEAD_PAYMENT_APPROVAL",
      preview: `${leadName} payment request (${paymentMode || "Mode NA"}${paymentType ? `, ${paymentType}` : ""})`,
      requestId: "",
    };
  }

  const requestId = str(payload.requestId);
  if (!requestId) return null;
  const rawInventoryId =
    payload.inventoryId
    || payload.inventory?._id
    || payload.inventory?.id
    || payload.inventoryId?._id
    || payload.request?.inventoryId?._id
    || payload.request?.inventoryId
    || "";
  const inventoryId =
    typeof rawInventoryId === "object" ? str(rawInventoryId._id || rawInventoryId.id) : str(rawInventoryId);
  const inventoryRequestType = str(payload.inventoryRequestType || payload.type || "update").toLowerCase();
  return {
    eventId: str(payload.eventId) || `inventory:${requestId}`,
    source: "inventory",
    requestType: "INVENTORY",
    createdAt: payload.createdAt || new Date().toISOString(),
    preview: `Inventory ${inventoryRequestType} request raised`,
    leadId: "",
    requestId,
    inventoryId,
    payload,
  };
};

/* The alert's heading, as web's AdminRequestAlertToast words it. */
export const adminRequestTitle = (event: AdminRequestEvent) => {
  if (event.source === "lead" && event.requestType === "LEAD_DEAL_CLOSED") return "Deal Closed Alert";
  if (event.source === "lead" && event.requestType === "LEAD_REMAINING_PAYMENT_COLLECTED") return "Remaining Payment Alert";
  if (event.source === "user-delete") return "User Delete Request";
  if (event.source === "password") return "Password Request";
  return "New Admin Request";
};

export const adminRequestContext = (event: AdminRequestEvent) => {
  if (event.source === "inventory") return "Inventory workflow";
  if (event.source === "user-delete") return "User management";
  if (event.source === "password") return "Account security";
  if (event.requestType === "LEAD_DEAL_CLOSED") return "Lead deal closed";
  if (event.requestType === "LEAD_REMAINING_PAYMENT_COLLECTED") return "Remaining payment collected";
  return "Lead payment approval";
};

/* Web reviews these two from the alert; everything else opens its page. */
export const canReviewFromAlert = (event: AdminRequestEvent) =>
  event.source === "inventory" || (event.source === "lead" && event.requestType === "LEAD_PAYMENT_APPROVAL");

export const resolveLeadStatusForReview = (event: AdminRequestEvent) =>
  str(event.payload?.lead?.status || event.payload?.status || "REQUESTED").toUpperCase() || "REQUESTED";

/* Where "Open" goes: web's handleOpen, as mobile route names. */
export const adminRequestTarget = (event: AdminRequestEvent): { screen: string; params?: Record<string, unknown> } => {
  if (event.source === "inventory") {
    return event.inventoryId
      ? { screen: "InventoryDetails", params: { assetId: event.inventoryId } }
      : { screen: "Notifications" };
  }
  if (event.source === "user-delete" || event.source === "password") return { screen: "Notifications" };
  return event.leadId ? { screen: "LeadDetails", params: { leadId: event.leadId } } : { screen: "Leads" };
};

/* A task event, as web's normalizeTaskNotificationEvent reads it. */
export const normalizeTaskEvent = (payload: any = {}, eventType = "task:updated") => {
  if (!payload || typeof payload !== "object") return null;
  const task = payload.task || {};
  const taskId = str(task?._id || payload.taskId);
  const createdAt = task?.updatedAt || task?.createdAt || new Date().toISOString();
  const title = str(task?.title);
  return {
    id: str(payload.eventId) || `${eventType}:${taskId || "task"}:${new Date(createdAt).getTime()}`,
    taskId,
    title: eventType === "task:created" ? "New task" : "Task update",
    preview: str(payload.message) || (title ? `Task update: ${title}` : "Task updated"),
    createdAt,
  };
};

export const buildChatPreview = (message: any) => {
  const text = str(message?.text);
  if (text) return text;
  const type = str(message?.type).toLowerCase();
  if (type === "property") {
    const title = str(message?.sharedProperty?.title);
    return title ? `Shared property: ${title}` : "Shared a property";
  }
  if (type === "media") {
    const total = Array.isArray(message?.mediaAttachments) ? message.mediaAttachments.length : 0;
    return total > 1 ? `Shared ${total} media files` : "Shared a media file";
  }
  return "New message";
};
