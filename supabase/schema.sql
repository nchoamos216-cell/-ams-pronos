-- ============================================================
-- AMS PRONOS — Schéma Supabase (PostgreSQL)
-- ============================================================
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

-- Extension pour UUID
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. COMPÉTITIONS
-- ------------------------------------------------------------
create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,                -- ex: "Ligue 1", "Premier League"
  country text,
  external_id text unique,           -- id de la source de scraping
  logo_url text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. ÉQUIPES
-- ------------------------------------------------------------
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  country text,
  logo_url text,
  external_id text unique,           -- id de la source de scraping
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 3. MATCHS (calendrier + résultats)
-- ------------------------------------------------------------
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,           -- id de la source (évite les doublons)
  competition_id uuid references competitions(id) on delete set null,
  home_team_id uuid not null references teams(id) on delete cascade,
  away_team_id uuid not null references teams(id) on delete cascade,
  match_date timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),

  -- Résultat (rempli une fois le match terminé)
  home_goals int,
  away_goals int,
  home_goals_ht int,                 -- score mi-temps
  away_goals_ht int,
  home_red_cards int default 0,
  away_red_cards int default 0,
  home_yellow_cards int default 0,
  away_yellow_cards int default 0,
  home_penalties int default 0,
  away_penalties int default 0,
  home_corners int default 0,
  away_corners int default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_matches_date on matches(match_date);
create index if not exists idx_matches_teams on matches(home_team_id, away_team_id);
create index if not exists idx_matches_status on matches(status);

-- ------------------------------------------------------------
-- 4. HISTORIQUE H2H (vue matérialisée / table dédiée)
-- ------------------------------------------------------------
-- On stocke une table dédiée h2h_pairs qui référence les matchs passés
-- entre deux équipes, avec un flag "sens" (home/away réel de l'époque).
create table if not exists h2h_history (
  id uuid primary key default gen_random_uuid(),
  team_a_id uuid not null references teams(id) on delete cascade,
  team_b_id uuid not null references teams(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  match_date timestamptz not null,
  -- Résultat normalisé du point de vue de team_a
  team_a_was_home boolean not null,
  team_a_goals int not null,
  team_b_goals int not null,
  btts boolean generated always as (team_a_goals > 0 and team_b_goals > 0) stored,
  total_goals int generated always as (team_a_goals + team_b_goals) stored,
  over_2_5 boolean generated always as ((team_a_goals + team_b_goals) > 2) stored,
  home_win boolean,                  -- victoire de l'équipe qui recevait
  red_card boolean default false,
  created_at timestamptz default now(),
  unique(team_a_id, team_b_id, match_id)
);

create index if not exists idx_h2h_pair on h2h_history(team_a_id, team_b_id, match_date desc);

-- ------------------------------------------------------------
-- 5. PRONOSTICS GÉNÉRÉS
-- ------------------------------------------------------------
create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  market text not null,              -- ex: 'BTTS', 'OVER_2_5', 'HOME_WIN', 'RED_CARD'
  suggested_outcome text not null,   -- ex: 'YES', 'NO', 'HOME', 'AWAY', 'DRAW'
  streak_length int not null,        -- nb de matchs H2H consécutifs où l'option ne s'est PAS produite
  poisson_probability numeric(5,4),  -- probabilité issue du modèle de Poisson (0 à 1)
  confidence_score numeric(5,2),     -- score de confiance final 0-100
  reasoning text,                    -- texte explicatif généré
  generated_at timestamptz default now(),
  unique(match_id, market)
);

create index if not exists idx_predictions_match on predictions(match_id);
create index if not exists idx_predictions_confidence on predictions(confidence_score desc);

-- ------------------------------------------------------------
-- 6. FORME RÉCENTE DES ÉQUIPES (pour le modèle de Poisson)
-- ------------------------------------------------------------
create table if not exists team_form (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  computed_at timestamptz default now(),
  matches_analyzed int not null default 10,
  avg_goals_scored numeric(5,2),
  avg_goals_conceded numeric(5,2),
  avg_goals_scored_home numeric(5,2),
  avg_goals_scored_away numeric(5,2),
  avg_goals_conceded_home numeric(5,2),
  avg_goals_conceded_away numeric(5,2),
  unique(team_id)
);

-- ------------------------------------------------------------
-- 7. TRIGGER updated_at
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_matches_updated_at on matches;
create trigger trg_matches_updated_at
before update on matches
for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 8. RLS (Row Level Security) — lecture publique, écriture service_role uniquement
-- ------------------------------------------------------------
alter table competitions enable row level security;
alter table teams enable row level security;
alter table matches enable row level security;
alter table h2h_history enable row level security;
alter table predictions enable row level security;
alter table team_form enable row level security;

create policy "Public read access" on competitions for select using (true);
create policy "Public read access" on teams for select using (true);
create policy "Public read access" on matches for select using (true);
create policy "Public read access" on h2h_history for select using (true);
create policy "Public read access" on predictions for select using (true);
create policy "Public read access" on team_form for select using (true);

-- Seule la service_role key (utilisée par le script Python et les routes serveur)
-- peut insérer/mettre à jour ; aucune policy INSERT/UPDATE n'est créée pour "anon",
-- donc ces opérations sont refusées par défaut pour le rôle public.

-- ------------------------------------------------------------
-- 9. Vue pratique : matchs du jour avec équipes
-- ------------------------------------------------------------
create or replace view v_upcoming_matches as
select
  m.id,
  m.match_date,
  m.status,
  c.name as competition_name,
  ht.id as home_team_id,
  ht.name as home_team_name,
  ht.logo_url as home_team_logo,
  at.id as away_team_id,
  at.name as away_team_name,
  at.logo_url as away_team_logo
from matches m
join teams ht on ht.id = m.home_team_id
join teams at on at.id = m.away_team_id
left join competitions c on c.id = m.competition_id
where m.status = 'scheduled'
order by m.match_date asc;
