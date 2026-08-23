/**
 * AMS PRONOS — Évaluation des pronostics passés
 * ================================================
 * Compare un pronostic (marché + issue suggérée) au résultat réel d'un
 * match terminé, pour déterminer s'il était correct.
 */

import type { MarketKey } from "./pronostic-algorithm";

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  homeGoalsHt: number | null;
  awayGoalsHt: number | null;
}

export interface EvaluationResult {
  actualOutcome: string;
  isCorrect: boolean;
}

/**
 * Retourne null si le résultat ne permet pas d'évaluer ce marché
 * (ex : marché mi-temps mais score mi-temps inconnu).
 */
export function evaluatePrediction(
  market: MarketKey,
  suggestedOutcome: string,
  result: MatchResult
): EvaluationResult | null {
  const { homeGoals, awayGoals, homeGoalsHt, awayGoalsHt } = result;

  switch (market) {
    case "BTTS": {
      const actual = homeGoals > 0 && awayGoals > 0;
      return { actualOutcome: actual ? "YES" : "NO", isCorrect: actual === (suggestedOutcome === "YES") };
    }
    case "OVER_2_5": {
      const actual = homeGoals + awayGoals > 2;
      return { actualOutcome: actual ? "YES" : "NO", isCorrect: actual === (suggestedOutcome === "YES") };
    }
    case "HOME_WIN": {
      const actual = homeGoals > awayGoals;
      return { actualOutcome: actual ? "HOME" : "NOT_HOME", isCorrect: actual === (suggestedOutcome === "HOME") };
    }
    case "AWAY_WIN": {
      const actual = awayGoals > homeGoals;
      return { actualOutcome: actual ? "AWAY" : "NOT_AWAY", isCorrect: actual === (suggestedOutcome === "AWAY") };
    }
    case "HT_HOME_WIN": {
      if (homeGoalsHt == null || awayGoalsHt == null) return null;
      const actual = homeGoalsHt > awayGoalsHt;
      return { actualOutcome: actual ? "HOME" : "NOT_HOME", isCorrect: actual === (suggestedOutcome === "HOME") };
    }
    case "HT_AWAY_WIN": {
      if (homeGoalsHt == null || awayGoalsHt == null) return null;
      const actual = awayGoalsHt > homeGoalsHt;
      return { actualOutcome: actual ? "AWAY" : "NOT_AWAY", isCorrect: actual === (suggestedOutcome === "AWAY") };
    }
    case "GOAL_EACH_HALF": {
      if (homeGoalsHt == null || awayGoalsHt == null) return null;
      const firstHalfGoals = homeGoalsHt + awayGoalsHt;
      const secondHalfGoals = homeGoals + awayGoals - firstHalfGoals;
      const actual = firstHalfGoals > 0 && secondHalfGoals > 0;
      return { actualOutcome: actual ? "YES" : "NO", isCorrect: actual === (suggestedOutcome === "YES") };
    }
    case "DRAW_IN_A_HALF": {
      if (homeGoalsHt == null || awayGoalsHt == null) return null;
      const htDraw = homeGoalsHt === awayGoalsHt;
      const shDraw = homeGoals - homeGoalsHt === awayGoals - awayGoalsHt;
      const actual = htDraw || shDraw;
      return { actualOutcome: actual ? "YES" : "NO", isCorrect: actual === (suggestedOutcome === "YES") };
    }
    default:
      return null;
  }
}
