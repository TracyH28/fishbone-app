import { pool } from "./pool.js";

const schema = `
CREATE TABLE IF NOT EXISTS facilitators (
  id          SERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id            SERIAL PRIMARY KEY,
  facilitator_id INT REFERENCES facilitators(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  project_name  TEXT NOT NULL,
  join_code     TEXT UNIQUE NOT NULL,
  stage         INT NOT NULL DEFAULT 0,
  opens_at      TIMESTAMPTZ,
  closes_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id           SERIAL PRIMARY KEY,
  session_id   INT REFERENCES sessions(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  colour       TEXT NOT NULL DEFAULT '#6366f1',
  display_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS participants (
  id           SERIAL PRIMARY KEY,
  session_id   INT REFERENCES sessions(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  token        TEXT UNIQUE NOT NULL,
  joined_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS causes (
  id           SERIAL PRIMARY KEY,
  session_id   INT REFERENCES sessions(id) ON DELETE CASCADE,
  category_id  INT REFERENCES categories(id) ON DELETE CASCADE,
  participant_id INT REFERENCES participants(id) ON DELETE SET NULL,
  description  TEXT NOT NULL,
  cause_type   TEXT NOT NULL CHECK (cause_type IN ('lesson_learned','new_project_approach')),
  selected     BOOLEAN DEFAULT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cause_votes (
  id             SERIAL PRIMARY KEY,
  cause_id       INT REFERENCES causes(id) ON DELETE CASCADE,
  participant_id INT REFERENCES participants(id) ON DELETE CASCADE,
  UNIQUE(cause_id, participant_id)
);

CREATE TABLE IF NOT EXISTS risk_ratings (
  id             SERIAL PRIMARY KEY,
  cause_id       INT REFERENCES causes(id) ON DELETE CASCADE,
  participant_id INT REFERENCES participants(id) ON DELETE CASCADE,
  stage          INT NOT NULL CHECK (stage IN (3, 5)),
  rating         TEXT NOT NULL CHECK (rating IN ('high','medium','low')),
  rated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cause_id, participant_id, stage)
);

CREATE TABLE IF NOT EXISTS risk_finals (
  id         SERIAL PRIMARY KEY,
  cause_id   INT REFERENCES causes(id) ON DELETE CASCADE UNIQUE,
  stage      INT NOT NULL CHECK (stage IN (3, 5)),
  rating     TEXT NOT NULL CHECK (rating IN ('high','medium','low')),
  set_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actions (
  id          SERIAL PRIMARY KEY,
  cause_id    INT REFERENCES causes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  owner       TEXT NOT NULL CHECK (owner IN ('siemens','csl')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS residual_risk_finals (
  id         SERIAL PRIMARY KEY,
  cause_id   INT REFERENCES causes(id) ON DELETE CASCADE UNIQUE,
  rating     TEXT NOT NULL CHECK (rating IN ('high','medium','low')),
  set_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cause_notes (
  id               SERIAL PRIMARY KEY,
  cause_id         INT REFERENCES causes(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
`;

async function migrate() {
  console.log("Running migrations…");
  await pool.query(schema);
  // Additive column migrations (safe to re-run)
  await pool.query(`ALTER TABLE causes ADD COLUMN IF NOT EXISTS dismissal_reason TEXT`);
  console.log("Migrations complete.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
