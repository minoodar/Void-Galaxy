-- Phase A: Isolated Letters Schema
-- All operations assume SQLite/Cloudflare D1 compatibility.
-- This file is additive: it does not touch the visitor-counter tables
-- (visitors, daily, rate) defined in worker/schema.sql.

CREATE TABLE IF NOT EXISTS letters (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  id          TEXT NOT NULL UNIQUE,          -- 128-bit random hex identifier
  body        TEXT NOT NULL,                 -- Normalized, validated UTF-8 text (max 500 codepoints)
  lang        TEXT DEFAULT NULL,             -- Normalized ISO/BCP47 lang tag or NULL
  created_at  INTEGER NOT NULL,              -- Unix timestamp in seconds
  expires_at  INTEGER NOT NULL               -- Unix timestamp in seconds
);

CREATE INDEX IF NOT EXISTS idx_letters_expires ON letters(expires_at);
CREATE INDEX IF NOT EXISTS idx_letters_created ON letters(created_at);

-- Legacy 30-day claim ledger. Kept for backward compatibility and for admin
-- cleanup of pre-migration letters; POST /letters no longer reads or writes it.
CREATE TABLE IF NOT EXISTS letter_senders (
  sender_hash     TEXT PRIMARY KEY,          -- HMAC-SHA-256(LETTER_SALT, "letters:v1|" || ip)
  letter_id       TEXT NOT NULL,
  request_id      TEXT NOT NULL,             -- UUIDv4 from client
  claimed_at      INTEGER NOT NULL,          -- Unix timestamp in seconds
  next_allowed_at INTEGER NOT NULL           -- claimed_at + 30 days (2,592,000 seconds)
);

CREATE INDEX IF NOT EXISTS idx_letter_senders_claimed ON letter_senders(claimed_at);

-- One row per accepted submission. Powers two things:
--   1. idempotent retry by (sender_hash, request_id) — including after a reload;
--   2. the sliding 24-hour per-sender limit (2 letters per 24h).
-- Only the domain-separated HMAC of the IP is stored; the raw IP never is.
CREATE TABLE IF NOT EXISTS letter_submissions (
  request_id  TEXT PRIMARY KEY,              -- Lowercased UUIDv4 from the client
  sender_hash TEXT NOT NULL,                 -- HMAC-SHA-256(LETTER_SALT, "letters:v1|" || ip)
  letter_id   TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL               -- Unix timestamp in seconds
);

CREATE INDEX IF NOT EXISTS idx_letter_submissions_sender
  ON letter_submissions(sender_hash, created_at);

-- Unified Rate Limiter (hourly buckets for the global ceiling). The per-sender
-- rule is the sliding 24-hour window in letter_submissions, not this table.
CREATE TABLE IF NOT EXISTS letter_limits (
  scope   TEXT NOT NULL,                     -- 'global' OR 'sender:' || sender_hash
  bucket  INTEGER NOT NULL,                  -- floor(timestamp / 3600)
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, bucket)
);

CREATE INDEX IF NOT EXISTS idx_letter_limits_bucket ON letter_limits(bucket);

-- Playlist tracks managed by the admin dashboard. Public GET /tracks is read-only.
-- Keep this table structural here; the 2026-10-30-admin-tracks migration seeds
-- the original Golden Folder playlist exactly once.
CREATE TABLE IF NOT EXISTS tracks (
  id          TEXT PRIMARY KEY,              -- admin-created 32-hex id, or seeded slug
  title       TEXT NOT NULL,
  artist      TEXT NOT NULL DEFAULT '',
  audio_url   TEXT NOT NULL,                 -- absolute https URL or same-site relative path
  artwork_url TEXT DEFAULT NULL,             -- optional custom cover
  duration    INTEGER DEFAULT NULL,          -- seconds, NULL when unknown
  tags        TEXT NOT NULL DEFAULT '[]',    -- JSON array of lowercase tags
  position    INTEGER NOT NULL DEFAULT 0,    -- playlist order, ascending
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracks_position ON tracks(position);
