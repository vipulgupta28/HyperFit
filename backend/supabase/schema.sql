-- ============================================================
-- Mates Territory Run – Supabase Schema
-- Paste and run this entire file in the Supabase SQL Editor.
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,
  color           TEXT NOT NULL,
  total_distance  DOUBLE PRECISION NOT NULL DEFAULT 0,
  territory_count INTEGER          NOT NULL DEFAULT 0,
  rank            INTEGER          NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_territory ON users (territory_count DESC);
CREATE INDEX IF NOT EXISTS idx_users_username  ON users (username);

-- ── runs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runs (
  id                        UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   TEXT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                    TEXT  NOT NULL CHECK (status IN ('active', 'ended', 'cancelled')),
  path                      JSONB NOT NULL DEFAULT '[]',
  distance                  DOUBLE PRECISION NOT NULL DEFAULT 0,
  duration                  BIGINT NOT NULL DEFAULT 0,     -- milliseconds
  started_at                TIMESTAMPTZ NOT NULL,
  ended_at                  TIMESTAMPTZ,
  captured_tile_ids         TEXT[] NOT NULL DEFAULT '{}',
  mode                      TEXT  NOT NULL CHECK (mode IN ('walk', 'run')),
  live_tiles_snap           JSONB,
  tile_effort_pending       JSONB,
  net_territory_delta_accum INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_runs_user_started ON runs (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status       ON runs (status) WHERE status = 'active';

-- ── tiles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tiles (
  h3_index     TEXT PRIMARY KEY,
  owner_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  owner_color  TEXT,
  strength     INTEGER     NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tiles_owner ON tiles (owner_id) WHERE owner_id IS NOT NULL;

-- ── posts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username      TEXT NOT NULL,
  user_color    TEXT NOT NULL,
  run_id        UUID REFERENCES runs(id) ON DELETE SET NULL,
  image_uris    TEXT[] NOT NULL DEFAULT '{}',
  description   TEXT   NOT NULL DEFAULT '',
  distance      DOUBLE PRECISION NOT NULL DEFAULT 0,
  duration      BIGINT NOT NULL DEFAULT 0,
  pace          DOUBLE PRECISION NOT NULL DEFAULT 0,
  mode          TEXT NOT NULL CHECK (mode IN ('walk', 'run')),
  path          JSONB NOT NULL DEFAULT '[]',
  liked_by      TEXT[] NOT NULL DEFAULT '{}',
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user    ON posts (user_id);

-- ── comments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username   TEXT NOT NULL,
  user_color TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id, created_at ASC);

-- ── functions ─────────────────────────────────────────────────

-- Decay all owned tiles. Returns every row that was updated.
CREATE OR REPLACE FUNCTION decay_tiles(decay_amount INTEGER DEFAULT 1)
RETURNS SETOF tiles
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE tiles
  SET
    strength     = GREATEST(0, strength - decay_amount),
    owner_id     = CASE WHEN strength - decay_amount <= 0 THEN NULL ELSE owner_id END,
    owner_color  = CASE WHEN strength - decay_amount <= 0 THEN NULL ELSE owner_color END,
    last_updated = NOW()
  WHERE owner_id IS NOT NULL
  RETURNING *;
$$;

-- Recompute user ranks by territory_count using a window function.
CREATE OR REPLACE FUNCTION recompute_ranks()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE users u
  SET rank = sub.new_rank
  FROM (
    SELECT id, RANK() OVER (ORDER BY territory_count DESC) AS new_rank
    FROM users
  ) sub
  WHERE u.id = sub.id;
$$;

-- ── Row Level Security ─────────────────────────────────────────
-- The backend connects with the service role key which bypasses RLS.
-- RLS is enabled here to block any direct anon/client key access.
ALTER TABLE users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Uncomment to allow read-only public access via the anon key (e.g. for a web viewer):
-- CREATE POLICY "anon_read_users"    ON users    FOR SELECT TO anon USING (true);
-- CREATE POLICY "anon_read_tiles"    ON tiles    FOR SELECT TO anon USING (true);
-- CREATE POLICY "anon_read_posts"    ON posts    FOR SELECT TO anon USING (true);
-- CREATE POLICY "anon_read_comments" ON comments FOR SELECT TO anon USING (true);
