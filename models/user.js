const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// 👇 extract the plugin function properly
const passportLocalMongoose =
  require("passport-local-mongoose").default || require("passport-local-mongoose");

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
  },
  fName: {
    type: String,
    required: true,
  },
  lName: {
    type: String,
    required: true,
  },
  contact: {
    type: Number,
    required: true,
  },
  // Simple points balance used for rewards/discounts
  points: {
    type: Number,
    default: 0,
    min: 0,
  },
});

userSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model("User", userSchema);
