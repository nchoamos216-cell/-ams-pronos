/**
 * AMS PRONOS — Moteur de détection d'anomalies & modèle de Poisson
 * =================================================================
 * Ce module est pur TypeScript (aucune dépendance externe) afin de pouvoir
 * être exécuté aussi bien côté serveur (route handler / server action Next.js)
 * que dans un test unitaire.
 *
 * LIMITE DE DONNÉES IMPORTANTE :
 * Les marchés liés aux corners, fautes, touches ou buteurs remplaçants ne
 * sont PAS implémentés ici car la source de données gratuite utilisée
 * (football-data.org, tier free) ne fournit que le score final et le score
 * à la mi-temps — aucune statistique détaillée de ce type. Tous les marchés
 * ci-dessous sont donc calculés uniquement à partir de ces deux scores.
 */

// -------------------------------------------------------------
// Types
// -------------------------------------------------------------
export interface H2HMatch {
  matchDate: string;
  teamAWasHome: boolean;
  teamAGoals: number;
  teamBGoals: number;
  teamAGoalsHt: number | null;
  teamBGoalsHt: number | null;
  btts: boolean;
  totalGoals: number;
  over25: boolean;
  homeWin: boolean | null;
}

export interface TeamForm {
  avgGoalsScoredHome: number | null;
  avgGoalsScoredAway: number | null;
  avgGoalsConcededHome: number | null;
  avgGoalsConcededAway: number | null;
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

export type SuggestedOutcome = "YES" | "NO" | "HOME" | "AWAY" | "DRAW";

export interface Prediction {
  market: MarketKey;
  suggestedOutcome: SuggestedOutcome;
  streakLength: number;
  poissonProbability: number | null;
  confidenceScore: number; // 0-100
  reasoning: string;
}

// -------------------------------------------------------------
// 1. Détection des "options non réalisées" (streaks)
// -------------------------------------------------------------
/**
 * Pour un marché binaire donné, calcule le nombre de matchs H2H consécutifs
 * (les plus récents en premier) où l'événement NE s'est PAS produit.
 * `h2hMatches` doit être trié du plus récent au plus ancien.
 */
function computeAbsenceStreak(
  h2hMatches: H2HMatch[],
  occurred: (m: H2HMatch) => boolean
): number {
  let streak = 0;
  for (const m of h2hMatches) {
    if (!occurred(m)) {
      streak += 1;
    } else {
      break; // la série s'arrête dès que l'événement s'est produit
    }
  }
  return streak;
}

// -------------------------------------------------------------
// Prédicats dérivés du score mi-temps / fin de match
// -------------------------------------------------------------
function secondHalfGoals(m: H2HMatch): { a: number; b: number } | null {
  if (m.teamAGoalsHt == null || m.teamBGoalsHt == null) return null;
  return {
    a: m.teamAGoals - m.teamAGoalsHt,
    b: m.teamBGoals - m.teamBGoalsHt,
  };
}

const MARKET_PREDICATES: Record<
  Exclude<MarketKey, "HOME_WIN" | "AWAY_WIN">,
  (m: H2HMatch) => boolean
> = {
  BTTS: (m) => m.btts,
  OVER_2_5: (m) => m.over25,
  HT_HOME_WIN: (m) =>
    m.teamAGoalsHt != null &&
    m.teamBGoalsHt != null &&
    (m.teamAWasHome ? m.teamAGoalsHt > m.teamBGoalsHt : m.teamBGoalsHt > m.teamAGoalsHt),
  HT_AWAY_WIN: (m) =>
    m.teamAGoalsHt != null &&
    m.teamBGoalsHt != null &&
    (m.teamAWasHome ? m.teamBGoalsHt > m.teamAGoalsHt : m.teamAGoalsHt > m.teamBGoalsHt),
  GOAL_EACH_HALF: (m) => {
    const sh = secondHalfGoals(m);
    if (!sh || m.teamAGoalsHt == null || m.teamBGoalsHt == null) return false;
    const firstHalfGoals = m.teamAGoalsHt + m.teamBGoalsHt;
    const secondHalfTotal = sh.a + sh.b;
    return firstHalfGoals > 0 && secondHalfTotal > 0;
  },
  DRAW_IN_A_HALF: (m) => {
    const sh = secondHalfGoals(m);
    if (!sh || m.teamAGoalsHt == null || m.teamBGoalsHt == null) return false;
    const htDraw = m.teamAGoalsHt === m.teamBGoalsHt;
    const shDraw = sh.a === sh.b;
    return htDraw || shDraw;
  },
};

// -------------------------------------------------------------
// 2. Modèle de Poisson (probabilité complémentaire basée sur la forme)
// -------------------------------------------------------------
function factorial(n: number): number {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

/**
 * Estime lambda (buts attendus) pour l'équipe domicile et extérieure
 * à partir des moyennes de forme récente (méthode simplifiée, sans
 * force de ligue moyenne — suffisante pour un score indicatif).
 */
function estimateExpectedGoals(homeForm: TeamForm, awayForm: TeamForm) {
  const homeAttack = homeForm.avgGoalsScoredHome ?? 1.3;
  const awayDefense = awayForm.avgGoalsConcededAway ?? 1.3;
  const awayAttack = awayForm.avgGoalsScoredAway ?? 1.1;
  const homeDefense = homeForm.avgGoalsConcededHome ?? 1.1;

  const lambdaHome = (homeAttack + awayDefense) / 2;
  const lambdaAway = (awayAttack + homeDefense) / 2;
  return { lambdaHome, lambdaAway };
}

/**
 * Calcule, via une grille de Poisson bivariée indépendante (0 à maxGoals),
 * les probabilités des principaux marchés plein-match.
 */
export function poissonMarketProbabilities(
  homeForm: TeamForm,
  awayForm: TeamForm,
  maxGoals = 8
) {
  const { lambdaHome, lambdaAway } = estimateExpectedGoals(homeForm, awayForm);

  let pBtts = 0;
  let pOver25 = 0;
  let pHomeWin = 0;
  let pDraw = 0;
  let pAwayWin = 0;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
      if (h > 0 && a > 0) pBtts += p;
      if (h + a > 2) pOver25 += p;
      if (h > a) pHomeWin += p;
      else if (h === a) pDraw += p;
      else pAwayWin += p;
    }
  }

