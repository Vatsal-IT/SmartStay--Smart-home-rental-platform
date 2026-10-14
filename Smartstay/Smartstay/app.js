if(process.env.NODE_ENV != "production") {
    require('dotenv').config()
}

const express = require("express");
const path = require("path")
const http = require("http");
const app = express();
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const flash = require("connect-flash")
const passport = require("passport")
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const mongoose = require("mongoose");
const ExpressError = require("./utils/ExpressError.js");
const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

const listingsRouter = require("./routes/listing.js")
const reviewsRouter = require("./routes/review.js");
const bookingsRouter = require("./routes/booking.js");
const userRouter = require("./routes/user.js");
const chatRouter = require("./routes/chat.js");
const ChatMessage = require("./models/chatMessage");

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.set("io", io);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

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

const sessionOptions = {
    secret: "musupersecretstring",
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true
    }
}

app.get("/", (req, res) => {
    res.send("i am root");
})

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currentUser = req.user;
    next();
})

app.use("/listings", listingsRouter);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/", bookingsRouter);
app.use("/", chatRouter);
app.use("/", userRouter);

app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
    console.log(err);
    let { status = 500, msg = "Something went wrong!" } = err;
    res.status(status).render("err.ejs", { status, msg });
})

io.on("connection", (socket) => {
    socket.on("joinRoom", ({ city, username }) => {
        if (!city) return;
        socket.join(city);
        socket.to(city).emit("chatMessage", {
            username: "System",
            text: `${username} joined the room`,
            createdAt: new Date()
        });
    });

    socket.on("chatMessage", async ({ city, username, text, userId }) => {
        if (!city || !text) return;
        const createdAt = new Date();

        // Persist message
        try {
            await ChatMessage.create({
                city,
                user: userId,
                username,
                text,
                createdAt,
            });
        } catch (e) {
            console.error("Failed to save chat message:", e);
        }

        io.to(city).emit("chatMessage", {
            username,
            text,
            createdAt,
        });
    });
});

server.listen(8080, () => {
    console.log("server listening on 8080");
})