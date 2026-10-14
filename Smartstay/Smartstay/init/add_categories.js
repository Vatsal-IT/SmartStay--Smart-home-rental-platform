const mongoose = require("mongoose");
const Listing = require("../models/listing.js");
const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

const categories = ["Rooms", "Iconic Cities", "Mountains", "Castles", "Amazing Pools", "Camping", "Farms", "Arctic", "Domes", "Boats"];

main()
    .then(() => {
        console.log("connected to DB");
        return addCategories();
    })
    .catch((err) => {
        console.log(err);
    });

async function main() {
    await mongoose.connect(MONGO_URL);
}

const addCategories = async () => {
    try {
        const listings = await Listing.find({});
        console.log(`Found ${listings.length} listings.`);

        for (let listing of listings) {
            // Assign a random category if it doesn't have one
            if (!listing.category) {
                const randomCategory = categories[Math.floor(Math.random() * categories.length)];
                listing.category = randomCategory;
                await listing.save();
                console.log(`Updated listing "${listing.title}" with category: ${randomCategory}`);
            }
        }
        console.log("All listings updated with categories!");
        process.exit();
    } catch (err) {
        console.log("Error updating listings:", err);
        process.exit(1);
    }
}
