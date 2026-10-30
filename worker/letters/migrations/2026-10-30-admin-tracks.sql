-- Migration 2026-10-30: admin-managed playlist tracks.
-- Additive only. Seeds the seven tracks that already shipped in
-- golden-folder.js so the public site is byte-for-byte the same playlist after
-- deployment; admins can then edit, remove or reorder them.
--
-- Apply from the repo root. Pass the binding `DB`, not a database name:
-- wrangler resolves it through database_id 559070d9-afb4-471e-8839-78866e9437a1
-- in worker/letters/wrangler.toml, so a mismatched display name cannot
-- redirect the write. Run only after `wrangler d1 list` shows that id.
--
--   cd worker/letters && wrangler d1 execute DB --remote \
--     --file=migrations/2026-10-30-admin-tracks.sql

CREATE TABLE IF NOT EXISTS tracks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  artist      TEXT NOT NULL DEFAULT '',
  audio_url   TEXT NOT NULL,
  artwork_url TEXT DEFAULT NULL,
  duration    INTEGER DEFAULT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracks_position ON tracks(position);

INSERT OR IGNORE INTO tracks (id, title, artist, audio_url, artwork_url, duration, tags, position, created_at, updated_at) VALUES
  ('gf-adagio', 'Adagio - Florence Robineau', '', 'https://pub-fa04af4cffb74c979c0f18d50fa5f218.r2.dev/Adagio%20-%20Florence%20Robineau.mp3', NULL, NULL, '[]', 0, CAST(strftime('%s','now') AS INTEGER), CAST(strftime('%s','now') AS INTEGER)),
  ('gf-conquest', 'Conquest of Paradise', '', 'https://pub-fa04af4cffb74c979c0f18d50fa5f218.r2.dev/Conquest-of-Paradise.mp3', NULL, NULL, '[]', 1, CAST(strftime('%s','now') AS INTEGER), CAST(strftime('%s','now') AS INTEGER)),
  ('gf-asturias', 'Asturias - Featuring Frank Hiemenz', '', 'https://pub-fa04af4cffb74c979c0f18d50fa5f218.r2.dev/Asturias%20-%20Featuring%20Frank%20Hiemenz.mp3', NULL, NULL, '[]', 2, CAST(strftime('%s','now') AS INTEGER), CAST(strftime('%s','now') AS INTEGER)),
  ('gf-a-toi', 'A-Toi', '', 'https://pub-fa04af4cffb74c979c0f18d50fa5f218.r2.dev/A-Toi.mp3', NULL, NULL, '[]', 3, CAST(strftime('%s','now') AS INTEGER), CAST(strftime('%s','now') AS INTEGER)),
  ('gf-piano-sleep', 'Piano Music for Sleep', '', 'https://pub-fa04af4cffb74c979c0f18d50fa5f218.r2.dev/Piano-Music-for-Sleep.mp3', NULL, NULL, '[]', 4, CAST(strftime('%s','now') AS INTEGER), CAST(strftime('%s','now') AS INTEGER)),
  ('gf-rachmaninoff', 'The Most Beautiful Rachmaninoff', '', 'https://pub-fa04af4cffb74c979c0f18d50fa5f218.r2.dev/The-Most-Beautiful-Rachmaninoff.mp3', NULL, NULL, '[]', 5, CAST(strftime('%s','now') AS INTEGER), CAST(strftime('%s','now') AS INTEGER)),
  ('gf-ave-maria', 'Tania Kassis - Ave Maria', '', 'https://pub-fa04af4cffb74c979c0f18d50fa5f218.r2.dev/Tania%20Kassis%20-%20Ave%20Maria.mp3', NULL, NULL, '[]', 6, CAST(strftime('%s','now') AS INTEGER), CAST(strftime('%s','now') AS INTEGER));
