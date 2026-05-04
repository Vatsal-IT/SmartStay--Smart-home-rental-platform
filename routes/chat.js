const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware");
const chatController = require("../controllers/chat");

router.get("/chat", isLoggedIn, chatController.cityChat);

module.exports = router;

