const Booking = require("../models/booking");
const Listing = require("../models/listing");
const User = require("../models/user");
const Payment = require("../models/payment");
const crypto = require("crypto");
const { getRazorpayInstance } = require("../utils/razorpay");

// Map user points to a discount percentage
function getDiscountPercent(points) {
  if (!points || points < 100) return 0;
  if (points >= 500) return 15;
  if (points >= 200) return 10;
  if (points >= 100) return 5;
  return 0;
}

function isExpired(booking) {
  return (
    booking &&
    booking.status === "accepted" &&
    booking.paymentStatus === "unpaid" &&
    booking.expiresAt &&
    new Date(booking.expiresAt).getTime() <= Date.now()
  );
}

async function expireIfNeeded(booking) {
  if (!booking) return booking;
  if (isExpired(booking)) {
    booking.status = "expired";
    await booking.save();
  }
  return booking;
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

  // Prevent overlapping bookings for this listing.
  // We block pending too to keep the UX simple and avoid multiple owners accepting conflicts.
  const overlapping = await Booking.findOne({
    listing: listing._id,
    status: { $in: ["pending", "accepted", "confirmed"] },
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
  req.flash("success", "Booking request sent to owner!");
  res.redirect("/bookings/my");
};

module.exports.myBookings = async (req, res) => {
  const today = new Date();
  const bookings = await Booking.find({
    user: req.user._id,
    endDate: { $gte: today },
  })
    .populate("listing")
    .sort({ createdAt: -1 });

  // Soft-expire any accepted-but-unpaid bookings when user views them
  await Promise.all(bookings.map((b) => expireIfNeeded(b)));
  
  const keyId = process.env.RAZORPAY_KEY_ID;
  res.render("bookings/my.ejs", { bookings, razorpayKeyId: keyId || "mock_key" });
};

module.exports.ownerBookings = async (req, res) => {
  // All bookings for listings owned by current user
  const listings = await Listing.find({ owner: req.user._id }).select("_id");
  const listingIds = listings.map((l) => l._id);

  const bookings = await Booking.find({ listing: { $in: listingIds } })
    .populate("listing")
    .populate("user")
    .sort({ createdAt: -1 });

  await Promise.all(bookings.map((b) => expireIfNeeded(b)));

  res.render("bookings/owner.ejs", { bookings });
};

module.exports.approveBooking = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId).populate("listing");

  if (!booking || !booking.listing) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/owner");
  }

  await expireIfNeeded(booking);
  if (booking.status !== "pending") {
    req.flash("error", "Only pending bookings can be accepted");
    return res.redirect("/bookings/owner");
  }

  // Only the owner of the listing can approve
  if (!booking.listing.owner.equals(req.user._id)) {
    req.flash("error", "You are not allowed to approve this booking");
    return res.redirect("/bookings/owner");
  }

  booking.status = "accepted";
  booking.acceptedAt = new Date();
  const holdMinutes = parseInt(process.env.BOOKING_HOLD_MINUTES || "30", 10);
  booking.expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);
  await booking.save();

  req.flash("success", "Booking accepted. Guest can now pay.");
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
  booking.rejectedAt = new Date();
  await booking.save();

  req.flash("success", "Booking rejected");
  res.redirect("/bookings/owner");
};

module.exports.payPage = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId).populate("listing");
  if (!booking || !booking.listing) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/my");
  }

  await expireIfNeeded(booking);

  if (!booking.user.equals(req.user._id)) {
    req.flash("error", "You are not allowed to pay for this booking");
    return res.redirect("/bookings/my");
  }

  if (booking.status !== "accepted" || booking.paymentStatus !== "unpaid") {
    req.flash("error", "This booking is not payable");
    return res.redirect("/bookings/my");
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  res.render("bookings/pay.ejs", { booking, razorpayKeyId: keyId || "mock_key" });
};

