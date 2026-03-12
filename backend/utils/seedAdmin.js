const bcrypt = require("bcryptjs");
const { User } = require("../models");
require("dotenv").config();

async function seedAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      console.warn(
        "ADMIN_EMAIL or ADMIN_PASSWORD not set; skipping admin seed."
      );
      return;
    }

    const existing = await User.findOne({ where: { email: adminEmail } });
    if (existing) {
      console.log("Admin already exists:", adminEmail);
      return;
    }

    const hash = await bcrypt.hash(adminPassword, 10);
    await User.create({
      name: "Admin",
      email: adminEmail,
      password: hash,
      role: "admin",
    });
    console.log("Created admin user:", adminEmail);
  } catch (err) {
    console.error("Failed to seed admin", err);
  }
}

module.exports = seedAdmin;
