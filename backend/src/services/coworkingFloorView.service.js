const mongoose = require("mongoose");
const Cabin = require("../models/CoworkingCabin");
const Floor = require("../models/CoworkingFloor");
const Client = require("../models/CoworkingClient");
const Contract = require("../models/CoworkingContract");
const Booking = require("../models/CoworkingBooking");
const Invoice = require("../models/CoworkingInvoice");
const { createHttpError } = require("../utils/httpError");
const id = (value) => String(value?._id || value || "");

// Current occupancy comes from the live seat ledger and active agreements.
// History counts distinct former clients, not contract renewals or cancelled enquiries.
const summarizeCabin = (cabin, contracts, bookings, clients, invoices, access, now = new Date()) => {
  const day = now.toISOString().slice(0, 10);
  const date = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";
  const currentContracts = contracts.filter((c) => ["ACTIVE", "EXPIRING"].includes(c.status) && !c.supersededBy);
  const currentBookings = bookings.filter((b) => b.status === "ACTIVE");
  const reservations = bookings.filter((b) => ["PENDING", "CONFIRMED"].includes(b.status) && date(b.startDate) <= day && date(b.endDate) >= day);
  const upcoming = bookings.filter((b) => ["PENDING", "CONFIRMED"].includes(b.status) && date(b.startDate) > day);
  const occupied = new Set(cabin.seats.filter((s) => s.status === "OCCUPIED").map((s) => s.seatCode));
  for (const record of [...currentContracts, ...currentBookings]) {
    if ((record.contractType || record.bookingType) === "CABIN") cabin.seats.forEach((s) => occupied.add(s.seatCode));
    else if (record.seatCode) occupied.add(record.seatCode);
  }
  let status = "VACANT";
  if (cabin.manualOverride === "BLOCKED") status = "BLOCKED";
  else if (cabin.manualOverride === "MAINTENANCE") status = "MAINTENANCE";
  else if (occupied.size) status = "BOOKED";
  else if (reservations.length || cabin.seats.some((s) => s.status === "RESERVED")) status = "RESERVED";
  else if (cabin.seats.some((s) => s.status === "MAINTENANCE")) status = "MAINTENANCE";
  else if (cabin.seats.some((s) => s.status === "BLOCKED")) status = "BLOCKED";
  const currentIds = new Set([...currentContracts, ...currentBookings].map((r) => id(r.clientId)));
  cabin.seats.filter((s) => s.status === "OCCUPIED" && s.assignedTo?.clientId).forEach((s) => currentIds.add(id(s.assignedTo.clientId)));
  const clientInfo = (clientId) => clients.find((c) => id(c) === id(clientId)) || { _id: id(clientId), companyName: "Client record unavailable" };
  const recordInfo = (r, type) => ({ _id: r._id, type, code: r.contractCode || r.bookingCode, status: r.status, startDate: r.startDate, endDate: r.terminatedAt || r.endDate, seatCode: r.seatCode, wholeCabin: (r.contractType || r.bookingType) === "CABIN", ...(access[type === "contract" ? "contracts" : "bookings"] ? { amount: r.rent ?? r.price } : {}) });
  const currentClients = [...currentIds].filter(Boolean).map((clientId) => ({
    client: clientInfo(clientId),
    contracts: access.contracts ? currentContracts.filter((r) => id(r.clientId) === clientId).map((r) => recordInfo(r, "contract")) : [],
    bookings: access.bookings ? currentBookings.filter((r) => id(r.clientId) === clientId).map((r) => recordInfo(r, "booking")) : [],
    nextDueDate: access.billing ? invoices.filter((r) => id(r.clientId) === clientId && currentContracts.some((c) => id(c) === id(r.contractId))).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0]?.dueDate || null : null,
  }));
  const past = [...contracts.filter((c) => ["EXPIRED", "TERMINATED"].includes(c.status)).map((r) => ({ ...r, type: "contract" })), ...bookings.filter((b) => b.status === "COMPLETED").map((r) => ({ ...r, type: "booking" }))];
  const previousIds = [...new Set(past.map((r) => id(r.clientId)))].filter((clientId) => clientId && !currentIds.has(clientId));
  const previousClients = previousIds.map((clientId) => ({ client: clientInfo(clientId), stays: past.filter((r) => id(r.clientId) === clientId && access[r.type === "contract" ? "contracts" : "bookings"]).sort((a, b) => new Date(b.endDate) - new Date(a.endDate)).map((r) => recordInfo(r, r.type)) }));
  return {
    _id: cabin._id, name: cabin.name, cabinCode: cabin.cabinCode, floorId: cabin.floorId, propertyId: cabin.propertyId, capacity: cabin.capacity,
    status, occupiedSeats: occupied.size, blockReason: cabin.blockReason,
    monthlyRent: access.contracts ? cabin.monthlyRent : null, securityDeposit: access.contracts ? cabin.securityDeposit : null,
    currentClients: access.clients ? currentClients : [], previousClients: access.clients ? previousClients : [],
    previousClientCount: access.clients ? previousIds.length : null,
    reservations: access.clients ? reservations.map((r) => ({ client: clientInfo(r.clientId), ...(access.bookings ? recordInfo(r, "booking") : {}) })) : [],
    upcoming: access.clients ? upcoming.map((r) => ({ client: clientInfo(r.clientId), ...(access.bookings ? recordInfo(r, "booking") : {}) })) : [],
    unlinkedOccupants: cabin.seats.filter((s) => s.status === "OCCUPIED" && !s.assignedTo?.clientId).length,
  };
};

const getFloorView = async ({ companyId, floorId, access }) => {
  if (!mongoose.isValidObjectId(floorId)) throw createHttpError(400, "Select a valid floor");
  const floor = await Floor.findOne({ _id: floorId, companyId }).populate("propertyId", "name").lean();
  if (!floor) throw createHttpError(404, "Floor not found");
  const cabins = await Cabin.find({ companyId, floorId }).sort({ name: 1, cabinCode: 1 }).lean();
  const cabinIds = cabins.map((c) => c._id);
  const [contracts, bookings] = await Promise.all([
    Contract.find({ companyId, cabinId: { $in: cabinIds }, status: { $ne: "DRAFT" } }).select("-documents -notes").lean(),
    Booking.find({ companyId, cabinId: { $in: cabinIds }, status: { $in: ["PENDING", "CONFIRMED", "ACTIVE", "COMPLETED"] } }).select("-notes").lean(),
  ]);
  const clientIds = [...new Set([...contracts, ...bookings].map((r) => id(r.clientId)).concat(cabins.flatMap((c) => c.seats.map((s) => id(s.assignedTo?.clientId)))))] .filter(Boolean);
  const [clients, invoices] = await Promise.all([
    access.clients ? Client.find({ companyId, _id: { $in: clientIds } }).select("companyName contactPerson phone email clientCode").lean() : [],
    access.billing ? Invoice.find({ companyId, contractId: { $in: contracts.map((c) => c._id) }, status: { $in: ["PENDING", "PARTIALLY_PAID"] } }).select("clientId contractId dueDate").lean() : [],
  ]);
  const rows = cabins.map((c) => summarizeCabin(c, contracts.filter((r) => id(r.cabinId) === id(c)), bookings.filter((r) => id(r.cabinId) === id(c)), clients, invoices, access));
  const counts = { total: rows.length, VACANT: 0, BOOKED: 0, RESERVED: 0, BLOCKED: 0, MAINTENANCE: 0 };
  rows.forEach((r) => { counts[r.status] += 1; });
  return { floor, cabins: rows, counts, access, refreshedAt: new Date() };
};
module.exports = { getFloorView, summarizeCabin };
