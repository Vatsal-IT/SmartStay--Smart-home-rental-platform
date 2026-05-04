const Listing = require("../models/listing.js");
const Review = require("../models/review.js");
const User = require("../models/user.js");

// Points awarded to the listing owner for each 5-star review
const POINTS_FOR_FIVE_STAR_REVIEW = 20;

module.exports.createReview = async (req, res) => {
  const { id } = req.params;
  let listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing not found");
    return res.redirect("/listings");
  }

  const newReview = new Review(req.body.review);
  newReview.author = req.user._id;

  listing.reviews.push(newReview);
  await newReview.save();
  await listing.save();

  // Award points to the listing owner when they receive a 5-star review
  try {
    if (newReview.rating === 5 && listing.owner) {
      const owner = await User.findById(listing.owner);
      if (owner) {
        owner.points = (owner.points || 0) + POINTS_FOR_FIVE_STAR_REVIEW;
        await owner.save();
      }
    }
  } catch (err) {
    console.error("Failed to award points for 5-star review:", err);
  }

  req.flash("success", "new review created");
  res.redirect(`/listings/${id}`);
};

module.exports.deleteReview = async (req, res) => {
  const { id, reviewId } = req.params;
  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
  req.flash("success", "review deleted");
  res.redirect(`/listings/${id}`);
};