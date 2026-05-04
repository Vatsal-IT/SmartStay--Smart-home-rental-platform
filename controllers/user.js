const User = require("../models/user");
const { UserSchema } = require("../schema.js");

module.exports.signup = (req, res) => {
    res.render("users/signup.ejs");
}

module.exports.signupformcreate = async (req, res) => {
    try {
        let { username, email, password, fName, lName, contact, confirmpassword } = req.body;

        // Joi Validation
        const { error } = UserSchema.validate({ username, email, password, fName, lName, contact, confirmpassword });
        if (error) {
            req.flash("error", error.details.map(el => el.message).join(","));
            return res.redirect("/signup");
        }
        if (password != confirmpassword) {
            req.flash("error", "password and confirm password are not same");
            return res.redirect("/signup");
        }
        const newUser = new User({ email, username, fName, lName, contact });
        const registeredUser = await User.register(newUser, password);
        console.log(registeredUser);
        req.login(registeredUser, (err) => {
            if (err) {
                return next(err);
            }
            req.flash("success", "Successfully registered!")
            res.redirect("/login")
        });
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup")
    }
}

module.exports.login = (req, res) => {
    res.render("users/login.ejs");
}

module.exports.loginformcreate = async (req, res) => {
    req.flash("success", "welcome back to Smartstay!")
    let redirectUrl = res.locals.redirectUrl || "/listings"
    res.redirect(redirectUrl)
}

module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success", "You are logged out!");
        res.redirect("/listings");
    })
}