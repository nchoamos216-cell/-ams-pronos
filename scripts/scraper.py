"""
AMS PRONOS — Script de collecte de données (Cron quotidien)
=============================================================
Rôle :
  1. Récupérer les matchs à venir (J à J+3) d'une source gratuite
  2. Récupérer/actualiser l'historique H2H entre les deux équipes
  3. Upserter tout ça dans Supabase (matches, teams, h2h_history)
  4. Recalculer la "forme récente" (team_form) utilisée par le modèle de Poisson

Source de données :
  Ce script est écrit pour l'API gratuite "football-data.org" (tier free,
  10 requêtes/minute, quelques compétitions majeures). Si tu préfères scraper
  un site (ex. flashscore, sofascore) avec Playwright, remplace uniquement
  les fonctions fetch_upcoming_matches() et fetch_h2h() — le reste
  (upsert Supabase, calcul de forme) ne change pas.

Variables d'environnement requises (secrets GitHub Actions) :
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY   (clé service_role, jamais la clé anon)
  - FOOTBALL_DATA_API_KEY       (clé gratuite sur https://www.football-data.org)
"""

import os
import sys
import time
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import requests
from supabase import create_client, Client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("ams-pronos-scraper")

# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
FOOTBALL_DATA_API_KEY = os.environ["FOOTBALL_DATA_API_KEY"]

FOOTBALL_DATA_BASE = "https://api.football-data.org/v4"
HEADERS = {"X-Auth-Token": FOOTBALL_DATA_API_KEY}

# Compétitions gratuites couvertes par football-data.org (codes officiels)
# Top 5 championnats + Eredivisie = 6 "grands" championnats couverts par le tier gratuit.
# (D'autres comme Primeira Liga (PPL) ou Championship (ELC) peuvent être ajoutés
#  de la même façon si le quota de 10 req/min le permet.)
COMPETITIONS = ["PL", "FL1", "PD", "SA", "BL1", "DED", "CL"]

H2H_MIN_MATCHES = 5
H2H_MAX_MATCHES = 10

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# ------------------------------------------------------------------
# Utilitaires HTTP avec retry / rate-limit (tier gratuit = 10 req/min)
# ------------------------------------------------------------------
def api_get(path: str, params: dict | None = None) -> dict:
    url = f"{FOOTBALL_DATA_BASE}{path}"
    for attempt in range(3):
        resp = requests.get(url, headers=HEADERS, params=params, timeout=20)
        if resp.status_code == 429:
            log.warning("Rate limit atteint, pause de 60s...")
            time.sleep(60)
            continue
        resp.raise_for_status()
        time.sleep(6.5)  # ~9 req/min pour rester sous la limite gratuite
        return resp.json()
    raise RuntimeError(f"Échec API après 3 tentatives : {url}")


# ------------------------------------------------------------------
# 1. Upsert équipe / compétition
# ------------------------------------------------------------------
def upsert_competition(comp: dict[str, Any]) -> str:
    row = {
        "external_id": str(comp["id"]),
        "name": comp["name"],
        "country": comp.get("area", {}).get("name"),
        "logo_url": comp.get("emblem"),
    }
    res = (
        supabase.table("competitions")
        .upsert(row, on_conflict="external_id")
        .execute()
    )
    return res.data[0]["id"]


def upsert_team(team: dict[str, Any]) -> str:
    row = {
        "external_id": str(team["id"]),
        "name": team["name"],
        "short_name": team.get("shortName") or team.get("tla"),
        "logo_url": team.get("crest"),
    }
    res = supabase.table("teams").upsert(row, on_conflict="external_id").execute()
    return res.data[0]["id"]


def upsert_match(match: dict[str, Any], competition_uuid: str,
                  home_uuid: str, away_uuid: str) -> str:
    score = match.get("score", {})
    full_time = score.get("fullTime", {})
    half_time = score.get("halfTime", {})

    status_map = {
        "SCHEDULED": "scheduled", "TIMED": "scheduled",
        "IN_PLAY": "live", "PAUSED": "live",
        "FINISHED": "finished",
        "POSTPONED": "postponed", "CANCELLED": "cancelled", "SUSPENDED": "postponed",
    }

    row = {
        "external_id": str(match["id"]),
        "competition_id": competition_uuid,
        "home_team_id": home_uuid,
        "away_team_id": away_uuid,
        "match_date": match["utcDate"],
        "status": status_map.get(match.get("status"), "scheduled"),
        "home_goals": full_time.get("home"),
        "away_goals": full_time.get("away"),
        "home_goals_ht": half_time.get("home"),
        "away_goals_ht": half_time.get("away"),
    }
    res = supabase.table("matches").upsert(row, on_conflict="external_id").execute()
    return res.data[0]["id"]


