const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { User } = require("../models");

const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const existing = await User.findOne({ where: { email } });
    if (existing)
      return res.status(409).json({ message: "Email already in use" });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hash,
      role: role,
    });
    return res.status(201).json({
      message: "User created",
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Authorization: Users can view themselves OR admins can view anyone
    if (currentUser.id !== parseInt(id) && currentUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Not authorized to view this user" });
    }

    const user = await User.findByPk(id, {
      attributes: { exclude: ["password"] }, // Don't send password
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update user by ID
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role } = req.body;
    const currentUser = req.user;

    // Check if user exists
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Authorization: Users can update themselves OR admins can update anyone
    if (currentUser.id !== parseInt(id) && currentUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Not authorized to update this user" });
    }

    // Check if email is being changed and if it's already in use
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser && existingUser.id !== parseInt(id)) {
        return res.status(409).json({ message: "Email already in use" });
      }
    }

    // Prevent role escalation: non-admins cannot change roles
    if (role && currentUser.role !== "admin" && role !== user.role) {
      return res.status(403).json({
        message: "Not authorized to change user role",
      });
    }

    // Prevent last admin from being demoted
    if (role && user.role === "admin" && role !== "admin") {
      const adminCount = await User.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        return res.status(400).json({
          message:
            "Cannot demote the last admin user. Please assign another admin first.",
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role && currentUser.role === "admin") updateData.role = role;

    // Hash new password if provided
    if (password && password.trim() !== "") {
      if (password.length < 6) {
        return res.status(400).json({
          message: "Password must be at least 6 characters long",
        });
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update user
    await User.update(updateData, { where: { id } });

    // Fetch updated user
    const updatedUser = await User.findByPk(id, {
      attributes: { exclude: ["password"] },
    });

    return res.json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      },
    );

    return res.json({
      message: "Logged in",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

const getMe = async (req, res) => {
  try {
    // User is already attached to req by the auth middleware
    return res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// Delete user by ID (Admin only or self-delete)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if user exists
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Authorization: Users can delete themselves OR admins can delete anyone
    if (currentUser.id !== parseInt(id) && currentUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this user" });
    }

    // Optional: Prevent self-deletion if it's the last admin
    if (user.role === "admin" && currentUser.id === parseInt(id)) {
      const adminCount = await User.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        return res.status(400).json({
          message:
            "Cannot delete the last admin user. Please assign another admin first.",
        });
      }
    }

    await User.destroy({ where: { id } });

    return res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};
module.exports = {
  register,
  login,
  getMe,
  deleteUser,
  updateUser,
  getUserById,
};
