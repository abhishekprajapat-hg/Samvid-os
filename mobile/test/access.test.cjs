const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  canSeeItem,
  canAccessPage,
  getTabItems,
  getVisibleItems,
  getMoreGroups,
} = require("../.test-build/navigation/access.js");
const { ALL_NAV_ITEMS, ROLE_ONLY_PAGES } = require("../.test-build/navigation/navigationCatalogue.js");

/*
 * Covers every branch of canSeeItem, the port of roleCanSeeItem() from
 * frontend/src/components/workbench/workbenchNavigation.js.
 *
 * This is the Phase 2 gate. The algorithm decides what each of the eight roles
 * can reach, so a regression here silently shows someone a screen the API will
 * refuse - or hides one they are entitled to.
 *
 * Run: npm test
 */

const item = (page) => {
  const found = ALL_NAV_ITEMS.find((candidate) => candidate.page === page);
  assert.ok(found, `no nav item for page "${page}"`);
  return found;
};

const grant = (...pages) => pages.map((page) => `page.${page}.view`);

describe("role defaults", () => {
  test("a role in the item's list can see it", () => {
    assert.equal(canSeeItem(item("leads"), "ADMIN"), true);
    assert.equal(canSeeItem(item("leads"), "MANAGER"), true);
  });

  test("a role outside the item's list cannot", () => {
    // /leads is ADMIN, MANAGER, CHANNEL_PARTNER - executives get /my-leads.
    assert.equal(canSeeItem(item("leads"), "EXECUTIVE"), false);
    assert.equal(canSeeItem(item("my_leads"), "EXECUTIVE"), true);
  });

  test("reports are management-only", () => {
    assert.equal(canSeeItem(item("reports"), "MANAGER"), true);
    assert.equal(canSeeItem(item("reports"), "FIELD_EXECUTIVE"), false);
  });

  test("a null role sees nothing", () => {
    assert.equal(canSeeItem(item("dashboard"), null), false);
  });
});

describe("explicit page grants (enforcePageAccess)", () => {
  const configured = (pages) => ({
    enforcePageAccess: true,
    permissions: grant(...pages),
  });

  test("a grant widens access beyond the role list", () => {
    // FIELD_EXECUTIVE is not in the /reports role list, but an explicit grant
    // is allowed to add it because reports is not a ROLE_ONLY page.
    assert.equal(canSeeItem(item("reports"), "FIELD_EXECUTIVE", configured(["reports"])), true);
  });

  test("absence of a grant revokes a page the role would otherwise have", () => {
    assert.equal(canSeeItem(item("my_leads"), "EXECUTIVE", configured(["dashboard"])), false);
  });

  test("ADMIN ignores page configuration entirely", () => {
    assert.equal(canSeeItem(item("settings"), "ADMIN", configured([])), true);
    assert.equal(canSeeItem(item("leads"), "ADMIN", configured([])), true);
  });

  test("enforcePageAccess off means role defaults still decide", () => {
    const user = { enforcePageAccess: false, permissions: grant("reports") };
    assert.equal(canSeeItem(item("reports"), "FIELD_EXECUTIVE", user), false);
  });

  test("a null permission list is treated as not-yet-configured", () => {
    const user = { enforcePageAccess: true, permissions: null };
    assert.equal(canSeeItem(item("my_leads"), "EXECUTIVE", user), true);
  });
});

describe("ROLE_ONLY pages narrow but never widen", () => {
  for (const page of ROLE_ONLY_PAGES) {
    test(`${page}: a grant cannot hand it to a non-management role`, () => {
      const user = { enforcePageAccess: true, permissions: grant(page) };
      // These APIs are hard-gated on ADMIN/MANAGER, so widening would render a
      // screen that cannot load.
      assert.equal(canSeeItem(item(page), "EXECUTIVE", user), false);
    });

    test(`${page}: a grant can still be revoked from a configured manager`, () => {
      const user = { enforcePageAccess: true, permissions: grant("dashboard") };
      assert.equal(canSeeItem(item(page), "MANAGER", user), false);
    });

    test(`${page}: a configured manager holding the grant keeps it`, () => {
      const user = { enforcePageAccess: true, permissions: grant(page) };
      assert.equal(canSeeItem(item(page), "MANAGER", user), true);
    });
  }
});

describe("channel partner inventory", () => {
  test("hidden without canViewInventory", () => {
    assert.equal(canSeeItem(item("inventory"), "CHANNEL_PARTNER", { canViewInventory: false }), false);
  });

  test("visible with canViewInventory", () => {
    assert.equal(canSeeItem(item("inventory"), "CHANNEL_PARTNER", { canViewInventory: true }), true);
  });

  test("the flag does not affect other roles", () => {
    assert.equal(canSeeItem(item("inventory"), "EXECUTIVE", { canViewInventory: false }), true);
  });
});

