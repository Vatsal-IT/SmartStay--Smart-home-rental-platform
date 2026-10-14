const mongoose = require("mongoose");
const Listing = require("../models/listing.js");
const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

const { categoryImages } = require("./categoryImages");

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

main()
    .then(() => {
        console.log("connected to DB");
        return updateListings();
    })
    .catch((err) => {
        console.log(err);
    });

async function main() {
    await mongoose.connect(MONGO_URL);
}

const DEFAULT_CATEGORY = "Rooms";

const buildUniqueImageUrl = (category, sig) => {
    const query = CATEGORY_QUERY[category] || "travel,stay";
    // `lock` makes the image deterministic and unique per listing.
    // Using loremflickr avoids the Unsplash Source 503 issue.
    return `https://loremflickr.com/800/600/${query}?lock=${sig}`;
};

const updateListings = async () => {
    try {
        const listings = await Listing.find({}).sort({ _id: 1 });
        console.log(`Found ${listings.length} listings. Updating UNIQUE images by category...`);

        let sig = 1;
        for (let listing of listings) {
            const existingCategory = listing.category;
            const category =
                existingCategory && categoryImages[existingCategory]
                    ? existingCategory
                    : DEFAULT_CATEGORY;

            const uniqueUrl = buildUniqueImageUrl(category, sig);
            sig += 1;

            if (category !== existingCategory) listing.category = category;

            listing.image = {
                url: uniqueUrl,
                filename: listing.image.filename || "listingimage",
            };

            await listing.save();
            console.log(`Updated "${listing.title}" -> ${category}`);
        }

        console.log("All listings updated with UNIQUE category-matching images!");
        process.exit();
    } catch (err) {
        console.log("Error updating in the listings:", err);
        process.exit(1);
    }
}
