const { User } = require("../models");

// Get current user profile
const profile = async (req, res) => {
  try {
    // User is already attached to req by authenticateToken middleware
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all users (admin only)
const listUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]],
    });

    res.json({
      users,
      count: users.length,
    });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Make sure to export both functions
module.exports = {
  profile,
  listUsers,
};
