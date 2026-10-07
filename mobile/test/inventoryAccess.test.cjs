const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveInventoryAccess,
} = require("../.test-build/modules/inventory/inventoryAccess.js");

/*
 * Inventory capability rules, ported from AssetVault.jsx.
 *
 * Worth pinning because mobile previously granted direct delete to MANAGER and
 * CHANNEL_PARTNER, which web never has. The delete cases below are the ones
 * that regression would show up in first.
 */

const noGrants = () => false;
const allGrants = () => true;

const access = (role, { enforcePageAccess = false, canPageAction = noGrants } = {}) =>
  resolveInventoryAccess({ role, enforcePageAccess, canPageAction });

describe("direct delete", () => {
  test("ADMIN can delete outright", () => {
    assert.equal(access("ADMIN").canDeleteDirect, true);
  });

  for (const role of ["MANAGER", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"]) {
    test(`${role} cannot delete outright`, () => {
      assert.equal(access(role).canDeleteDirect, false);
    });
  }

  test("an explicit delete grant allows it", () => {
    const granted = access("EXECUTIVE", { enforcePageAccess: true, canPageAction: allGrants });
    assert.equal(granted.canDeleteDirect, true);
    // Direct and request are mutually exclusive.
    assert.equal(granted.canRequestDelete, false);
  });

  test("a grant without enforcePageAccess does nothing", () => {
    assert.equal(access("EXECUTIVE", { canPageAction: allGrants }).canDeleteDirect, false);
  });
});

describe("delete requests", () => {
  for (const role of ["MANAGER", "EXECUTIVE", "FIELD_EXECUTIVE"]) {
    test(`${role} raises a request instead`, () => {
      assert.equal(access(role).canRequestDelete, true);
    });
  }

  test("CHANNEL_PARTNER can neither delete nor request it", () => {
    const partner = access("CHANNEL_PARTNER");
    assert.equal(partner.canDeleteDirect, false);
    assert.equal(partner.canRequestDelete, false);
  });

  test("ADMIN never needs to request", () => {
    assert.equal(access("ADMIN").canRequestDelete, false);
  });
});

describe("edit", () => {
  test("ADMIN and MANAGER edit in place", () => {
    assert.equal(access("ADMIN").canManage, true);
    assert.equal(access("MANAGER").canManage, true);
  });

  test("executives raise an edit request", () => {
    const exec = access("EXECUTIVE");
    assert.equal(exec.canManage, false);
    assert.equal(exec.canRequestEdit, true);
    assert.equal(exec.canOpenEditModal, true);
  });

  test("CHANNEL_PARTNER cannot reach the edit form", () => {
    const partner = access("CHANNEL_PARTNER");
    assert.equal(partner.canManage, false);
    assert.equal(partner.canRequestEdit, false);
    assert.equal(partner.canOpenEditModal, false);
  });
});

describe("create", () => {
  for (const role of ["ADMIN", "MANAGER", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"]) {
    test(`${role} can reach the create form`, () => {
      assert.equal(access(role).canCreateInventory, true);
    });
  }

  test("an unknown role cannot", () => {
    assert.equal(access("COWORKING_ADMIN").canCreateInventory, false);
  });
});

describe("review", () => {
  test("only ADMIN reviews by default", () => {
    assert.equal(access("ADMIN").canReviewInventoryRequests, true);
    assert.equal(access("MANAGER").canReviewInventoryRequests, false);
  });

  test("an approve grant allows it", () => {
    const granted = access("MANAGER", { enforcePageAccess: true, canPageAction: allGrants });
    assert.equal(granted.canReviewInventoryRequests, true);
  });
});

describe("status change", () => {
  test("sales roles may request one, partners may not", () => {
    for (const role of ["ADMIN", "MANAGER", "EXECUTIVE", "FIELD_EXECUTIVE"]) {
      assert.equal(access(role).canRequestStatusChange, true, role);
    }
    assert.equal(access("CHANNEL_PARTNER").canRequestStatusChange, false);
  });
});
