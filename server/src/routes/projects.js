const express = require("express");
const crypto = require("crypto");
const pool = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function mapProject(row, includeDocument = true) {
  const project = {
    id: row.id,
    title: row.title,
    schemaVersion: row.schema_version,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (includeDocument) {
    project.document = row.document;
  }

  return project;
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeTitle(value, fallback = "Проект") {
  if (typeof value !== "string") return fallback;
  const title = value.trim() || fallback;
  if (title.length > 250) throw badRequest("Название проекта слишком длинное.");
  return title;
}

function normalizeSchemaVersion(value, fallback = 2) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw badRequest("Некорректная версия проекта.");
  }
  return parsed;
}

function normalizeDocument(value) {
  let document = value;

  if (typeof document === "string") {
    try {
      document = JSON.parse(document);
    } catch (_) {
      throw badRequest("Данные проекта содержат некорректный JSON.");
    }
  }

  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw badRequest("Некорректные данные проекта.");
  }

  return document;
}

function normalizeProjectId(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "project_" + crypto.randomUUID();
  }

  const id = value.trim();
  if (id.length > 200) throw badRequest("ID проекта слишком длинный.");
  return id;
}

function sendRouteError(res, error, fallbackMessage) {
  if (Number.isInteger(error?.statusCode)) {
    return res.status(error.statusCode).json({
      ok: false,
      error: error.message,
    });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({
    ok: false,
    error: fallbackMessage,
  });
}

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        schema_version,
        revision,
        created_at,
        updated_at
      FROM single_user_projects
      ORDER BY updated_at DESC
    `);

    return res.json({
      ok: true,
      projects: result.rows.map((row) => mapProject(row, false)),
    });
  } catch (error) {
    return sendRouteError(res, error, "Не удалось получить проекты.");
  }
});

router.get("/:projectId", async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          title,
          schema_version,
          document,
          revision,
          created_at,
          updated_at
        FROM single_user_projects
        WHERE id = $1
        LIMIT 1
      `,
      [req.params.projectId]
    );

    const row = result.rows[0];

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: "Проект не найден.",
      });
    }

    return res.json({
      ok: true,
      project: mapProject(row),
    });
  } catch (error) {
    return sendRouteError(res, error, "Не удалось получить проект.");
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const id = normalizeProjectId(body.id);
    const title = normalizeTitle(body.title);
    const schemaVersion = normalizeSchemaVersion(body.schemaVersion);
    const document = normalizeDocument(body.document);

    const result = await pool.query(
      `
        INSERT INTO single_user_projects (
          id,
          title,
          schema_version,
          document
        )
        VALUES ($1, $2, $3, $4::jsonb)
        RETURNING
          id,
          title,
          schema_version,
          document,
          revision,
          created_at,
          updated_at
      `,
      [id, title, schemaVersion, JSON.stringify(document)]
    );

    return res.status(201).json({
      ok: true,
      project: mapProject(result.rows[0]),
    });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({
        ok: false,
        error: "Проект с таким ID уже существует.",
      });
    }

    return sendRouteError(res, error, "Не удалось создать проект.");
  }
});

router.put("/:projectId", async (req, res) => {
  try {
    const body = req.body || {};
    const revision = Number(body.revision);

    if (!Number.isInteger(revision) || revision < 1) {
      return res.status(400).json({
        ok: false,
        error: "Для сохранения требуется текущая revision.",
      });
    }

    const document = normalizeDocument(body.document);
    const title = normalizeTitle(body.title);
    const schemaVersion = normalizeSchemaVersion(body.schemaVersion);

    const result = await pool.query(
      `
        UPDATE single_user_projects
        SET
          title = $1,
          schema_version = $2,
          document = $3::jsonb,
          revision = revision + 1,
          updated_at = NOW()
        WHERE
          id = $4
          AND revision = $5
        RETURNING
          id,
          title,
          schema_version,
          document,
          revision,
          created_at,
          updated_at
      `,
      [
        title,
        schemaVersion,
        JSON.stringify(document),
        req.params.projectId,
        revision,
      ]
    );

    const row = result.rows[0];

    if (row) {
      return res.json({
        ok: true,
        project: mapProject(row),
      });
    }

    const current = await pool.query(
      `
        SELECT revision
        FROM single_user_projects
        WHERE id = $1
        LIMIT 1
      `,
      [req.params.projectId]
    );

    if (!current.rows[0]) {
      return res.status(404).json({
        ok: false,
        error: "Проект не найден.",
      });
    }

    return res.status(409).json({
      ok: false,
      error: "Проект уже был изменён. Необходимо загрузить свежую версию.",
      currentRevision: current.rows[0].revision,
    });
  } catch (error) {
    return sendRouteError(res, error, "Не удалось сохранить проект.");
  }
});

router.delete("/:projectId", async (req, res) => {
  try {
    const result = await pool.query(
      `
        DELETE FROM single_user_projects
        WHERE id = $1
        RETURNING id
      `,
      [req.params.projectId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        ok: false,
        error: "Проект не найден.",
      });
    }

    return res.json({
      ok: true,
      deletedProjectId: result.rows[0].id,
    });
  } catch (error) {
    return sendRouteError(res, error, "Не удалось удалить проект.");
  }
});

module.exports = router;