describe("coworking permissions", () => {
  test("hidden from a coworking role lacking the permission", () => {
    const user = { permissions: ["clients.view"] };
    assert.equal(canSeeItem(item("coworking_booking"), "COWORKING_ADMIN", user), false);
  });

  test("visible with the permission", () => {
    const user = { permissions: ["cabins.view"] };
    assert.equal(canSeeItem(item("coworking_booking"), "COWORKING_ADMIN", user), true);
  });

  test("not hidden while permissions are still loading", () => {
    // null means "not fetched yet" - hiding here makes the nav flicker; the
    // screen's own gate catches it once loaded.
    assert.equal(canSeeItem(item("coworking_booking"), "COWORKING_ADMIN", { permissions: null }), true);
  });

  test("ADMIN bypasses the permission check", () => {
    assert.equal(canSeeItem(item("coworking_booking"), "ADMIN", { permissions: [] }), true);
  });

  test("a non-coworking role is excluded by its role list first", () => {
    const user = { permissions: ["cabins.view"] };
    assert.equal(canSeeItem(item("coworking_booking"), "EXECUTIVE", user), false);
  });
});

describe("tab selection", () => {
  const ROLES = [
    "ADMIN", "MANAGER", "EXECUTIVE", "FIELD_EXECUTIVE",
    "PRODUCTION_EXECUTIVE", "COMMUNITY_MANAGER", "CHANNEL_PARTNER", "COWORKING_ADMIN",
  ];

  for (const role of ROLES) {
    test(`${role} gets at least one tab and no duplicates`, () => {
      const tabs = getTabItems(role, { canViewInventory: true });
      assert.ok(tabs.length > 0, `${role} has no tabs`);
      assert.ok(tabs.length <= 4, `${role} has ${tabs.length} tabs, max is 4`);

      const screens = tabs.map((tab) => tab.screen);
      assert.equal(new Set(screens).size, screens.length, `${role} has duplicate tabs`);
    });

    test(`${role} only gets tabs it can actually see`, () => {
      const user = { canViewInventory: true };
      const visible = new Set(getVisibleItems(role, user).map((navItem) => navItem.page));
      for (const tab of getTabItems(role, user)) {
        assert.ok(visible.has(tab.page), `${role} got tab "${tab.page}" it cannot see`);
      }
    });
  }

  test("Pipeline and My Leads never both become tabs", () => {
    // Both map to the same screen; two tabs pointing at it would be a bug.
    for (const role of ROLES) {
      const screens = getTabItems(role, { canViewInventory: true }).map((tab) => tab.screen);
      assert.equal(screens.filter((screen) => screen === "Leads").length <= 1, true);
    }
  });

  test("a configured role with a single grant still lands somewhere", () => {
    const user = { enforcePageAccess: true, permissions: grant("dashboard") };
    assert.ok(getTabItems("EXECUTIVE", user).length > 0);
  });
});

describe("More screen", () => {
  test("excludes whatever is already a tab", () => {
    const user = { canViewInventory: true };
    const tabs = getTabItems("ADMIN", user);
    const tabScreens = tabs.map((tab) => tab.screen);
    const groups = getMoreGroups("ADMIN", user, tabScreens);

    for (const group of groups) {
      for (const groupItem of group.items) {
        assert.ok(!tabScreens.includes(groupItem.screen), `"${groupItem.label}" is both a tab and a More row`);
      }
    }
  });

  test("never returns an empty group", () => {
    for (const group of getMoreGroups("EXECUTIVE", {}, [])) {
      assert.ok(group.items.length > 0, `group "${group.group}" is empty`);
    }
  });
});

describe("canAccessPage matches canSeeItem", () => {
  test("agrees for every page and role", () => {
    const roles = ["ADMIN", "MANAGER", "EXECUTIVE", "CHANNEL_PARTNER"];
    for (const role of roles) {
      for (const navItem of ALL_NAV_ITEMS) {
        const user = { canViewInventory: true };
        if (canSeeItem(navItem, role, user)) {
          assert.equal(
            canAccessPage(navItem.page, role, user),
            true,
            `${role} can see ${navItem.page} but canAccessPage says no`,
          );
        }
      }
    }
  });

  test("an unknown page is not treated as gated", () => {
    assert.equal(canAccessPage("not_a_page", "EXECUTIVE"), true);
  });
});