# ------------------------------------------------------------------
# 2. Récupération des matchs à venir
# ------------------------------------------------------------------
def fetch_upcoming_matches() -> list[dict]:
    date_from = datetime.now(timezone.utc).date()
    date_to = date_from + timedelta(days=3)
    all_matches = []

    for comp_code in COMPETITIONS:
        log.info(f"Récupération des matchs à venir — {comp_code}")
        data = api_get(
            f"/competitions/{comp_code}/matches",
            params={
                "dateFrom": date_from.isoformat(),
                "dateTo": date_to.isoformat(),
                "status": "SCHEDULED",
            },
        )
        for m in data.get("matches", []):
            m["_competition"] = data.get("competition", {})
            all_matches.append(m)

    log.info(f"{len(all_matches)} matchs à venir trouvés au total")
    return all_matches


def fetch_recent_results() -> list[dict]:
    """Récupère les matchs terminés des 3 derniers jours pour mettre à jour
    leur statut et leur score (nécessaire pour évaluer les pronostics passés)."""
    date_from = datetime.now(timezone.utc).date() - timedelta(days=3)
    date_to = datetime.now(timezone.utc).date()
    all_matches = []

    for comp_code in COMPETITIONS:
        log.info(f"Récupération des résultats récents — {comp_code}")
        data = api_get(
            f"/competitions/{comp_code}/matches",
            params={
                "dateFrom": date_from.isoformat(),
                "dateTo": date_to.isoformat(),
                "status": "FINISHED",
            },
        )
        for m in data.get("matches", []):
            m["_competition"] = data.get("competition", {})
            all_matches.append(m)

    log.info(f"{len(all_matches)} résultats récents trouvés au total")
    return all_matches


# ------------------------------------------------------------------
# 3. Historique H2H entre deux équipes
# ------------------------------------------------------------------
def fetch_h2h(match_external_id: str) -> list[dict]:
    """football-data.org expose un endpoint dédié /matches/{id}/head2head"""
    data = api_get(
        f"/matches/{match_external_id}/head2head",
        params={"limit": H2H_MAX_MATCHES},
    )
    return data.get("matches", [])


def store_h2h(team_a_uuid: str, team_b_uuid: str, h2h_matches: list[dict],
              team_a_external_id: str) -> None:
    if len(h2h_matches) < H2H_MIN_MATCHES:
        log.info(
            f"Historique H2H insuffisant ({len(h2h_matches)} < {H2H_MIN_MATCHES}), ignoré"
        )
        return

    for hm in h2h_matches:
        if hm.get("status") != "FINISHED":
            continue
        score = hm.get("score", {}).get("fullTime", {})
        score_ht = hm.get("score", {}).get("halfTime", {})
        if score.get("home") is None or score.get("away") is None:
            continue

        home_team_ext = str(hm["homeTeam"]["id"])
        team_a_was_home = home_team_ext == team_a_external_id
        team_a_goals = score["home"] if team_a_was_home else score["away"]
        team_b_goals = score["away"] if team_a_was_home else score["home"]
        team_a_goals_ht = score_ht.get("home") if team_a_was_home else score_ht.get("away")
        team_b_goals_ht = score_ht.get("away") if team_a_was_home else score_ht.get("home")
        home_win = (score["home"] > score["away"])

        # Le match doit d'abord exister dans `matches` (au moins comme référence minimale)
        match_row = {
            "external_id": str(hm["id"]),
            "match_date": hm["utcDate"],
            "status": "finished",
            "home_team_id": team_a_uuid if team_a_was_home else team_b_uuid,
            "away_team_id": team_b_uuid if team_a_was_home else team_a_uuid,
            "home_goals": score["home"],
            "away_goals": score["away"],
            "home_goals_ht": score_ht.get("home"),
            "away_goals_ht": score_ht.get("away"),
        }
        match_res = (
            supabase.table("matches")
            .upsert(match_row, on_conflict="external_id")
            .execute()
        )
        match_uuid = match_res.data[0]["id"]

        h2h_row = {
            "team_a_id": team_a_uuid,
            "team_b_id": team_b_uuid,
            "match_id": match_uuid,
            "match_date": hm["utcDate"],
            "team_a_was_home": team_a_was_home,
            "team_a_goals": team_a_goals,
            "team_b_goals": team_b_goals,
            "team_a_goals_ht": team_a_goals_ht,
            "team_b_goals_ht": team_b_goals_ht,
            "home_win": home_win,
        }
        supabase.table("h2h_history").upsert(
            h2h_row, on_conflict="team_a_id,team_b_id,match_id"
        ).execute()

    log.info(f"H2H stocké pour la paire {team_a_uuid[:8]}.../{team_b_uuid[:8]}...")


