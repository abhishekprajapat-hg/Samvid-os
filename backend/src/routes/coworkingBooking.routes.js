const express = require("express");
const router = express.Router();

const bookingController = require("../controllers/coworkingBooking.controller");
const { requirePermission } = require("../middleware/permission.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

router.get("/", requirePermission("bookings.view"), bookingController.listBookings);
router.get("/available-cabins", requirePermission("bookings.view"), bookingController.getAvailableCabins);
router.get("/available-seats", requirePermission("bookings.view"), bookingController.getAvailableSeats);
router.get("/cabins/:cabinId/calendar", requirePermission("bookings.view"), bookingController.getCabinCalendar);
router.get("/:bookingId", requirePermission("bookings.view"), bookingController.getBooking);

router.post("/", writeLimiter, requirePermission("bookings.create"), bookingController.createBooking);
router.patch("/:bookingId", writeLimiter, requirePermission("bookings.update"), bookingController.updateBooking);

router.post("/:bookingId/confirm", writeLimiter, requirePermission("bookings.update"), bookingController.confirmBooking);
router.post("/:bookingId/activate", writeLimiter, requirePermission("bookings.update"), bookingController.activateBooking);
router.post("/:bookingId/complete", writeLimiter, requirePermission("bookings.update"), bookingController.completeBooking);
router.post("/:bookingId/extend", writeLimiter, requirePermission("bookings.update"), bookingController.extendBooking);
router.post("/:bookingId/cancel", writeLimiter, requirePermission("bookings.cancel"), bookingController.cancelBooking);
router.post("/:bookingId/no-show", writeLimiter, requirePermission("bookings.cancel"), bookingController.markNoShow);

module.exports = router;
