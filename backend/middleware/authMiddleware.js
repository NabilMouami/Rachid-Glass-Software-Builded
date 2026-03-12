const jwt = require("jsonwebtoken");
require("dotenv").config();

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // You can fetch the user from database to ensure they still exist
    const { User } = require("../models");
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(403).json({ message: "Invalid token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(403).json({ message: "Token expired" });
    }
    console.error("Auth middleware error:", err);
    return res.status(500).json({ message: "Authentication failed" });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

module.exports = { authenticateToken, requireAdmin };
