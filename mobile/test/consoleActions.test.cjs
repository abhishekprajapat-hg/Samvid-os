const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_AUDIT_ROWS,
  appendAudit,
  buildAuditReply,
  buildConfirmPrompt,
  isCancelCommand,
  isConfirmCommand,
  matchActionTarget,
  parseActionIntent,
} = require("../.test-build/modules/admin/consoleActions.js");

/*
 * The admin console guesses at intent from free text, so the cases that matter
 * are the ones where it should refuse to guess: an ambiguous instruction, and a
 * bare "yes" with nothing waiting on it. Both would otherwise approve something
 * nobody asked to approve.
 */

describe("confirm and cancel", () => {
  test("a bare yes confirms only when something is pending", () => {
    assert.equal(isConfirmCommand("yes", true), true);
    assert.equal(isConfirmCommand("yes", false), false);
  });

  test("confirmation has to be the whole phrase", () => {
    // "yes approve the inventory request" is a fresh instruction, not a
    // confirmation of whatever happened to be pending.
    assert.equal(isConfirmCommand("yes approve the inventory request", true), false);
  });

  test("cancel behaves the same way", () => {
    assert.equal(isCancelCommand("cancel", true), true);
    assert.equal(isCancelCommand("cancel", false), false);
    assert.equal(isCancelCommand("cancel that inventory thing", true), false);
  });

  test("casing and spacing do not matter", () => {
    assert.equal(isConfirmCommand("  CONFIRM  ", true), true);
    assert.equal(isConfirmCommand("Ok Confirm", true), true);
  });
});

describe("action targets", () => {
  test("recognises each kind", () => {
    assert.equal(matchActionTarget("approve the inventory request"), "INVENTORY");
    assert.equal(matchActionTarget("reject that lead status request"), "LEAD_STATUS");
    assert.equal(matchActionTarget("approve the user deletion"), "USER_DELETE");
  });

  test("returns null when nothing is named", () => {
    assert.equal(matchActionTarget("approve it"), null);
    assert.equal(matchActionTarget(""), null);
  });
});

describe("parseActionIntent", () => {
  test("reads approve and reject", () => {
    assert.deepEqual(parseActionIntent("approve the inventory request"), {
      kind: "APPROVE",
      target: "INVENTORY",
    });
    assert.deepEqual(parseActionIntent("reject the user delete request"), {
      kind: "REJECT",
      target: "USER_DELETE",
    });
  });

  test("Hinglish phrasing works, as it does on web", () => {
    assert.deepEqual(parseActionIntent("inventory request approve karo"), {
      kind: "APPROVE",
      target: "INVENTORY",
    });
  });

  test("refuses when both actions are named", () => {
    // "approve or reject" settles nothing; acting on it would be a coin toss.
    assert.equal(parseActionIntent("approve or reject the inventory request"), null);
  });

  test("refuses when no action is named", () => {
    assert.equal(parseActionIntent("show me the inventory request"), null);
  });

  test("refuses when no target is named", () => {
    assert.equal(parseActionIntent("approve it please"), null);
  });
});

describe("confirm prompt", () => {
  test("names the action and both ways out", () => {
    const prompt = buildConfirmPrompt({
      kind: "APPROVE",
      target: "INVENTORY",
      id: "abc",
      label: "inventory request from Asha",
    });
    assert.match(prompt, /Approve inventory request from Asha\?/);
    assert.match(prompt, /confirm/);
    assert.match(prompt, /cancel/);
  });
});

describe("audit log", () => {
  const entry = (action) => ({ at: "2026-09-21T10:00:00Z", actor: "Admin", action, details: "x" });

  test("newest first", () => {
    const log = appendAudit(appendAudit([], entry("first")), entry("second"));
    assert.equal(log[0].action, "second");
    assert.equal(log[1].action, "first");
  });

  test("bounded, so device storage cannot grow without limit", () => {
    let log = [];
    for (let i = 0; i < MAX_AUDIT_ROWS + 25; i += 1) log = appendAudit(log, entry(`a${i}`));
    assert.equal(log.length, MAX_AUDIT_ROWS);
    // The newest survived and the oldest fell off.
    assert.equal(log[0].action, `a${MAX_AUDIT_ROWS + 24}`);
  });

  test("reads back as a summary, and says so when empty", () => {
    assert.match(buildAuditReply([]), /No actions recorded/);
    const reply = buildAuditReply([entry("Approved inventory request")]);
    assert.match(reply, /1 recorded/);
    assert.match(reply, /Approved inventory request/);
  });

  test("shows at most ten rows however long the log is", () => {
    let log = [];
    for (let i = 0; i < 40; i += 1) log = appendAudit(log, entry(`a${i}`));
    const lines = buildAuditReply(log).split("\n").filter((line) => line.startsWith("- "));
    assert.equal(lines.length, 10);
  });
});
