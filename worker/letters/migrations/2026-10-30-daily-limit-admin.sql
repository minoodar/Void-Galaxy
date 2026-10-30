-- Migration 2026-10-30: per-sender sliding 24h limit + admin API.
-- Additive only: existing letters, letter_senders and letter_limits rows are
-- untouched. Safe to run once on an existing D1 database.
--
-- Apply from the repo root. Pass the binding `DB`, not a database name:
-- wrangler resolves it through database_id 559070d9-afb4-471e-8839-78866e9437a1
-- in worker/letters/wrangler.toml, so a mismatched display name cannot
-- redirect the write. Run only after `wrangler d1 list` shows that id.
--
--   cd worker/letters && wrangler d1 execute DB --remote \
--     --file=migrations/2026-10-30-daily-limit-admin.sql

CREATE TABLE IF NOT EXISTS letter_submissions (
  request_id  TEXT PRIMARY KEY,
  sender_hash TEXT NOT NULL,
  letter_id   TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_letter_submissions_sender
  ON letter_submissions(sender_hash, created_at);