  return { pBtts, pOver25, pHomeWin, pDraw, pAwayWin, lambdaHome, lambdaAway };
}

// -------------------------------------------------------------
// 3. Score de confiance combiné (streak H2H + Poisson)
// -------------------------------------------------------------
/**
 * Combine la longueur de la série H2H (poids historique) et la probabilité
 * Poisson (poids "forme actuelle") en un score de confiance 0-100.
 *
 * Pondération : 60% série H2H (plafonnée à 5 matchs = confiance historique max),
 *               40% probabilité Poisson de l'événement (ou fréquence historique
 *               simple pour les marchés sans équivalent Poisson direct).
 */
function computeConfidence(streakLength: number, secondaryProb: number): number {
  const streakScore = Math.min(streakLength / 5, 1) * 100; // plafonné à 5
  const secondaryScore = secondaryProb * 100;
  const confidence = streakScore * 0.6 + secondaryScore * 0.4;
  return Math.round(confidence * 100) / 100;
}

function historicalRate(h2hMatches: H2HMatch[], predicate: (m: H2HMatch) => boolean): number {
  const withHt = h2hMatches.filter((m) => m.teamAGoalsHt != null && m.teamBGoalsHt != null);
  if (withHt.length === 0) return 0;
  return withHt.filter(predicate).length / withHt.length;
}

// -------------------------------------------------------------
// 4. Génération complète des pronostics pour un match
// -------------------------------------------------------------
export interface GeneratePredictionsInput {
  h2hMatches: H2HMatch[]; // triés du plus récent au plus ancien
  homeForm: TeamForm;
  awayForm: TeamForm;
  minStreakToSuggest?: number; // défaut: 2 (règle métier de l'énoncé)
}

