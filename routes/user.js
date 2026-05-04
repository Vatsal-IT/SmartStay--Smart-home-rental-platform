const express = require("express");
const router = express.Router();
const User = require("../models/user")
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const { saveRedirectUrl } = require("../middleware");

const userController=require("../controllers/user.js");
const { UserSchema } = require("../schema.js");

router.route("/signup")
    .get(userController.signup)
    .post(wrapAsync(userController.signupformcreate))

router.route("/login")
    .get(userController.login)
    .post(
        saveRedirectUrl,
        passport.authenticate(
            "local",
            { failureRedirect: "/login", failureFlash: true }),
        userController.loginformcreate
    )

router.get("/logout", userController.logout)

module.exports = router;