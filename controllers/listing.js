const Listing = require("../models/listing");
const User = require("../models/user");
// const geocodeLocation = require("../public/js/map"); // ERROR: Cannot require frontend file in backend
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Predefined price ranges (Amazon-style): [label, min, max] (max null = no upper limit)
const PRICE_RANGES = [
  ["Under ₹1,000", 0, 1000],
  ["₹1,000 - ₹2,500", 1000, 2500],
  ["₹2,500 - ₹5,000", 2500, 5000],
  ["₹5,000 - ₹10,000", 5000, 10000],
  ["₹10,000 - ₹25,000", 10000, 25000],
  ["Above ₹25,000", 25000, null],
];

// Points awarded when a user creates a new listing
const POINTS_FOR_NEW_LISTING = 50;

const FEATURED_CITIES = [
  { name: "Mumbai", label: "Available in Mumbai this weekend", emoji: "🌆" },
  { name: "Goa", label: "Popular homes in Goa", emoji: "🏖️" },
  { name: "Jaipur", label: "Popular homes in Jaipur", emoji: "🏰" },
  { name: "Udaipur", label: "Available in Udaipur this weekend", emoji: "🌊" },
  { name: "Delhi", label: "Check out homes in New Delhi", emoji: "🕌" },
  { name: "Pune", label: "Homes in Pune", emoji: "🏙️" },
  { name: "Ahmadabad", label: "Stay in Ahmadabad", emoji: "🏢" },
  { name: "Dehradun", label: "Mountain homes in Dehradun", emoji: "🏔️" },
];

module.exports.index = async (req, res) => {
    try {
        const { category, search, priceRange } = req.query;
        let query = {};

        if (category) {
            query.category = category;
        }

        if (search) {
            query.location = new RegExp(search.trim(), 'i');
        }

        if (priceRange) {
            const idx = parseInt(priceRange, 10);
            if (idx >= 0 && idx < PRICE_RANGES.length) {
                const [, min, max] = PRICE_RANGES[idx];
                query.price = { $gte: min };
                if (max !== null && max !== undefined) query.price.$lte = max;
            }
        }

        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 48);
        const skip = (page - 1) * limit;

        const [allListings, total] = await Promise.all([
            Listing.find(query)
                .sort({ _id: -1 })
                .skip(skip)
                .limit(limit)
                .select("_id title price image category location")
                .lean(),
            Listing.countDocuments(query),
        ]);

        const totalPages = Math.max(Math.ceil(total / limit), 1);

        // Fetch city-grouped listings for the homepage sections (only on the main page, no active filters)
        let citySections = [];
        const isHomepage = !category && !search && !priceRange && page === 1;
        if (isHomepage) {
            citySections = await Promise.all(
                FEATURED_CITIES.map(async (city) => {
                    const listings = await Listing.find({
                        location: new RegExp(city.name, 'i')
                    })
                        .sort({ _id: -1 })
                        .limit(8)
                        .select("_id title price image location")
                        .lean();
                    return { ...city, listings };
                })
            );
            // Only include cities that have at least 2 listings
            citySections = citySections.filter(c => c.listings.length >= 2);
        }

        res.render("Listings/index.ejs", {
            allListings,
            category,
            search,
            priceRange,
            priceRanges: PRICE_RANGES,
            page,
            limit,
            total,
            totalPages,
            citySections,
            isHomepage,
        });
    } catch (e) {
        console.log(e);
        res.status(500).send("ERROR IN LISTINGS ROUTE: " + e.message + "<br><br>" + e.stack);
    }
}

module.exports.myListings = async (req, res) => {
  const myListings = await Listing.find({ owner: req.user._id });
  res.render("Listings/index.ejs", {
    allListings: myListings,
    category: null,
    search: null,
    priceRange: null,
    priceRanges: PRICE_RANGES,
    page: 1,
    limit: 12,
    total: myListings.length,
    totalPages: 1,
    citySections: [],
    isHomepage: false,
  });
};

module.exports.new = (req, res) => {
  res.render("Listings/new.ejs");
};

module.exports.createListing = async (req, res, next) => {
  // Geocoding using Nominatim (Server-side)
  let geometry = { type: "Point", coordinates: [0, 0] };
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        req.body.listing.location
      )}&format=json&limit=1`
    );
    const data = await response.json();
    if (data && data.length > 0) {
      geometry = {
        type: "Point",
        coordinates: [parseFloat(data[0].lon), parseFloat(data[0].lat)],
      };
    }
  } catch (e) {
    console.error("Geocoding failed:", e);
  }

  const url = req.file.path;
  const filename = req.file.filename;
  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;
  newListing.image = { url, filename };
  newListing.geometry = geometry;

  const savedListing = await newListing.save();

  // Award points to the owner for creating a new listing
  try {
    const owner = await User.findById(newListing.owner);
    if (owner) {
      owner.points = (owner.points || 0) + POINTS_FOR_NEW_LISTING;
      await owner.save();
    }
  } catch (err) {
    console.error("Failed to award points for new listing:", err);
  }

  console.log(savedListing);
  req.flash("success", "New Listing Created!");
  res.redirect("/listings");
};

module.exports.show = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: {
                path: "author",
            },
        })
        .populate("owner");
    if (!listing) {
        req.flash("error", "listing you requested does not exists");
        return res.redirect("/listings");
    }
    res.render("Listings/show.ejs", { listing });
}

module.exports.edit = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "listing you requested does not exists");
        return res.redirect("/listings")
    }
    let originalImageurl = listing.image.url;
    originalImageurl = originalImageurl.replace("/upload", "/upload/h_300,w_250")
    res.render("Listings/edit.ejs", { listing, originalImageurl });
}

module.exports.update = async (req, res) => {
    let { id } = req.params;
    let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

    if (typeof req.file !== "undefined") {
        let url = req.file.path;
        let filename = req.file.filename;
        listing.image = { url, filename };
        await listing.save();
    }

    req.flash("success", "new listing updated");
    res.redirect(`/listings/${id}`)
}

module.exports.delete = async (req, res) => {
    let { id } = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash("success", "listing deleted");
    res.redirect("/listings");
}