const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
  listing: {
    type: Schema.Types.ObjectId,
    ref: "Listing",
    required: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  guests: {
    type: Number,
    min: 1,
    default: 1,
  },
  // Final price after applying any discounts
  totalPrice: {
    type: Number,
    required: true,
  },
  // Base price before discount (for display/debugging)
  originalTotalPrice: {
    type: Number,
  },
  // Percentage discount that was applied based on user points
  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Absolute discount amount in currency units
  discountAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Booking", bookingSchema);
