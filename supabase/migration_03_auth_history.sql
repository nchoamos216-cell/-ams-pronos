-- ============================================================
-- AMS PRONOS — Migration 03 : comptes utilisateurs + historique
-- À exécuter dans Supabase SQL Editor (une seule fois)
-- ============================================================

-- 1. Suivi de performance : chaque pronostic peut être évalué une fois
--    le match terminé (correct / incorrect / pas encore évalué).
alter table predictions
  add column if not exists actual_outcome text,       -- ex: 'YES', 'NO', 'HOME', 'AWAY'
  add column if not exists is_correct boolean,         -- null = pas encore évalué
  add column if not exists evaluated_at timestamptz;

create index if not exists idx_predictions_evaluated
  on predictions(is_correct)
  where is_correct is not null;

-- 2. Favoris utilisateurs (nécessite Supabase Auth, activé par défaut)
create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, match_id)
);

create index if not exists idx_favorites_user on favorites(user_id);

alter table favorites enable row level security;

-- Chaque utilisateur ne voit et ne modifie que SES PROPRES favoris.
create policy "Users manage their own favorites"
  on favorites
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
