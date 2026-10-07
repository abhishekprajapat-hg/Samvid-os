import assert from "node:assert/strict";
import test from "node:test";
import { DOCUMENT_SETS, kycStatusOf } from "../src/modules/coworking/booking/kycDocuments.js";

// 30 Sep 2026 update (R8): room for a second person / second signing authority.
const requiredKeys = (kind) => DOCUMENT_SETS[kind].filter((doc) => doc.required).map((doc) => doc.key).sort();

test("every client type has Person 2 (or Signing authority 2) documents, all optional", () => {
  for (const kind of ["individual", "proprietorship"]) {
    const keys = DOCUMENT_SETS[kind].map((doc) => doc.key);
    for (const key of ["aadhaar", "aadhaar2", "pan", "pan2", "policeVerification", "policeVerification2"]) {
      assert.ok(keys.includes(key), `${kind} has ${key}`);
    }
    assert.ok(DOCUMENT_SETS[kind].filter((doc) => doc.group === "Person 2").every((doc) => !doc.required));
  }
  const company = DOCUMENT_SETS.company.map((doc) => doc.key);
  for (const key of ["signatureAuthority", "signatureAuthority2", "signatureAuthorityAadhaar", "signatureAuthorityAadhaar2", "signatoryPan", "signatoryPan2", "policeVerification", "policeVerification2"]) {
    assert.ok(company.includes(key), `company has ${key}`);
  }
  assert.ok(DOCUMENT_SETS.company.filter((doc) => doc.group === "Signing authority 2").every((doc) => !doc.required));
});

test("the required documents did not change, so existing clients keep their KYC status", () => {
  assert.deepEqual(requiredKeys("individual"), ["aadhaar", "pan", "photo", "policeVerification", "rentAgreement"]);
  assert.deepEqual(requiredKeys("proprietorship"), ["aadhaar", "gumasta", "msme", "pan", "photo", "policeVerification", "rentAgreement"]);
  assert.deepEqual(requiredKeys("company"), ["authorisationLetter", "coi", "companyPan", "photo", "policeVerification", "rentAgreement", "signatureAuthority", "signatureAuthorityAadhaar"]);
  const documents = requiredKeys("individual").map((key) => ({ key, status: "PENDING" }));
  assert.equal(kycStatusOf({ kind: "individual", documents }).complete, true);
});
