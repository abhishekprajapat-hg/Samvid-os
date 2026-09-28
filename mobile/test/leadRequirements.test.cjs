const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  mapLeadRequirementsToDraft,
  buildLeadRequirementsPayloadFromDraft,
  validateLeadRequirementDraft,
  withSubtypeField,
  toPreferredLocationsList,
  toCoworkingPayload,
  CUSTOM_NUMBER_OPTION_VALUE,
} = require("../.test-build/modules/leads/leadRequirements.js");

/*
 * The server replaces a lead's requirements whole on every save. Before this
 * module, a status change made on the phone rebuilt them without the subtype,
 * its preferences or the coworking terms, and so erased them. These tests
 * round-trip each of those.
 */

const roundTrip = (requirements) => buildLeadRequirementsPayloadFromDraft(mapLeadRequirementsToDraft(requirements));

describe("round trip keeps what the desk entered", () => {
  test("subtype and its preferences survive a save", () => {
    const payload = roundTrip({
      inventoryType: "COMMERCIAL",
      propertySubtype: "office",
      subtypeData: { seats: "12", pantry: true },
      transactionType: "RENT",
      budgetMin: 50000,
      budgetMax: 90000,
    });
    assert.equal(payload.propertySubtype, "OFFICE");
    assert.deepEqual(payload.subtypeData, { seats: "12", pantry: true });
    assert.equal(payload.transactionType, "RENT");
    assert.equal(payload.budgetMin, 50000);
    /* With a subtype, the legacy blocks are not written - web does the same. */
    assert.equal(payload.commercial, undefined);
  });

  test("coworking terms survive a save", () => {
    const payload = roundTrip({
      inventoryType: "COWORKING",
      coworking: { cabins: [{ seats: 4 }, { seats: 6 }, { seats: 0 }], workstations: 3, lockInMonths: 12 },
    });
    assert.deepEqual(payload.coworking.cabins, [{ seats: 4 }, { seats: 6 }]);
    assert.equal(payload.coworking.workstations, 3);
    assert.equal(payload.coworking.lockInMonths, 12);
    assert.equal(payload.coworking.agreedRent, null);
  });

  test("a lead without a subtype keeps its legacy blocks", () => {
    const payload = roundTrip({
      inventoryType: "RESIDENTIAL",
      residential: { bhkType: "2bhk", floor: 4, amenities: { lift: true, gasPipeline: true } },
    });
    assert.equal(payload.residential.bhkType, "2BHK");
    assert.equal(payload.residential.floor, 4);
    assert.equal(payload.residential.amenities.lift, true);
    assert.equal(payload.residential.amenities.gasPipeline, true);
  });

  test("an unfinished custom number is not sent", () => {
    const payload = roundTrip({
      inventoryType: "COMMERCIAL",
      propertySubtype: "OFFICE",
      subtypeData: { seats: CUSTOM_NUMBER_OPTION_VALUE, cabins: "2" },
    });
    assert.deepEqual(payload.subtypeData, { cabins: "2" });
  });
});

describe("validation", () => {
  test("min above max is refused, in plot wording for a plot", () => {
    assert.equal(validateLeadRequirementDraft({ budgetMin: "10", budgetMax: "5" }), "Budget Min cannot be greater than Budget Max");
    assert.equal(
      validateLeadRequirementDraft({ propertySubtype: "PLOT", budgetMin: "10", budgetMax: "5" }),
      "Budget Range minimum cannot be greater than maximum",
    );
  });

  test("a negative number in a preference is refused", () => {
    const error = validateLeadRequirementDraft({
      inventoryType: "RESIDENTIAL",
      propertySubtype: "PLOT",
      subtypeData: { plotLength: "-3" },
    });
    assert.equal(error, "Plot Length cannot be negative");
  });
});

describe("helpers", () => {
  test("plot area follows length and width", () => {
    const next = withSubtypeField({ plotLength: "40" }, "plotWidth", "62.5");
    assert.equal(next.plotArea, "2500");
    assert.equal(withSubtypeField({ plotLength: "3.3" }, "plotWidth", "3").plotArea, "9.9");
  });

  test("preferred localities are trimmed, deduped and capped", () => {
    assert.deepEqual(toPreferredLocationsList(" Vijay Nagar, palasia,\nVIJAY NAGAR ,, Sch 54"), ["Vijay Nagar", "palasia", "Sch 54"]);
    const many = Array.from({ length: 30 }, (_, i) => `Area ${i}`).join(",");
    assert.equal(toPreferredLocationsList(many).length, 20);
  });

  test("coworking payload drops empty cabins and blank numbers", () => {
    assert.deepEqual(toCoworkingPayload({ cabins: [{ seats: "" }, { seats: "8" }], workstations: "" }), {
      cabins: [{ seats: 8 }],
      workstations: null,
      depositMonths: null,
      agreedRent: null,
      noticePeriodMonths: null,
      lockInMonths: null,
    });
  });
});