module.exports.initiatePayment = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId).populate("listing");
  if (!booking || !booking.listing) {
    return res.status(404).json({ ok: false, message: "Booking not found" });
  }

  await expireIfNeeded(booking);

  if (!booking.user.equals(req.user._id)) {
    return res.status(403).json({ ok: false, message: "Not allowed" });
  }

  if (booking.status !== "accepted" || booking.paymentStatus !== "unpaid") {
    return res.status(400).json({ ok: false, message: "Booking is not payable" });
  }

  const amountPaise = Math.round(booking.totalPrice * 100);
  const razorpay = getRazorpayInstance();

  const order = await razorpay.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: `booking_${booking._id}`,
    notes: {
      bookingId: String(booking._id),
      listingId: String(booking.listing._id),
      userId: String(booking.user),
    },
  });

  const payment = await Payment.create({
    booking: booking._id,
    user: booking.user,
    listing: booking.listing._id,
    amount: amountPaise,
    currency: "INR",
    status: "created",
    razorpayOrderId: order.id,
    notes: order.notes,
  });

  return res.json({
    ok: true,
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    },
    booking: { id: booking._id },
    payment: { id: payment._id },
  });
};

module.exports.verifyPayment = async (req, res) => {
  const { bookingId } = req.params;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ ok: false, message: "Missing payment fields" });
  }

  const booking = await Booking.findById(bookingId).populate("listing");
  if (!booking || !booking.listing) {
    return res.status(404).json({ ok: false, message: "Booking not found" });
  }

  await expireIfNeeded(booking);

  if (!booking.user.equals(req.user._id)) {
    return res.status(403).json({ ok: false, message: "Not allowed" });
  }

  if (booking.status !== "accepted" || booking.paymentStatus !== "unpaid") {
    return res.status(400).json({ ok: false, message: "Booking is not payable" });
  }

  const payment = await Payment.findOne({
    booking: booking._id,
    razorpayOrderId: razorpay_order_id,
  });

  if (!payment) {
    return res.status(404).json({ ok: false, message: "Payment record not found" });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return res.status(500).json({ ok: false, message: "Payment not configured" });
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const isValid = expected === razorpay_signature;

  if (!isValid) {
    payment.status = "failed";
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    await payment.save();

    return res.status(400).json({ ok: false, message: "Signature verification failed" });
  }

  // Mark paid
  payment.status = "paid";
  payment.razorpayPaymentId = razorpay_payment_id;
  payment.razorpaySignature = razorpay_signature;
  await payment.save();

  booking.paymentStatus = "paid";
  booking.status = "confirmed";
  booking.confirmedAt = new Date();
  booking.expiresAt = undefined;
  await booking.save();

  return res.json({ ok: true, message: "Payment verified", bookingId: booking._id });
};

module.exports.mockPayment = async (req, res) => {
  const { bookingId } = req.params;

  const booking = await Booking.findById(bookingId).populate("listing");
  if (!booking || !booking.listing) {
    return res.status(404).json({ ok: false, message: "Booking not found" });
  }

  await expireIfNeeded(booking);

  if (!booking.user.equals(req.user._id)) {
    return res.status(403).json({ ok: false, message: "Not allowed" });
  }

  if (booking.status !== "accepted" || booking.paymentStatus !== "unpaid") {
    return res.status(400).json({ ok: false, message: "Booking is not payable" });
  }

  // Create mock payment record
  const amountPaise = Math.round(booking.totalPrice * 100);
  const payment = await Payment.create({
    booking: booking._id,
    user: booking.user,
    listing: booking.listing._id,
    amount: amountPaise,
    currency: "INR",
    status: "paid",
    razorpayOrderId: "MOCK_ORDER_" + Date.now(),
    razorpayPaymentId: "MOCK_PAY_" + Date.now(),
    razorpaySignature: "MOCK_SIG",
    notes: { method: "mock_success" },
  });

  // Mark booking as confirmed
  booking.paymentStatus = "paid";
  booking.status = "confirmed";
  booking.confirmedAt = new Date();
  booking.expiresAt = undefined;
  await booking.save();

  return res.json({ ok: true, message: "Payment successful (Mock)", bookingId: booking._id });
};


