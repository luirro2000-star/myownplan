CREATE TABLE IF NOT EXISTS daylight_planners (
  user_id text PRIMARY KEY,
  revision bigint NOT NULL DEFAULT 1,
  planner jsonb NOT NULL,
  undo_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  conversation jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daylight_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL REFERENCES daylight_planners(user_id) ON DELETE CASCADE,
  revision bigint NOT NULL,
  planner jsonb NOT NULL,
  label text NOT NULL DEFAULT 'Saved planner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, revision)
);

CREATE INDEX IF NOT EXISTS daylight_snapshots_user_recent
  ON daylight_snapshots (user_id, revision DESC);
