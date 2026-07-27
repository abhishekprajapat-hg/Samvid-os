import { describe, expect, it } from "vitest";
import {
  getAllVisibleMenuGroups,
  getSectionTarget,
  getVisibleSections,
} from "./workbenchNavigation";
import { ROLES, roleUsers, routeMatrix } from "../../test/testData";

const visiblePathsFor = (role) =>
  getAllVisibleMenuGroups(role, roleUsers[role])
    .flatMap((group) => group.items)
    .map((item) => item.path);

describe("workbench navigation role matrix", () => {
  it.each(ROLES)("shows only role-backed navigation for %s", (role) => {
    const visiblePaths = visiblePathsFor(role);
    const allowed = new Set(routeMatrix[role]);

    visiblePaths.forEach((path) => {
      expect(allowed.has(path), `${role} should be allowed for ${path}`).toBe(true);
    });
  });

  it("exposes Finance to Inside Executive because the route permits it", () => {
    expect(visiblePathsFor("INSIDE_EXECUTIVE")).toContain("/finance");
  });

  it("routes Production Executive reports section to performance targets", () => {
    expect(getVisibleSections("PRODUCTION_EXECUTIVE", roleUsers.PRODUCTION_EXECUTIVE).map((row) => row.id)).toContain("reports");
    expect(getSectionTarget("reports", "PRODUCTION_EXECUTIVE", roleUsers.PRODUCTION_EXECUTIVE)).toBe("/targets");
  });
});