# ------------------------------------------------------------------
# 4. Forme récente (moyennes de buts) pour le modèle de Poisson
# ------------------------------------------------------------------
def recompute_team_form(team_uuid: str, n_matches: int = 10) -> None:
    finished = (
        supabase.table("matches")
        .select("*")
        .or_(f"home_team_id.eq.{team_uuid},away_team_id.eq.{team_uuid}")
        .eq("status", "finished")
        .order("match_date", desc=True)
        .limit(n_matches)
        .execute()
    ).data

    if not finished:
        return

    scored, conceded = [], []
    scored_home, conceded_home = [], []
    scored_away, conceded_away = [], []

    for m in finished:
        is_home = m["home_team_id"] == team_uuid
        gf = m["home_goals"] if is_home else m["away_goals"]
        ga = m["away_goals"] if is_home else m["home_goals"]
        if gf is None or ga is None:
            continue
        scored.append(gf)
        conceded.append(ga)
        if is_home:
            scored_home.append(gf)
            conceded_home.append(ga)
        else:
            scored_away.append(gf)
            conceded_away.append(ga)

    def avg(lst):
        return round(sum(lst) / len(lst), 2) if lst else None

    row = {
        "team_id": team_uuid,
        "matches_analyzed": len(scored),
        "avg_goals_scored": avg(scored),
        "avg_goals_conceded": avg(conceded),
        "avg_goals_scored_home": avg(scored_home),
        "avg_goals_scored_away": avg(scored_away),
        "avg_goals_conceded_home": avg(conceded_home),
        "avg_goals_conceded_away": avg(conceded_away),
    }
    supabase.table("team_form").upsert(row, on_conflict="team_id").execute()


# ------------------------------------------------------------------
# MAIN
# ------------------------------------------------------------------
def main() -> None:
    log.info("=== Démarrage du job AMS Pronos ===")
    matches = fetch_upcoming_matches()

    processed_teams: set[str] = set()

    for m in matches:
        try:
            comp_uuid = upsert_competition(m["_competition"])
            home_uuid = upsert_team(m["homeTeam"])
            away_uuid = upsert_team(m["awayTeam"])
            upsert_match(m, comp_uuid, home_uuid, away_uuid)

            # H2H
            h2h_matches = fetch_h2h(str(m["id"]))
            store_h2h(home_uuid, away_uuid, h2h_matches, str(m["homeTeam"]["id"]))

            processed_teams.add(home_uuid)
            processed_teams.add(away_uuid)

        except Exception as exc:
            log.error(f"Erreur sur le match {m.get('id')}: {exc}")
            continue

    # --- Mise à jour des résultats récents (nécessaire pour l'historique
    # de performance : un match "scheduled" doit passer à "finished" avec
    # son score une fois joué) ---
    try:
        recent_results = fetch_recent_results()
        for m in recent_results:
            try:
                comp_uuid = upsert_competition(m["_competition"])
                home_uuid = upsert_team(m["homeTeam"])
                away_uuid = upsert_team(m["awayTeam"])
                upsert_match(m, comp_uuid, home_uuid, away_uuid)
            except Exception as exc:
                log.error(f"Erreur mise à jour résultat {m.get('id')}: {exc}")
                continue
    except Exception as exc:
        log.error(f"Erreur récupération des résultats récents : {exc}")

    log.info(f"Recalcul de la forme pour {len(processed_teams)} équipes")
    for team_uuid in processed_teams:
        try:
            recompute_team_form(team_uuid)
        except Exception as exc:
            log.error(f"Erreur calcul forme équipe {team_uuid}: {exc}")

    log.info("=== Job terminé avec succès ===")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log.exception(f"Échec critique du job : {e}")
        sys.exit(1)
