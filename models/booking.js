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
    enum: ["pending", "accepted", "rejected", "confirmed", "expired"],
    default: "pending",
  },
  paymentStatus: {
    type: String,
    enum: ["unpaid", "paid", "refunded"],
    default: "unpaid",
  },
  acceptedAt: Date,
  confirmedAt: Date,
  rejectedAt: Date,
  expiresAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

bookingSchema.index({ listing: 1, startDate: 1, endDate: 1 });
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ expiresAt: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
