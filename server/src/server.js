const express = require("express");
const cors = require("cors");
const config = require("./config");
const pool = require("./db");
const initDatabase = require("./init-db");
const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const requireAuth = require("./middleware/auth");

function buildCorsOptions() {
  const raw = String(config.corsOrigin || "*").trim();

  if (!raw || raw === "*") return {};

  const allowed = new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  return {
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) {
        return callback(null, true);
      }

      const error = new Error("CORS origin is not allowed.");
      error.statusCode = 403;
      return callback(error);
    },
  };
}

async function start() {
  await pool.query("SELECT 1");
  await initDatabase();

  const app = express();

  app.disable("x-powered-by");
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: config.maxBodySize }));

  app.get("/api/health", async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT NOW() AS database_time"
      );

      return res.json({
        ok: true,
        database: "connected",
        databaseTime: result.rows[0].database_time,
      });
    } catch (error) {
      console.error("Health check error:", error);
      return res.status(500).json({
        ok: false,
        database: "disconnected",
      });
    }
  });

  app.use("/api/auth", authRoutes);

  app.get("/api/me", requireAuth, (req, res) => {
    return res.json({
      ok: true,
      user: req.user,
    });
  });

  app.use("/api/projects", projectRoutes);

  app.use((_req, res) => {
    return res.status(404).json({
      ok: false,
      error: "Маршрут не найден.",
    });
  });

  app.use((error, _req, res, _next) => {
    console.error("Unhandled server error:", error);

    const status = Number.isInteger(error?.statusCode)
      ? error.statusCode
      : 500;

    return res.status(status).json({
      ok: false,
      error:
        status === 500
          ? "Внутренняя ошибка сервера."
          : error.message,
    });
  });

  const server = app.listen(config.port, () => {
    console.log(`Server started: http://localhost:${config.port}`);
  });

  async function shutdown(signal) {
    console.log(`${signal}: shutting down...`);

    server.close(async () => {
      try {
        await pool.end();
      } finally {
        process.exit(0);
      }
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch(async (error) => {
  console.error("Server startup failed:", error);

  try {
    await pool.end();
  } catch (_) {}

  process.exit(1);
});
