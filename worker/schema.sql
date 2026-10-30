-- void-galaxy-counter D1 schema
-- Apply with:
--   wrangler d1 execute void-galaxy-counter --remote --file=worker/schema.sql

CREATE TABLE IF NOT EXISTS visitors (
  ip_hash    TEXT PRIMARY KEY,
  hits       INTEGER NOT NULL DEFAULT 0,
  sessions   INTEGER NOT NULL DEFAULT 0,
  first_seen INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visitors_hits ON visitors(hits);
CREATE INDEX IF NOT EXISTS idx_visitors_sessions ON visitors(sessions);

CREATE TABLE IF NOT EXISTS daily (
  day        TEXT PRIMARY KEY,
  unique_new INTEGER NOT NULL DEFAULT 0,
  sessions   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rate (
  ip_hash TEXT NOT NULL,
  hour    INTEGER NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, hour)
);

CREATE INDEX IF NOT EXISTS idx_rate_hour ON rate(hour);
