// routes/user.js
const express = require("express");
const router = express.Router();
const { permit } = require("../middleware/roleMiddleware");
const { profile, listUsers } = require("../controllers/userController");
const { authenticateToken } = require("../middleware/authMiddleware");

// Make sure the controller functions exist before using them
if (typeof profile !== "function") {
  console.error("profile controller is not a function");
}

if (typeof listUsers !== "function") {
  console.error("listUsers controller is not a function");
}

// Routes
router.get("/me", authenticateToken, profile);
router.get("/", authenticateToken, permit("admin"), listUsers);

module.exports = router;
