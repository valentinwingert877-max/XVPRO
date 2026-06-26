-- ============================================================
-- XVPRO -- Migration 006 : Clubs
-- Run in Supabase SQL editor
-- ============================================================

-- 1. Table clubs
CREATE TABLE IF NOT EXISTS clubs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  code       TEXT UNIQUE NOT NULL,
  owner_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table membres du club
CREATE TABLE IF NOT EXISTS club_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id   UUID REFERENCES clubs(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT CHECK (role IN ('owner', 'coach', 'player')) DEFAULT 'coach',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (club_id, user_id)
);

-- 3. RLS
ALTER TABLE clubs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

-- Le president voit son club
CREATE POLICY "owner_see_own_club" ON clubs
  FOR ALL USING (owner_id = auth.uid());

-- Les membres voient le club auquel ils appartiennent
CREATE POLICY "members_see_club" ON clubs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = clubs.id AND cm.user_id = auth.uid()
    )
  );

-- Le president voit tous les membres de son club
CREATE POLICY "owner_see_members" ON club_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clubs c
      WHERE c.id = club_members.club_id AND c.owner_id = auth.uid()
    )
  );

-- Chaque membre voit les autres membres de son club
CREATE POLICY "members_see_members" ON club_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM club_members cm2
      WHERE cm2.club_id = club_members.club_id AND cm2.user_id = auth.uid()
    )
  );

-- Fonction pour generer un code club unique
CREATE OR REPLACE FUNCTION generate_club_code(club_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base TEXT;
  code TEXT;
  exists BOOLEAN;
BEGIN
  base := UPPER(SUBSTRING(REGEXP_REPLACE(club_name, '[^a-zA-Z0-9]', '', 'g'), 1, 4));
  LOOP
    code := base || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));
    SELECT EXISTS(SELECT 1 FROM clubs WHERE clubs.code = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;
