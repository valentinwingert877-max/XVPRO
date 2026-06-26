-- =============================================
-- XVPRO Stats Migration — Stats enrichies
-- A executer dans Supabase > SQL Editor
-- =============================================

-- 1. match_actions : ajout zone + team + penalty_type
ALTER TABLE match_actions ADD COLUMN IF NOT EXISTS zone         TEXT;
ALTER TABLE match_actions ADD COLUMN IF NOT EXISTS team         TEXT;
ALTER TABLE match_actions ADD COLUMN IF NOT EXISTS penalty_type TEXT;

-- 2. match_stats : stats completes home vs away + halves
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS possession_home        NUMERIC DEFAULT 50;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS possession_away        NUMERIC DEFAULT 50;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS territory_home         NUMERIC DEFAULT 50;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS territory_away         NUMERIC DEFAULT 50;

ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS tackles_home           INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS tackles_away           INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS tackles_success_home   INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS tackles_success_away   INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS tackles_missed_home    INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS tackles_missed_away    INT DEFAULT 0;

ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS rucks_won_home         INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS rucks_won_away         INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS rucks_lost_home        INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS rucks_lost_away        INT DEFAULT 0;

ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS lineouts_won_home      INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS lineouts_won_away      INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS lineouts_lost_home     INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS lineouts_lost_away     INT DEFAULT 0;

ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS scrums_won_home        INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS scrums_won_away        INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS scrums_lost_home       INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS scrums_lost_away       INT DEFAULT 0;

ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS penalties_home         INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS penalties_away         INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS penalties_breakdown    JSONB;

ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS knock_ons_home         INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS knock_ons_away         INT DEFAULT 0;

ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS meters_gained_home     NUMERIC DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS meters_gained_away     NUMERIC DEFAULT 0;

ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS carries_home           INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS carries_away           INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS passes_home            INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS passes_away            INT DEFAULT 0;

ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS tries_home             INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS tries_away             INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS conversions_home       INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS conversions_away       INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS yellow_cards_home      INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS yellow_cards_away      INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS red_cards_home         INT DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS red_cards_away         INT DEFAULT 0;

ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS stats_first_half       JSONB;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS stats_second_half      JSONB;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS success_rate           NUMERIC DEFAULT 0;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS effective_time_sec     INT DEFAULT 0;
