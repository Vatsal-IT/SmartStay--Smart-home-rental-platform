const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware");
const bookingController = require("../controllers/booking");

// Create booking for a listing
router.post(
  "/listings/:id/bookings",
  isLoggedIn,
  wrapAsync(bookingController.createBooking)
);

// View current user's bookings
router.get(
  "/bookings/my",
  isLoggedIn,
  wrapAsync(bookingController.myBookings)
);

// View bookings for listings owned by current user (requests)
router.get(
  "/bookings/owner",
  isLoggedIn,
  wrapAsync(bookingController.ownerBookings)
);

// Approve a booking
router.post(
  "/bookings/:bookingId/approve",
  isLoggedIn,
  wrapAsync(bookingController.approveBooking)
);

// Reject a booking
router.post(
  "/bookings/:bookingId/reject",
  isLoggedIn,
  wrapAsync(bookingController.rejectBooking)
);

module.exports = router;

