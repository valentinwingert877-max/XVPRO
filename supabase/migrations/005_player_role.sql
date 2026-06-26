-- Migration 005 : role joueur/coach
-- Run in Supabase SQL editor

-- Optionnel : vue pour faciliter les requetes par role
CREATE OR REPLACE VIEW public.user_roles AS
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' AS role,
  raw_user_meta_data->>'full_name' AS full_name,
  raw_user_meta_data->>'club_name' AS club_name
FROM auth.users;

-- Acces lecture aux joueurs sur les matchs via player_profiles
-- (utilise DO block car IF NOT EXISTS n'est pas supporte)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'matches' AND policyname = 'player_read_linked_matches'
  ) THEN
    CREATE POLICY "player_read_linked_matches" ON matches
      FOR SELECT USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM player_profiles pp
          WHERE pp.match_id = matches.id
            AND pp.user_id = auth.uid()
        )
      );
  END IF;
END $$;
