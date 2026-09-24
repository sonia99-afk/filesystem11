const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body || {};

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Email и пароль обязательны.",
      });
    }

    email = email.trim().toLowerCase();

    const emailMatches = email === config.auth.email;
    const passwordMatches = await bcrypt.compare(
      password,
      config.auth.passwordHash
    );

    if (!emailMatches || !passwordMatches) {
      return res.status(401).json({
        ok: false,
        error: "Неверный email или пароль.",
      });
    }

    const token = jwt.sign(
      {
        type: "single-user",
        email: config.auth.email,
      },
      config.auth.jwtSecret,
      {
        expiresIn: config.auth.jwtExpiresIn,
      }
    );

    return res.json({
      ok: true,
      token,
      user: {
        email: config.auth.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      ok: false,
      error: "Не удалось выполнить вход.",
    });
  }
});

module.exports = router;
