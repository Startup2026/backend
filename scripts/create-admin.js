const dotenv = require("dotenv");
dotenv.config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/config");
const User = require("../models/user.model");

async function run() {
  const email = (process.env.ADMIN_EMAIL || "admin@wostup.com").toLowerCase().trim();
  const username = (process.env.ADMIN_USERNAME || "admin").trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 6) {
    throw new Error("Set ADMIN_PASSWORD in .env (min length 6) before running this script.");
  }

  await connectDB();

  const hashedPassword = await bcrypt.hash(password, 12);

  await User.findOneAndUpdate(
    { email },
    {
      $set: {
        username,
        role: "admin",
        password: hashedPassword,
        isVerified: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`Admin user is ready: ${email}`);
  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error("Failed to create admin:", error.message);
  try {
    await mongoose.connection.close();
  } catch (_e) {
    // ignore close errors
  }
  process.exit(1);
});
