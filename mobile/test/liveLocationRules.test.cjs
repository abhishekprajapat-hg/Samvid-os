const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  initialLocationSyncState,
  shouldSendLocation,
  calculateDistanceMeters,
  LOCATION_SYNC_MIN_INTERVAL_MS,
} = require("../.test-build/utils/liveLocationRules.js");

/*
 * The live-location throttle, ported from frontend/src/App.jsx. Field Ops'
 * map is drawn from these sends, so both halves matter: sending too rarely
 * leaves an executive stale on the map, too often drains a phone battery.
 */

const NOW = 1_800_000_000_000;
const sent = (over = {}) => ({ ...initialLocationSyncState(), lastLat: 22.7196, lastLng: 75.8577, lastSentAt: NOW, ...over });

describe("shouldSendLocation", () => {
  test("the first fix is always sent", () => {
    assert.equal(shouldSendLocation(initialLocationSyncState(), 22.7196, 75.8577, NOW), true);
  });

  test("a second fix in the same place, seconds later, is not", () => {
    assert.equal(shouldSendLocation(sent(), 22.7196, 75.8577, NOW + 5000), false);
  });

  test("the same place is re-sent once the interval passes", () => {
    assert.equal(shouldSendLocation(sent(), 22.7196, 75.8577, NOW + LOCATION_SYNC_MIN_INTERVAL_MS), true);
  });

  test("moving 30 metres sends immediately", () => {
    // ~0.0003 degrees of latitude is ~33 m.
    assert.equal(shouldSendLocation(sent(), 22.7199, 75.8577, NOW + 1000), true);
  });

  test("moving 10 metres does not", () => {
    assert.equal(shouldSendLocation(sent(), 22.71969, 75.8577, NOW + 1000), false);
  });

  test("nothing is sent while a send is in flight", () => {
    assert.equal(shouldSendLocation({ ...initialLocationSyncState(), inFlight: true }, 22.7, 75.8, NOW), false);
  });

  test("a non-numeric fix is ignored", () => {
    assert.equal(shouldSendLocation(initialLocationSyncState(), NaN, 75.8, NOW), false);
  });
});

describe("calculateDistanceMeters", () => {
  test("one degree of latitude is about 111 km", () => {
    const d = calculateDistanceMeters(0, 0, 1, 0);
    assert.ok(Math.abs(d - 111195) < 50, `got ${d}`);
  });
});
