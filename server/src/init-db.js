const pool = require("./db");

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS single_user_projects (
    id TEXT PRIMARY KEY,
    title VARCHAR(250) NOT NULL DEFAULT 'Проект',
    schema_version INTEGER NOT NULL DEFAULT 2 CHECK (schema_version >= 1),
    document JSONB NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS single_user_projects_updated_at_idx
  ON single_user_projects (updated_at DESC);
`;

async function initDatabase() {
  await pool.query(SCHEMA_SQL);
}

if (require.main === module) {
  initDatabase()
    .then(() => console.log("Database initialized."))
    .catch((error) => {
      console.error("Database initialization failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}

module.exports = initDatabase;
