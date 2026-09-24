const dotenv = require("dotenv");
dotenv.config();

function required(name) {
  const value = process.env[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Не задана обязательная переменная окружения ${name}.`);
  }
  return value.trim();
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = {
  port: positiveInteger(process.env.PORT, 3000),
  db: {
    host: required("DB_HOST"),
    port: positiveInteger(process.env.DB_PORT, 5432),
    database: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
  },
  auth: {
    email: required("APP_EMAIL").toLowerCase(),
    passwordHash: required("APP_PASSWORD_HASH"),
    jwtSecret: required("JWT_SECRET"),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  corsOrigin: process.env.CORS_ORIGIN || "*",
  maxBodySize: process.env.MAX_BODY_SIZE || "15mb",
};
