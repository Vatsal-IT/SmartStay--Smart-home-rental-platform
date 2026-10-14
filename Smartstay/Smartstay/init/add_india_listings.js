const mongoose = require("mongoose");
const Listing = require("../models/listing.js");
const { categoryImages } = require("./categoryImages");
const initData = require("./data.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

const DEFAULT_OWNER_ID = "698bdfa2938de6f84fc52e6a";
const DEFAULT_CATEGORY = "Rooms";

const CATEGORY_QUERY = {
  Rooms: "bedroom,hotel",
  "Iconic Cities": "city,skyline",
  Mountains: "mountains,cabin",
  Castles: "castle,palace",
  "Amazing Pools": "swimming-pool,resort",
  Camping: "camping,tent",
  Farms: "farm,countryside",
  Arctic: "arctic,snow",
  Domes: "dome,igloo",
  Boats: "boat,yacht",
};

const buildUniqueImageUrl = (category, sig) => {
  const query = CATEGORY_QUERY[category] || "travel,stay";
  return `https://loremflickr.com/800/600/${query}?lock=${sig}`;
};

main()
  .then(() => {
    console.log("connected to DB");
    return addIndiaListings();
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

async function addIndiaListings() {
  const indiaListings = (initData.data || []).filter((l) => l.country === "India");

  let inserted = 0;
  let updated = 0;
  let sig = 10001;

  for (const obj of indiaListings) {
    const rawCategory = obj.category;
    const category = rawCategory && categoryImages[rawCategory] ? rawCategory : DEFAULT_CATEGORY;
    const imageUrl = buildUniqueImageUrl(category, sig);
    sig += 1;

    const existing = await Listing.findOne({
      title: obj.title,
      location: obj.location,
      country: obj.country,
    });

    if (existing) {
      existing.description = obj.description;
      existing.price = obj.price;
      existing.category = category;
      existing.geometry = obj.geometry;
      existing.image = { url: imageUrl, filename: existing.image?.filename || "listingimage" };
      if (!existing.owner) existing.owner = DEFAULT_OWNER_ID;
      await existing.save();
      updated += 1;
      continue;
    }

    await Listing.create({
      ...obj,
      owner: DEFAULT_OWNER_ID,
      category,
      image: { url: imageUrl, filename: obj.image?.filename || "listingimage" },
    });
    inserted += 1;
  }

  console.log(`India listings inserted: ${inserted}, updated: ${updated}`);
  process.exit();
}

