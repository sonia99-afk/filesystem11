const jwt = require("jsonwebtoken");
const config = require("../config");

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;

  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      error: "Требуется авторизация.",
    });
  }

  const token = authorization.slice(7).trim();

  try {
    const payload = jwt.verify(token, config.auth.jwtSecret);

    if (
      payload?.type !== "single-user" ||
      String(payload?.email || "").toLowerCase() !== config.auth.email
    ) {
      throw new Error("Unexpected token payload");
    }

    req.user = { email: config.auth.email };
    return next();
  } catch (_) {
    return res.status(401).json({
      ok: false,
      error: "Недействительный или истёкший токен.",
    });
  }
}

module.exports = requireAuth;
