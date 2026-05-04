const Booking = require("../models/booking");
const Listing = require("../models/listing");
const ChatMessage = require("../models/chatMessage");

module.exports.cityChat = async (req, res) => {
  const { city } = req.query;
  if (!city) {
    req.flash("error", "City is required for chat");
    return res.redirect("/bookings/my");
  }
  const today = new Date();

  // Find listings in this city
  const listingsInCity = await Listing.find({ location: city }).select("_id");
  if (!listingsInCity.length) {
    req.flash("error", "No listings found for this city");
    return res.redirect("/bookings/my");
  }

  const listingIds = listingsInCity.map((l) => l._id);

  // Check if user has an active approved booking in this city
  const hasActiveBooking = await Booking.exists({
    user: req.user._id,
    status: { $in: ["accepted", "confirmed"] },
    endDate: { $gte: today },
    listing: { $in: listingIds },
  });

  if (!hasActiveBooking) {
    req.flash(
      "error",
      "You can only join this city chat if you have an active approved booking here."
    );
    return res.redirect("/bookings/my");
  }

  // Load recent messages for this city (e.g., last 100)
  const messages = await ChatMessage.find({ city })
    .sort({ createdAt: 1 })
    .limit(100);

  res.render("chat/city.ejs", { city, messages });
};

