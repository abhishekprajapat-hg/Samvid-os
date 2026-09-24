const test = require('node:test');
const assert = require('node:assert/strict');
const Cabin = require('../src/models/CoworkingCabin');
const Booking = require('../src/models/CoworkingBooking');
const { assertAvailable, listAvailableCabins, bookingsConflict } = require('../src/services/coworkingAvailability.service');
test('whole-cabin booking refuses occupied, blocked and maintenance seats', async () => {
  const original = Cabin.findOne;
  try {
    for (const status of ['OCCUPIED', 'BLOCKED', 'MAINTENANCE']) {
      Cabin.findOne = () => ({ lean: async () => ({ manualOverride: 'NONE', seats: [{ seatCode: 'S1', status }] }) });
      await assert.rejects(assertAvailable({ bookingType: 'CABIN' }), /occupied|blocked|maintenance/);
    }
  } finally { Cabin.findOne = original; }
});
test('whole-cabin availability excludes cabins with unavailable seats', async () => {
  const findCabins = Cabin.find, findBookings = Booking.find;
  try {
    Cabin.find = () => ({ populate: () => ({ lean: async () => ['AVAILABLE','OCCUPIED','BLOCKED','MAINTENANCE'].map((status) => ({ _id: status, manualOverride: 'NONE', seats: [{ status }], capacity: 1 })) }) });
    Booking.find = () => ({ lean: async () => [] });
    const result = await listAvailableCabins({});
    assert.deepEqual(result.map((c) => c.cabinId), ['AVAILABLE']);
  } finally { Cabin.find = findCabins; Booking.find = findBookings; }
});
test('adjacent timed seats remain bookable while overlapping times conflict', () => {
  const existing = { startDate: '2026-09-08', endDate: '2026-09-08', startTime: '09:00', endTime: '10:00' };
  assert.equal(bookingsConflict(existing, { ...existing, startTime: '10:00', endTime: '11:00' }), false);
  assert.equal(bookingsConflict(existing, { ...existing, startTime: '09:30', endTime: '11:00' }), true);
});