export function generatePredictions({
  h2hMatches,
  homeForm,
  awayForm,
  minStreakToSuggest = 2,
}: GeneratePredictionsInput): Prediction[] {
  const predictions: Prediction[] = [];
  const poisson = poissonMarketProbabilities(homeForm, awayForm);

  // --- BTTS ---
  {
    const streak = computeAbsenceStreak(h2hMatches, MARKET_PREDICATES.BTTS);
    if (streak >= minStreakToSuggest) {
      predictions.push({
        market: "BTTS",
        suggestedOutcome: "YES",
        streakLength: streak,
        poissonProbability: poisson.pBtts,
        confidenceScore: computeConfidence(streak, poisson.pBtts),
        reasoning: `BTTS non réalisé lors des ${streak} derniers H2H — probabilité Poisson de BTTS estimée à ${(poisson.pBtts * 100).toFixed(1)}%.`,
      });
    }
  }

  // --- Over 2.5 buts ---
  {
    const streak = computeAbsenceStreak(h2hMatches, MARKET_PREDICATES.OVER_2_5);
    if (streak >= minStreakToSuggest) {
      predictions.push({
        market: "OVER_2_5",
        suggestedOutcome: "YES",
        streakLength: streak,
        poissonProbability: poisson.pOver25,
        confidenceScore: computeConfidence(streak, poisson.pOver25),
        reasoning: `Moins de 2.5 buts lors des ${streak} derniers H2H — probabilité Poisson d'Over 2.5 estimée à ${(poisson.pOver25 * 100).toFixed(1)}%.`,
      });
    }
  }

  // --- Victoire à domicile ---
  {
    const streak = computeAbsenceStreak(
      h2hMatches,
      (m) => m.teamAWasHome && m.homeWin === true
    );
    if (streak >= minStreakToSuggest) {
      predictions.push({
        market: "HOME_WIN",
        suggestedOutcome: "HOME",
        streakLength: streak,
        poissonProbability: poisson.pHomeWin,
        confidenceScore: computeConfidence(streak, poisson.pHomeWin),
        reasoning: `L'équipe à domicile n'a pas gagné lors des ${streak} dernières réceptions face à cet adversaire — probabilité Poisson de victoire domicile estimée à ${(poisson.pHomeWin * 100).toFixed(1)}%.`,
      });
    }
  }

  // --- Victoire à l'extérieur ---
  {
    const streak = computeAbsenceStreak(
      h2hMatches,
      (m) => !m.teamAWasHome && m.homeWin === false
      // l'équipe qui reçoit AUJOURD'HUI est "team_a" ; on regarde donc les H2H où
      // team_a jouait à l'extérieur et n'a pas perdu (proxy de "l'extérieur ne gagne pas")
    );
    if (streak >= minStreakToSuggest) {
      predictions.push({
        market: "AWAY_WIN",
        suggestedOutcome: "AWAY",
        streakLength: streak,
        poissonProbability: poisson.pAwayWin,
        confidenceScore: computeConfidence(streak, poisson.pAwayWin),
        reasoning: `L'équipe à l'extérieur n'a pas gagné lors des ${streak} derniers H2H dans cette configuration — probabilité Poisson de victoire extérieure estimée à ${(poisson.pAwayWin * 100).toFixed(1)}%.`,
      });
    }
  }

  // --- Victoire à la mi-temps (domicile) ---
  {
    const streak = computeAbsenceStreak(h2hMatches, MARKET_PREDICATES.HT_HOME_WIN);
    const rate = historicalRate(h2hMatches, MARKET_PREDICATES.HT_HOME_WIN);
    if (streak >= minStreakToSuggest) {
      predictions.push({
        market: "HT_HOME_WIN",
        suggestedOutcome: "HOME",
        streakLength: streak,
        poissonProbability: null,
        confidenceScore: computeConfidence(streak, rate),
        reasoning: `L'équipe à domicile n'était pas menée à la mi-temps lors des ${streak} derniers H2H (fréquence historique : ${(rate * 100).toFixed(0)}%).`,
      });
    }
  }

  // --- Victoire à la mi-temps (extérieur) ---
  {
    const streak = computeAbsenceStreak(h2hMatches, MARKET_PREDICATES.HT_AWAY_WIN);
    const rate = historicalRate(h2hMatches, MARKET_PREDICATES.HT_AWAY_WIN);
    if (streak >= minStreakToSuggest) {
      predictions.push({
        market: "HT_AWAY_WIN",
        suggestedOutcome: "AWAY",
        streakLength: streak,
        poissonProbability: null,
        confidenceScore: computeConfidence(streak, rate),
        reasoning: `L'équipe à l'extérieur n'a pas mené à la mi-temps lors des ${streak} derniers H2H (fréquence historique : ${(rate * 100).toFixed(0)}%).`,
      });
    }
  }

  // --- But dans chaque mi-temps ---
  {
    const streak = computeAbsenceStreak(h2hMatches, MARKET_PREDICATES.GOAL_EACH_HALF);
    const rate = historicalRate(h2hMatches, MARKET_PREDICATES.GOAL_EACH_HALF);
    if (streak >= minStreakToSuggest) {
      predictions.push({
        market: "GOAL_EACH_HALF",
        suggestedOutcome: "YES",
        streakLength: streak,
        poissonProbability: null,
        confidenceScore: computeConfidence(streak, rate),
        reasoning: `Pas de but dans chaque mi-temps lors des ${streak} derniers H2H (fréquence historique : ${(rate * 100).toFixed(0)}%).`,
      });
    }
  }

  // --- Nul dans au moins une mi-temps ---
  {
    const streak = computeAbsenceStreak(h2hMatches, MARKET_PREDICATES.DRAW_IN_A_HALF);
    const rate = historicalRate(h2hMatches, MARKET_PREDICATES.DRAW_IN_A_HALF);
    if (streak >= minStreakToSuggest) {
      predictions.push({
        market: "DRAW_IN_A_HALF",
        suggestedOutcome: "YES",
        streakLength: streak,
        poissonProbability: null,
        confidenceScore: computeConfidence(streak, rate),
        reasoning: `Aucune mi-temps nulle lors des ${streak} derniers H2H (fréquence historique : ${(rate * 100).toFixed(0)}%).`,
      });
    }
  }

  // Tri par score de confiance décroissant
  return predictions.sort((a, b) => b.confidenceScore - a.confidenceScore);
}
