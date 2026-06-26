-- =============================================
-- XVPRO Admin Setup
-- A executer dans Supabase > SQL Editor
-- =============================================

-- 1. Colonnes sur profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role       TEXT    DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan       TEXT    DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;

-- 2. Te definir comme admin (remplace l'email si besoin)
UPDATE profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'petitwinge87@gmail.com');

-- 3. RPC : lire tous les profils (admin only)
CREATE OR REPLACE FUNCTION admin_get_all_profiles()
RETURNS TABLE (
  id          UUID,
  email       TEXT,
  full_name   TEXT,
  club_name   TEXT,
  role        TEXT,
  plan        TEXT,
  is_blocked  BOOLEAN,
  match_count BIGINT,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    p.id, u.email, p.full_name, p.club_name,
    p.role, p.plan, p.is_blocked,
    (SELECT COUNT(*) FROM matches m WHERE m.user_id = p.id),
    p.created_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  ORDER BY p.created_at DESC;
$$;

-- 4. RPC : lire tous les matchs (admin only)
CREATE OR REPLACE FUNCTION admin_get_all_matches()
RETURNS TABLE (
  id          UUID,
  user_id     UUID,
  user_email  TEXT,
  team_home   TEXT,
  team_away   TEXT,
  competition TEXT,
  match_date  DATE,
  score_home  INT,
  score_away  INT,
  status      TEXT,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    m.id, m.user_id, u.email,
    m.team_home, m.team_away, m.competition,
    m.match_date, m.score_home, m.score_away,
    m.status, m.created_at
  FROM matches m
  JOIN auth.users u ON u.id = m.user_id
  WHERE (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  ORDER BY m.created_at DESC;
$$;

-- 5. RPC : compter toutes les actions (admin only)
CREATE OR REPLACE FUNCTION admin_count_actions()
RETURNS BIGINT
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT COUNT(*)
  FROM match_actions
  WHERE (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin';
$$;

-- 6. RPC : changer le plan d'un user
CREATE OR REPLACE FUNCTION admin_set_user_plan(target_user_id UUID, new_plan TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE profiles
  SET plan = new_plan
  WHERE id = target_user_id
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin';
$$;

-- 7. RPC : bloquer / debloquer un user
CREATE OR REPLACE FUNCTION admin_set_user_blocked(target_user_id UUID, blocked BOOLEAN)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE profiles
  SET is_blocked = blocked
  WHERE id = target_user_id
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin';
$$;
