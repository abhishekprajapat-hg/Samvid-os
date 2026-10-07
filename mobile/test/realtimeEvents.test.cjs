const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeAdminRequestEvent,
  canReviewFromAlert,
  adminRequestTitle,
  adminRequestTarget,
  normalizeTaskEvent,
  buildChatPreview,
} = require("../.test-build/context/realtimeEvents.js");

/*
 * Realtime alert normalisation, ported from web's chatNotificationProvider and
 * AdminRequestAlertToast. The event id decides whether the same event heard
 * twice alerts twice, and canReviewFromAlert decides whether an Approve button
 * is offered at all - so both are pinned.
 */

describe("normalizeAdminRequestEvent", () => {
  test("a payment approval keeps its lead and reads its mode", () => {
    const event = normalizeAdminRequestEvent({
      leadId: "L1",
      lead: { name: "Asha" },
      payment: { mode: "UPI", paymentType: "Token" },
      createdAt: "2026-09-25T10:00:00Z",
    });
    assert.equal(event.source, "lead");
    assert.equal(event.requestType, "LEAD_PAYMENT_APPROVAL");
    assert.equal(event.preview, "Asha payment request (UPI, Token)");
    assert.equal(canReviewFromAlert(event), true);
    assert.deepEqual(adminRequestTarget(event), { screen: "LeadDetails", params: { leadId: "L1" } });
  });

  test("a deal-closed alert is informational only", () => {
    const event = normalizeAdminRequestEvent({ source: "lead", leadId: "L1", requestType: "LEAD_DEAL_CLOSED" });
    assert.equal(adminRequestTitle(event), "Deal Closed Alert");
    assert.equal(canReviewFromAlert(event), false);
  });

  test("an inventory request resolves a nested inventory id", () => {
    const event = normalizeAdminRequestEvent({ requestId: "R9", request: { inventoryId: { _id: "INV1" } }, type: "DELETE" });
    assert.equal(event.eventId, "inventory:R9");
    assert.equal(event.inventoryId, "INV1");
    assert.equal(event.preview, "Inventory delete request raised");
    assert.equal(canReviewFromAlert(event), true);
  });

  test("a user delete request opens notifications", () => {
    const event = normalizeAdminRequestEvent({
      source: "user-delete",
      requestId: "D1",
      targetUser: { name: "Vikram" },
      requestedBy: { name: "Neha" },
    });
    assert.equal(event.preview, "Neha requested deletion for Vikram");
    assert.equal(adminRequestTarget(event).screen, "Notifications");
  });

  test("a request with nothing to identify it is dropped", () => {
    assert.equal(normalizeAdminRequestEvent({ source: "inventory" }), null);
  });
});

test("task events carry their title", () => {
  const event = normalizeTaskEvent({ task: { _id: "T1", title: "Call back" } }, "task:created");
  assert.equal(event.title, "New task");
  assert.equal(event.preview, "Task update: Call back");
});

test("chat previews name what was shared", () => {
  assert.equal(buildChatPreview({ type: "property", sharedProperty: { title: "Skye" } }), "Shared property: Skye");
  assert.equal(buildChatPreview({ type: "media", mediaAttachments: [{}, {}] }), "Shared 2 media files");
});
