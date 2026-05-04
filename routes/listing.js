const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isOwner } = require("../middleware.js");
const { validateListing } = require("../middleware.js")
const Listing = require("../models/listing.js");
const { storage } = require("../cloudConfig.js");
const multer = require('multer');
const upload = multer({ storage });

const listingController = require("../controllers/listing.js");

// new route
router.get("/new", isLoggedIn, listingController.new)

// My listings (owned by current user)
router.get("/my/listings", isLoggedIn, wrapAsync(listingController.myListings));

router
    .route("/")
    .get(listingController.index)
    .post(
        isLoggedIn,
        upload.single('listing[image]'),
        validateListing,
        wrapAsync(listingController.createListing)
    )

router
    .route("/:id")
    .get(wrapAsync(listingController.show))
    .put(
        isOwner,
        upload.single('listing[image]'),
        validateListing,
        isLoggedIn,
        wrapAsync(listingController.update))
    .delete(isOwner, isLoggedIn, wrapAsync(listingController.delete))

// Edit Route
router.get("/:id/edit", isOwner, isLoggedIn, wrapAsync(listingController.edit))

module.exports = router;