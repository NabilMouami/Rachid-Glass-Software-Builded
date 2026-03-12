const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateUser,
  getUserById,
  deleteUser,
} = require("../controllers/authController");
const { authenticateToken } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticateToken, getMe);
router.get("/:id", authenticateToken, getUserById); // Get user by ID
router.patch("/:id", authenticateToken, updateUser); // Update user by ID
router.delete("/:id", authenticateToken, deleteUser); // Delete user by ID

module.exports = router;
