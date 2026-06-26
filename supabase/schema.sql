-- ================================================================
-- XVPRO — Schéma Supabase
-- Coller dans : Supabase Dashboard > SQL Editor > New query
-- ================================================================

-- Extension UUID
create extension if not exists "uuid-ossp";

-- ── Profils utilisateurs (liés à auth.users de Supabase) ────────
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  full_name   text,
  club_name   text,
  plan        text default 'free' check (plan in ('free','starter','club','pro')),
  created_at  timestamptz default now()
);

-- Crée automatiquement un profil à l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Équipes ──────────────────────────────────────────────────────
create table public.teams (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references auth.users on delete cascade not null,
  name        text not null,
  category    text,
  season      text default '2025-2026',
  created_at  timestamptz default now()
);

-- ── Matchs ───────────────────────────────────────────────────────
create table public.matches (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references auth.users on delete cascade not null,
  team_id         uuid references public.teams on delete set null,
  team_home       text not null default '',
  team_away       text not null default '',
  competition     text,
  match_date      date,
  score_home      integer,
  score_away      integer,
  video_url       text,         -- URL publique de la vidéo (après upload)
  status          text default 'pending'
                  check (status in ('pending','processing','done','error')),
  progress_pct    integer default 0,
  error_msg       text,
  analyzed_at     timestamptz,
  created_at      timestamptz default now()
);

-- ── Actions détectées par l'IA ──────────────────────────────────
create table public.match_actions (
  id            uuid default uuid_generate_v4() primary key,
  match_id      uuid references public.matches on delete cascade not null,
  action_type   text not null,
  timecode_sec  float not null,
  timecode_str  text,
  description   text,
  confidence    float,
  pos_x         float,
  pos_y         float,
  clip_url      text,
  created_at    timestamptz default now()
);

-- ── Statistiques de match ────────────────────────────────────────
create table public.match_stats (
  id                    uuid default uuid_generate_v4() primary key,
  match_id              uuid references public.matches on delete cascade unique not null,
  possession_home       float,
  territory_home        float,
  tries_home            integer default 0,
  tries_away            integer default 0,
  tackles_home          integer default 0,
  tackles_success_home  integer default 0,
  penalties_home        integer default 0,
  penalties_away        integer default 0,
  scrums_home           integer default 0,
  scrums_won_home       integer default 0,
  lineouts_home         integer default 0,
  lineouts_won_home     integer default 0,
  heatmap_home          jsonb,
  heatmap_away          jsonb
);

-- ── Rapports IA ─────────────────────────────────────────────────
create table public.reports (
  id          uuid default uuid_generate_v4() primary key,
  match_id    uuid references public.matches on delete cascade unique not null,
  content     text,
  summary     text,
  strengths   jsonb,
  weaknesses  jsonb,
  tactics     jsonb,
  created_at  timestamptz default now()
);

-- ── RLS (Row Level Security) ─────────────────────────────────────
-- Chaque utilisateur ne voit que SES données

alter table public.profiles      enable row level security;
alter table public.teams         enable row level security;
alter table public.matches       enable row level security;
alter table public.match_actions enable row level security;
alter table public.match_stats   enable row level security;
alter table public.reports       enable row level security;

-- Profiles
create policy "Users see own profile"
  on public.profiles for all using (auth.uid() = id);

-- Teams
create policy "Users manage own teams"
  on public.teams for all using (auth.uid() = user_id);

-- Matches
create policy "Users manage own matches"
  on public.matches for all using (auth.uid() = user_id);

-- Actions (accès via le match)
create policy "Users see actions of own matches"
  on public.match_actions for all
  using (match_id in (select id from public.matches where user_id = auth.uid()));

-- Stats
create policy "Users see stats of own matches"
  on public.match_stats for all
  using (match_id in (select id from public.matches where user_id = auth.uid()));

-- Reports
create policy "Users see reports of own matches"
  on public.reports for all
  using (match_id in (select id from public.matches where user_id = auth.uid()));
