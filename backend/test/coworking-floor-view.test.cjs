const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeCabin } = require('../src/services/coworkingFloorView.service');
const access = { clients: true, contracts: true, bookings: true, billing: true };
const now = new Date('2026-09-08T10:00:00Z');
const makeCabin = (statuses = ['AVAILABLE','AVAILABLE']) => ({ _id: 'cabin', name: 'B9', manualOverride: 'NONE', capacity: 2, seats: statuses.map((status, i) => ({ seatCode: `S${i+1}`, status })), monthlyRent: 28000, securityDeposit: 10000 });
const contract = (clientId, status, extra = {}) => ({ _id: `${clientId}-${status}`, clientId, status, contractType: 'CABIN', startDate: '2026-01-01', endDate: '2026-12-31', rent: 28000, ...extra });
const booking = (clientId, status, extra = {}) => ({ _id: `${clientId}-${status}`, clientId, status, bookingType: 'SEAT', seatCode: 'S1', startDate: '2026-09-08', endDate: '2026-09-08', ...extra });
const summarize = (cabin, contracts = [], bookings = [], rights = access) => summarizeCabin(cabin, contracts, bookings, [], [], rights, now);
test('vacant, partial occupancy, blocked and maintenance are exclusive cabin states', () => {
  assert.equal(summarize(makeCabin()).status, 'VACANT');
  const partial = summarize(makeCabin(['OCCUPIED','AVAILABLE']));
  assert.equal(partial.status, 'BOOKED'); assert.equal(partial.occupiedSeats, 1);
  assert.equal(summarize(makeCabin(['AVAILABLE','BLOCKED'])).status, 'BLOCKED');
  assert.equal(summarize(makeCabin(['AVAILABLE','MAINTENANCE'])).status, 'MAINTENANCE');
  assert.equal(summarize({ ...makeCabin(['OCCUPIED','OCCUPIED']), manualOverride: 'BLOCKED' }).status, 'BLOCKED');
});
test('active whole-cabin agreement occupies all seats even before the seat snapshot refreshes', () => {
  const result = summarize(makeCabin(), [contract('one', 'ACTIVE')]);
  assert.equal(result.status, 'BOOKED'); assert.equal(result.occupiedSeats, 2); assert.equal(result.currentClients[0].client._id, 'one');
});
test('today reservations and future reservations are distinguished', () => {
  assert.equal(summarize(makeCabin(), [], [booking('one', 'CONFIRMED')]).status, 'RESERVED');
  const future = summarize(makeCabin(), [], [booking('one', 'CONFIRMED', { startDate: '2026-10-01', endDate: '2026-10-02' })]);
  assert.equal(future.status, 'VACANT'); assert.equal(future.upcoming.length, 1);
});
test('history counts distinct ex-clients, excluding current clients, cancellations and no-shows', () => {
  const result = summarize(makeCabin(), [contract('current', 'ACTIVE'), contract('current', 'EXPIRED'), contract('past', 'EXPIRED'), contract('past', 'TERMINATED')], [booking('past', 'COMPLETED'), booking('second', 'COMPLETED'), booking('cancelled', 'CANCELLED'), booking('missing', 'NO_SHOW')]);
  assert.equal(result.previousClientCount, 2);
  assert.equal(result.previousClients.find((r) => r.client._id === 'past').stays.length, 3);
});
test('renewals and seat assignments are deduplicated for current occupants', () => {
  const cabin = makeCabin(['OCCUPIED', 'OCCUPIED']);
  cabin.seats.forEach((s) => { s.assignedTo = { clientId: 'one' }; });
  const result = summarize(cabin, [contract('one', 'ACTIVE', { supersededBy: 'new' }), contract('one', 'ACTIVE', { _id: 'new' })]);
  assert.equal(result.currentClients.length, 1); assert.equal(result.currentClients[0].contracts.length, 1);
});
test('client details and monetary fields honor the supplied permissions', () => {
  const result = summarize(makeCabin(), [contract('one', 'ACTIVE'), contract('past', 'EXPIRED')], [], { clients: false, contracts: false, bookings: false, billing: false });
  assert.equal(result.status, 'BOOKED'); assert.deepEqual(result.currentClients, []); assert.deepEqual(result.previousClients, []); assert.equal(result.previousClientCount, null); assert.equal(result.monthlyRent, null);
});
test('unpaid invoice is tied to the active agreement and earliest due date', () => {
  const result = summarizeCabin(makeCabin(), [contract('one', 'ACTIVE')], [], [{ _id:'one', companyName:'Tenant' }], [{ clientId:'one', contractId:'another', dueDate:'2026-01-01' }, { clientId:'one', contractId:'one-ACTIVE', dueDate:'2026-09-10' }, { clientId:'one', contractId:'one-ACTIVE', dueDate:'2026-09-07' }], access, now);
  assert.equal(result.currentClients[0].nextDueDate, '2026-09-07');
});
