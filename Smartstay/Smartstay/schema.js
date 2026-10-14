const Joi = require("joi");

module.exports.ListingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    location: Joi.string().required(),
    country: Joi.string().required(),
    category: Joi.string().required(),
    price: Joi.number().min(0).required(),
    image: Joi.object({
      url: Joi.string().allow("", null),
    }),
    // geometry: Joi.object({
    //   type: Joi.string().valid("Point").required(),
    //   coordinates: Joi.array().items(Joi.number()).required().length(2)
    // }).required(),
  }).required(),
});

module.exports.ReviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required()
  }).required()
});

module.exports.UserSchema = Joi.object({
  fName: Joi.string().pattern(/^[a-zA-Z][a-zA-Z\s]*$/).required(),
  lName: Joi.string().pattern(/^[a-zA-Z][a-zA-Z\s]*$/).required(),
  contact: Joi.string().length(10).pattern(/^[0-9]+$/).required(),
  username: Joi.string().pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=[a-zA-Z])(?=.*[!@#$%^&*])(?=.*[0-9]).*$/).required(),
  confirmpassword: Joi.string().min(8).pattern(/^(?=[a-zA-Z])(?=.*[!@#$%^&*])(?=.*[0-9]).*$/).required()
});