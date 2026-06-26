-- Migration 007 : Subscriptions Stripe
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id  TEXT UNIQUE,
  stripe_sub_id       TEXT UNIQUE,
  plan                TEXT CHECK (plan IN ('player', 'coach', 'club')) NOT NULL,
  status              TEXT DEFAULT 'active',  -- active, canceled, past_due
  current_period_end  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Chaque user voit uniquement son abonnement
CREATE POLICY "user_own_subscription" ON subscriptions
  FOR ALL USING (user_id = auth.uid());

-- Admin voit tout
CREATE POLICY "admin_all_subscriptions" ON subscriptions
  FOR ALL USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin'
  );
