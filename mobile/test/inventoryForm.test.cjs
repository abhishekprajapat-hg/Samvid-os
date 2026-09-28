const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  toInventoryForm,
  prepareInventorySave,
  buildSaleDetails,
  withDimension,
  withSubtype,
  withDealType,
  withInventoryType,
  toSiteLocationPayload,
  normalizeInventoryCategory,
  defaultInventoryFormFor,
} = require("../.test-build/modules/inventory/inventoryForm.js");

/*
 * Web's property form rules, ported. An edit from the phone must save the
 * record an edit from the desk would, and must not drop what it does not show.
 */

const asset = {
  _id: "a1",
  propertyId: "OOR-102",
  projectName: "Skyline",
  inventoryType: "COMMERCIAL",
  type: "Rent",
  category: "office",
  status: "Available",
  location: "Vijay Nagar",
  city: "Indore",
  rent: 90000,
  price: null,
  siteLocation: { lat: 22.75, lng: 75.89 },
  ownerName: "R. Sharma",
  ownerWhatsappNumber: "9876543210",
  ownerType: "2ND",
  documentsAvailable: { registry: true },
  commercialDetails: {
    officeType: "OFFICE",
    subtypeData: { seats: "20", pantry: true },
    amenities: { cafeteria: true, washroomType: "PRIVATE" },
    buildingDetails: { securityType: "GUARDED", fireSafety: true },
    availability: { readyToMove: true, availableFrom: "2026-10-01T00:00:00.000Z" },
  },
  images: ["/api/uploads/files/a.jpg"],
  videoTours: ["https://youtu.be/x"],
};

describe("edit round trip", () => {
  test("a property read into the form saves back what it held", () => {
    const result = prepareInventorySave(toInventoryForm(asset));
    assert.equal(result.error, undefined);
    const p = result.payload;
    assert.equal(p.propertyId, "OOR-102");
    assert.equal(p.title, "Skyline");
    assert.equal(p.rent, 90000);
    assert.equal(p.price, null);
    assert.equal(p.category, "Office");
    assert.deepEqual(p.siteLocation, { lat: 22.75, lng: 75.89 });
    assert.equal(p.ownerWhatsappNumber, "9876543210");
    assert.equal(p.ownerType, "2ND");
    assert.equal(p.documentsAvailable.registry, true);
    assert.equal(p.documentsAvailable.loanNoc, false);
    assert.deepEqual(p.videoTours, ["https://youtu.be/x"]);
  });

  test("hidden legacy details and subtype preferences survive", () => {
    const p = prepareInventorySave(toInventoryForm(asset)).payload;
    const c = p.commercialDetails;
    assert.equal(c.officeType, "OFFICE");
    assert.deepEqual(c.subtypeData, { seats: "20", pantry: true });
    assert.equal(c.officeLayout.seats, 20);
    assert.equal(c.amenities.pantry, true);
    assert.equal(c.amenities.cafeteria, true);
    assert.equal(c.amenities.washroomType, "PRIVATE");
    assert.equal(c.buildingDetails.securityType, "GUARDED");
    assert.equal(c.buildingDetails.fireSafety, true);
    assert.equal(c.availability.readyToMove, true);
    assert.equal(c.availability.availableFrom, "2026-10-01");
    assert.equal(p.residentialDetails, undefined);
  });
});

describe("checks, in web's order", () => {
  test("name and location first", () => {
    const form = { ...defaultInventoryFormFor("COMMERCIAL"), price: "100" };
    assert.equal(prepareInventorySave(form).error, "Property name and location are required");
    /* City, area and pincode stand in for a missing location. */
    const ok = prepareInventorySave({ ...form, title: "X", city: "Indore" });
    assert.equal(ok.payload.location, "Indore");
  });

  test("price for a sale, rent for a rental", () => {
    const base = { ...defaultInventoryFormFor("COMMERCIAL"), title: "X", location: "Y" };
    assert.equal(prepareInventorySave(base).error, "Price is required for Sale listings");
    assert.equal(prepareInventorySave({ ...base, type: "Rent" }).error, "Rent is required for Rent listings");
    assert.equal(prepareInventorySave({ ...base, type: "Both", price: "5" }).error, "Rent is required for Rent listings");
  });

  test("coordinates come in pairs and in range", () => {
    assert.equal(toSiteLocationPayload({ lat: "22", lng: "" }).error, "Enter both latitude and longitude, or leave both empty");
    assert.equal(toSiteLocationPayload({ lat: "95", lng: "10" }).error, "Invalid latitude/longitude range");
    assert.equal(toSiteLocationPayload({ lat: "", lng: "" }).value, null);
  });

  test("a sold property needs its sale details", () => {
    const sold = { ...defaultInventoryFormFor("COMMERCIAL"), status: "Sold" };
    assert.equal(buildSaleDetails(sold).error, "Lead selection is required when status is Sold");
    const partial = { ...sold, saleLeadId: "l1", salePaymentMode: "UPI", salePaymentType: "PARTIAL", saleTotalAmount: "100" };
    assert.equal(buildSaleDetails(partial).error, "Remaining amount is required for partial payment");
    assert.equal(buildSaleDetails({ ...partial, saleRemainingAmount: "20" }).error, "Payment reference is required for non-cash sold payment");
    const done = buildSaleDetails({ ...partial, saleRemainingAmount: "20", salePaymentReference: "UTR1" }, new Date("2026-09-28T00:00:00Z"));
    assert.equal(done.value.remainingAmount, 20);
    assert.equal(done.value.soldAt, "2026-09-28T00:00:00.000Z");
  });
});

describe("field rules", () => {
  test("length × width fills the carpet area", () => {
    const form = withDimension(withDimension(defaultInventoryFormFor("COMMERCIAL"), "length", "40"), "width", "62.5");
    assert.equal(form.totalArea, "2500");
  });

  test("a new subtype resets preferences and sets the category", () => {
    const form = { ...defaultInventoryFormFor("RESIDENTIAL"), inventorySubtypeData: { bhk: "2" }, furnishingStatus: "SEMI_FURNISHED" };
    const next = withSubtype(form, "APARTMENT", true);
    assert.equal(next.residentialPropertyType, "FLAT");
    assert.equal(next.category, "Flat");
    assert.deepEqual(next.inventorySubtypeData, {});
    assert.equal(withSubtype(form, "PLOT", false).furnishingStatus, "");
  });

  test("switching deal type clears the price that no longer applies", () => {
    const form = { ...defaultInventoryFormFor("COMMERCIAL"), price: "5", rent: "7", deposit: "9" };
    assert.equal(withDealType(form, "Rent").price, "");
    const sale = withDealType(form, "Sale");
    assert.equal(sale.rent, "");
    assert.equal(sale.deposit, "");
  });

  test("switching inventory type resets category and preferences", () => {
    const next = withInventoryType({ ...defaultInventoryFormFor("COMMERCIAL"), inventorySubtypeData: { seats: 3 } }, "RESIDENTIAL");
    assert.equal(next.category, "Flat");
    assert.deepEqual(next.inventorySubtypeData, {});
  });

  test("categories normalise as web does", () => {
    assert.equal(normalizeInventoryCategory("managed_office"), "Managed Office");
    assert.equal(normalizeInventoryCategory("villa", "RESIDENTIAL"), "House");
    assert.equal(normalizeInventoryCategory("unknown"), "Office");
  });
});
