const mongoose = require("mongoose");
const Listing = require("../models/listing.js")
const initData = require("./data.js")
const { categoryImages } = require("./categoryImages");
const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";
main()
    .then(() => {
        console.log("connect to DB");
    })
    .catch((err) => {
        console.log(err);
    })

async function main() {
    await mongoose.connect(MONGO_URL);
}

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
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

const inferCategory = (obj) => {
    const text = `${obj.title || ""} ${obj.description || ""} ${obj.location || ""} ${obj.country || ""}`.toLowerCase();

    if (/(boat|houseboat|yacht|kayak|canoe)/.test(text)) return "Boats";
    if (/(dome|igloo|geodesic)/.test(text)) return "Domes";
    if (/(arctic|polar|aurora|ice|glacier)/.test(text)) return "Arctic";
    if (/(farm|farms|ranch|vineyard)/.test(text)) return "Farms";
    if (/(camp|camping|tent|safari|treehouse)/.test(text)) return "Camping";
    if (/(pool|infinity pool)/.test(text)) return "Amazing Pools";
    if (/(mountain|ski|alps|cabin|chalet|banff|aspen)/.test(text)) return "Mountains";
    if (/(castle|palace|fort|haveli|heritage|historic|villa)/.test(text)) return "Castles";
    if (/(downtown|city|apartment|loft|penthouse|brownstone|tokyo|miami|boston|amsterdam|new york|los angeles)/.test(text)) return "Iconic Cities";

    return DEFAULT_CATEGORY;
};

const initDB = async () => {
    await Listing.deleteMany({});
    let sig = 1;
    const seeded = initData.data.map((obj) => {
        const rawCategory = obj.category;
        const category = rawCategory && categoryImages[rawCategory] ? rawCategory : inferCategory(obj);

        const imageUrl = buildUniqueImageUrl(category, sig);
        sig += 1;

        return {
            ...obj,
            owner: DEFAULT_OWNER_ID,
            category,
            image: {
                url: imageUrl,
                filename: obj.image?.filename || "listingimage",
            },
        };
    });
    await Listing.insertMany(seeded);
    console.log("data was initialized");
}

initDB();