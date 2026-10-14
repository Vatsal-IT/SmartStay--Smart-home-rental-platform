const Booking = require("../models/booking");
const Listing = require("../models/listing");
const User = require("../models/user");

// Map user points to a discount percentage
function getDiscountPercent(points) {
  if (!points || points < 100) return 0;
  if (points >= 500) return 15;
  if (points >= 200) return 10;
  if (points >= 100) return 5;
  return 0;
}

module.exports.createBooking = async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate, guests } = req.body.booking;

  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found");
    return res.redirect("/listings");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start) || isNaN(end) || end <= start) {
    req.flash("error", "Please select a valid date range");
    return res.redirect(`/listings/${id}`);
  }

  const msPerNight = 1000 * 60 * 60 * 24;
  const nights = Math.round((end - start) / msPerNight);
  const baseTotalPrice = nights * listing.price;

  // Prevent overlapping bookings (pending or approved) for this listing
  const overlapping = await Booking.findOne({
    listing: listing._id,
    status: { $in: ["pending", "approved"] },
    startDate: { $lt: end },
    endDate: { $gt: start },
  });

  if (overlapping) {
    req.flash(
      "error",
      "This listing is already booked or requested for those dates. Please choose different dates."
    );
    return res.redirect(`/listings/${id}`);
  }

  // Apply discount based on the booking user's points,
  // but only when they book someone else's listing
  let discountPercent = 0;
  let discountAmount = 0;
  let finalPrice = baseTotalPrice;

  try {
    if (req.user && listing.owner && !listing.owner.equals(req.user._id)) {
      const user = await User.findById(req.user._id);
      const userPoints = user?.points || 0;
      discountPercent = getDiscountPercent(userPoints);
      if (discountPercent > 0) {
        discountAmount = Math.round((baseTotalPrice * discountPercent) / 100);
        finalPrice = baseTotalPrice - discountAmount;
      }
    }
  } catch (err) {
    console.error("Failed to calculate discount based on user points:", err);
  }

  const booking = new Booking({
    listing: listing._id,
    user: req.user._id,
    startDate: start,
    endDate: end,
    guests: guests || 1,
    totalPrice: finalPrice,
    originalTotalPrice: baseTotalPrice,
    discountPercent,
    discountAmount,
  });

  await booking.save();
  req.flash("success", "Booking created successfully!");
  res.redirect("/bookings/my");
};

module.exports.myBookings = async (req, res) => {
  const today = new Date();
  const bookings = await Booking.find({
    user: req.user._id,
    endDate: { $gte: today },
  }).populate("listing");
  res.render("bookings/my.ejs", { bookings });
};

module.exports.ownerBookings = async (req, res) => {
  // All bookings for listings owned by current user
  const listings = await Listing.find({ owner: req.user._id }).select("_id");
  const listingIds = listings.map((l) => l._id);

  const bookings = await Booking.find({ listing: { $in: listingIds } })
    .populate("listing")
    .populate("user");

  res.render("bookings/owner.ejs", { bookings });
};

module.exports.approveBooking = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId).populate("listing");

  if (!booking || !booking.listing) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/owner");
  }

  // Only the owner of the listing can approve
  if (!booking.listing.owner.equals(req.user._id)) {
    req.flash("error", "You are not allowed to approve this booking");
    return res.redirect("/bookings/owner");
  }

  booking.status = "approved";
  await booking.save();

  req.flash("success", "Booking approved");
  res.redirect("/bookings/owner");
};

module.exports.rejectBooking = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId).populate("listing");

  if (!booking || !booking.listing) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/owner");
  }

  if (!booking.listing.owner.equals(req.user._id)) {
    req.flash("error", "You are not allowed to reject this booking");
    return res.redirect("/bookings/owner");
  }

  booking.status = "rejected";
  await booking.save();

  req.flash("success", "Booking rejected");
  res.redirect("/bookings/owner");
};


