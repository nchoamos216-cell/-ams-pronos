export interface Team {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
}

export interface MatchWithTeams {
  id: string;
  match_date: string;
  status: string;
  competition_name: string | null;
  home_team_id: string;
  home_team_name: string;
  home_team_logo: string | null;
  away_team_id: string;
  away_team_name: string;
  away_team_logo: string | null;
}

export type MarketKey =
  | "BTTS"
  | "OVER_2_5"
  | "HOME_WIN"
  | "AWAY_WIN"
  | "HT_HOME_WIN"
  | "HT_AWAY_WIN"
  | "GOAL_EACH_HALF"
  | "DRAW_IN_A_HALF";

export interface PredictionRow {
  id: string;
  match_id: string;
  market: MarketKey;
  suggested_outcome: string;
  streak_length: number;
  poisson_probability: number | null;
  confidence_score: number;
  reasoning: string;
}

export const MARKET_LABELS: Record<MarketKey, string> = {
  BTTS: "Les deux équipes marquent",
  OVER_2_5: "Plus de 2.5 buts",
  HOME_WIN: "Victoire à domicile",
  AWAY_WIN: "Victoire à l'extérieur",
  HT_HOME_WIN: "Victoire à la mi-temps (domicile)",
  HT_AWAY_WIN: "Victoire à la mi-temps (extérieur)",
  GOAL_EACH_HALF: "But dans chaque mi-temps",
  DRAW_IN_A_HALF: "Nul dans au moins une mi-temps",
};

export const MARKET_CATEGORY: Record<MarketKey, "Buts" | "Résultats"> = {
  BTTS: "Buts",
  OVER_2_5: "Buts",
  HOME_WIN: "Résultats",
  AWAY_WIN: "Résultats",
  HT_HOME_WIN: "Résultats",
  HT_AWAY_WIN: "Résultats",
  GOAL_EACH_HALF: "Buts",
  DRAW_IN_A_HALF: "Résultats",
};
