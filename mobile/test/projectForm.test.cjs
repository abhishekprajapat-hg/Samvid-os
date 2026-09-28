const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_FORM,
  buildProjectPayload,
  validateForm,
  toFormFromProject,
  applyUnitField,
  newUnit,
  DEFAULT_OFFICE,
} = require("../.test-build/modules/inventory/projectForm.js");

/*
 * The project form's rules, ported from web's Projects.jsx. A project saved
 * from the phone must be the record the desk would save, so the payload shape
 * per project type and the validation order are pinned.
 */

const base = (over = {}) => ({ ...DEFAULT_FORM, projectName: "Sunrise", totalLandArea: "20 Acres", startingRate: "1500", currentRate: "1800", status: "PRE_LAUNCH", ...over });

describe("validateForm", () => {
  test("asks for the category first", () => {
    assert.equal(validateForm(DEFAULT_FORM), "Project Category is required");
  });
  test("a residential project needs a type", () => {
    assert.equal(validateForm(base({ projectCategory: "RESIDENTIAL" })), "Project Type is required");
  });
  test("a building needs at least one BHK", () => {
    const form = base({ projectCategory: "RESIDENTIAL", projectType: "BUILDING", numberOfFlats: "40", numberOfFloors: "10", flatsPerFloor: "4" });
    assert.equal(validateForm(form), "At least one BHK configuration is required");
  });
  test("current rate cannot undercut starting rate", () => {
    const form = base({ projectCategory: "RESIDENTIAL", projectType: "PLOTTING", totalPlots: "10", currentRate: "1000" });
    assert.equal(validateForm(form), "Current Rate cannot be less than Starting Rate");
  });
  test("a bad mobile is caught", () => {
    const form = base({ projectCategory: "RESIDENTIAL", projectType: "PLOTTING", totalPlots: "10", ownerManagerMobile: "12345" });
    assert.equal(validateForm(form), "Owner / Manager Mobile must be a valid 10-digit number");
  });
  test("a commercial unit needs its dimensions", () => {
    const office = newUnit(DEFAULT_OFFICE, "OFF", "officeCode", 1);
    const form = base({ projectCategory: "COMMERCIAL", totalFloors: "5", officesPerFloor: "4", offices: [office] });
    assert.equal(validateForm(form), "Office 1: Length must be greater than 0");
  });
});

describe("buildProjectPayload", () => {
  test("a plotting project sends plot fields and no building fields", () => {
    const payload = buildProjectPayload(base({ projectCategory: "RESIDENTIAL", projectType: "PLOTTING", totalPlots: "10", plotSize: "CUSTOM", customPlotSize: " 1350 Sq.ft " }));
    assert.equal(payload.totalPlots, 10);
    assert.equal(payload.customPlotSize, "1350 Sq.ft");
    assert.equal(payload.plotsAvailable, 0);
    assert.equal(payload.numberOfFlats, undefined);
  });
  test("a commercial project clears its type and sends units", () => {
    const office = { ...newUnit(DEFAULT_OFFICE, "OFF", "officeCode", 1), length: "20", breadth: "10", floorNumber: "2" };
    const payload = buildProjectPayload(base({ projectCategory: "COMMERCIAL", projectType: "BUILDING", totalFloors: "5", officesPerFloor: "4", offices: [office] }));
    assert.equal(payload.projectType, "");
    assert.equal(payload.offices[0].officeCode, "OFF-001");
    assert.equal(payload.offices[0].length, 20);
    assert.equal(payload.offices[0].height, null);
  });
});

test("length and breadth fill in carpet area", () => {
  const office = newUnit(DEFAULT_OFFICE, "OFF", "officeCode", 1);
  const withLength = applyUnitField(office, "length", "20");
  assert.equal(withLength.carpetArea, "");
  assert.equal(applyUnitField(withLength, "breadth", "12.5").carpetArea, "250");
});

test("a saved project round-trips into the form as text", () => {
  const form = toFormFromProject({ projectName: "Skye", totalPlots: 12, siteLocation: { lat: 22.7, lng: 75.8 }, offices: [{ _id: "o1", officeCode: "OFF-1", length: 20 }] });
  assert.equal(form.totalPlots, "12");
  assert.equal(form.locationLat, "22.7");
  assert.equal(form.offices[0].length, "20");
  assert.equal(form.offices[0]._key, "o1");
});
