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

export interface PredictionRow {
  id: string;
  match_id: string;
  market: "BTTS" | "OVER_2_5" | "HOME_WIN" | "RED_CARD";
  suggested_outcome: string;
  streak_length: number;
  poisson_probability: number | null;
  confidence_score: number;
  reasoning: string;
}

export const MARKET_LABELS: Record<PredictionRow["market"], string> = {
  BTTS: "Les deux équipes marquent",
  OVER_2_5: "Plus de 2.5 buts",
  HOME_WIN: "Victoire à domicile",
  RED_CARD: "Carton rouge",
};

export const MARKET_CATEGORY: Record<
  PredictionRow["market"],
  "Buts" | "Résultats" | "Cartons"
> = {
  BTTS: "Buts",
  OVER_2_5: "Buts",
  HOME_WIN: "Résultats",
  RED_CARD: "Cartons",
};
