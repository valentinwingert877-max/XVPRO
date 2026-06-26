-- ============================================================
-- XVPRO -- Player tracking migration
-- Run in Supabase SQL editor
-- ============================================================

-- 1. Profils joueurs : le coach mappe track_id -> nom
CREATE TABLE IF NOT EXISTS player_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID REFERENCES matches(id) ON DELETE CASCADE,
  track_id        INTEGER NOT NULL,
  name            TEXT,
  jersey_number   INTEGER,
  position        TEXT,
  team            TEXT,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, track_id)
);

-- 2. Stats individuelles par joueur et par match
CREATE TABLE IF NOT EXISTS player_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID REFERENCES matches(id) ON DELETE CASCADE,
  track_id        INTEGER NOT NULL,
  total_actions   INTEGER DEFAULT 0,
  tackles         INTEGER DEFAULT 0,
  rucks           INTEGER DEFAULT 0,
  carries         INTEGER DEFAULT 0,
  lineouts        INTEGER DEFAULT 0,
  scrums          INTEGER DEFAULT 0,
  penalties       INTEGER DEFAULT 0,
  try_involvement INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, track_id)
);

-- 3. RLS
ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats     ENABLE ROW LEVEL SECURITY;

-- Coach voit tout pour ses matchs
CREATE POLICY "coach_all_player_profiles" ON player_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = player_profiles.match_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "coach_all_player_stats" ON player_stats
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = player_stats.match_id
        AND m.user_id = auth.uid()
    )
  );

-- Joueur voit ses propres stats (via user_id dans player_profiles)
CREATE POLICY "player_read_own_profiles" ON player_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "player_read_own_stats" ON player_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM player_profiles pp
      WHERE pp.match_id = player_stats.match_id
        AND pp.track_id  = player_stats.track_id
        AND pp.user_id   = auth.uid()
    )
  );
