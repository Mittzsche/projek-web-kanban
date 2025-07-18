const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../models/User");
const bcrypt = require("bcryptjs")
const generateToken = require("../utils/generateToken");

// ===========================
// Manual Register
// ===========================
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      name,
      email,
      password,
      provider: "local",
    });

    const token = generateToken(user._id);
    console.log("Registering:", name, email);
    console.log("Plain password received:", password);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      provider: user.provider,
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});

// ===========================
// Manual Login
// ===========================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  console.log("Login attempt:", email);

  try {
    const user = await User.findOne({ email });

    if (!user) {
      console.log("❌ User not found");
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.provider !== "local") {
      console.log("❌ Login attempted for Google account");
      return res.status(401).json({ message: "Please login using Google" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("❌ Password mismatch");
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user._id);

    console.log("✅ Login successful for", email);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      provider: user.provider,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

// ===========================
// Google OAuth routes
// ===========================
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  async (req, res) => {
    try {
      const token = generateToken(req.user._id);

      const userData = {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        provider: req.user.provider,
        profilePictureUrl: req.user.profilePictureUrl,
        token,
      };

      res.send(`
        <script>
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_SUCCESS',
            user: ${JSON.stringify(userData)}
          }, '${process.env.CLIENT_URL}');
          window.close();
        </script>
      `);
    } catch (error) {
      console.error("Google auth callback error:", error);
      res.send(`
        <script>
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_ERROR',
            error: 'Authentication failed'
          }, '${process.env.CLIENT_URL}');
          window.close();
        </script>
      `);
    }
  }
);

module.exports = router;
