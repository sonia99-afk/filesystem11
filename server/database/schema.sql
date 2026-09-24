-- Текущий однопользовательский этап.
-- Существующие users / workspaces / workspace_members / projects не трогаются.

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
