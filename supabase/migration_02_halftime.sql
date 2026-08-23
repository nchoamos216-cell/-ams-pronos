-- ============================================================
-- AMS PRONOS — Migration : mi-temps H2H + nettoyage cartons rouges
-- À exécuter dans Supabase SQL Editor (une seule fois)
-- ============================================================

-- 1. Ajouter les scores mi-temps à l'historique H2H
--    (nécessaires pour les nouveaux marchés : victoire 1re/2e mi-temps,
--    but dans chaque mi-temps, nul dans au moins une mi-temps)
alter table h2h_history
  add column if not exists team_a_goals_ht int,
  add column if not exists team_b_goals_ht int;

-- 2. Supprimer les anciens pronostics "Carton rouge" (marché retiré)
delete from predictions where market = 'RED_CARD';

-- 3. Rafraîchir le cache de schéma PostgREST pour que l'API voie
--    immédiatement les nouvelles colonnes
notify pgrst, 'reload schema';
