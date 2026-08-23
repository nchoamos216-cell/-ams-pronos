import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { evaluatePrediction, type MatchResult } from "@/lib/evaluate-predictions";
import type { MarketKey } from "@/lib/pronostic-algorithm";

export const dynamic = "force-dynamic";

export async function GET() {
  return runEvaluation();
}

export async function POST() {
  return runEvaluation();
}

async function runEvaluation() {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Pronostics pas encore évalués (is_correct est null), avec le match associé
  const { data: pendingPredictions, error } = await supabaseAdmin
    .from("predictions")
    .select(
      "id, match_id, market, suggested_outcome, matches!inner(status, home_goals, away_goals, home_goals_ht, away_goals_ht)"
    )
    .is("is_correct", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let evaluatedCount = 0;

  for (const row of pendingPredictions ?? []) {
    const match = (
      row as unknown as {
        matches: {
          status: string;
          home_goals: number | null;
          away_goals: number | null;
          home_goals_ht: number | null;
          away_goals_ht: number | null;
        };
      }
    ).matches;
    if (!match || match.status !== "finished") continue;
    if (match.home_goals == null || match.away_goals == null) continue;

    const result: MatchResult = {
      homeGoals: match.home_goals,
      awayGoals: match.away_goals,
      homeGoalsHt: match.home_goals_ht,
      awayGoalsHt: match.away_goals_ht,
    };

    const evaluation = evaluatePrediction(
      row.market as MarketKey,
      row.suggested_outcome,
      result
    );
    if (!evaluation) continue; // pas assez de données pour ce marché (ex: pas de score MT)

    await supabaseAdmin
      .from("predictions")
      .update({
        actual_outcome: evaluation.actualOutcome,
        is_correct: evaluation.isCorrect,
        evaluated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    evaluatedCount++;
  }

  return NextResponse.json({ ok: true, predictions_evaluated: evaluatedCount });
}
