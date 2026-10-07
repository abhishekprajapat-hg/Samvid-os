const assert = require("node:assert/strict");
const test = require("node:test");
const { hasUnpaidPartialCollection, shouldClearTerminalFollowUp } = require("../src/utils/leadFollowUp");

test("lost and invalid leads clear pending follow-ups", () => {
  assert.equal(shouldClearTerminalFollowUp("LOST", {}), true);
  assert.equal(shouldClearTerminalFollowUp("INVALID", {}), true);
  assert.equal(shouldClearTerminalFollowUp("CONTACTED", {}), false);
});

test("closed partial-payment collection stays scheduled until paid", () => {
  const unpaid = { status: "CLOSED", dealPayment: { paymentType: "PARTIAL", remainingAmount: 2500 } };
  const paid = { status: "CLOSED", dealPayment: { paymentType: "PARTIAL", remainingAmount: 0 } };
  assert.equal(hasUnpaidPartialCollection(unpaid), true);
  assert.equal(shouldClearTerminalFollowUp("CLOSED", unpaid), false);
  assert.equal(shouldClearTerminalFollowUp("CLOSED", paid), true);
  assert.equal(shouldClearTerminalFollowUp("CLOSED", { dealPayment: { paymentType: "FULL" } }), true);
});
