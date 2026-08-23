import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { generatePredictions, type H2HMatch, type TeamForm } from "@/lib/pronostic-algorithm";

// Empêche Next.js d'essayer de générer cette route statiquement au build :
// elle doit s'exécuter uniquement à la demande (runtime), pas pendant "npm run build".
export const dynamic = "force-dynamic";

export async function GET() {
  // Vercel Cron envoie des requêtes GET par défaut
  return runGeneration();
}

export async function POST() {
  return runGeneration();
}

async function runGeneration() {
  // Le client Supabase est créé ici, à l'intérieur de la fonction, et non au
  // niveau du module : cela évite que Next.js l'exécute pendant la phase de
  // build (où les variables d'environnement runtime ne sont pas garanties).
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: matches, error } = await supabaseAdmin
    .from("matches")
    .select("id, home_team_id, away_team_id")
    .eq("status", "scheduled");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let generatedCount = 0;

  for (const match of matches ?? []) {
    // 1. Historique H2H (le plus récent en premier)
    const { data: h2hRows } = await supabaseAdmin
      .from("h2h_history")
      .select("*")
      .eq("team_a_id", match.home_team_id)
      .eq("team_b_id", match.away_team_id)
      .order("match_date", { ascending: false })
      .limit(10);

    if (!h2hRows || h2hRows.length < 2) continue;

    const h2hMatches: H2HMatch[] = h2hRows.map((r) => ({
      matchDate: r.match_date,
      teamAWasHome: r.team_a_was_home,
      teamAGoals: r.team_a_goals,
      teamBGoals: r.team_b_goals,
      teamAGoalsHt: r.team_a_goals_ht ?? null,
      teamBGoalsHt: r.team_b_goals_ht ?? null,
      btts: r.btts,
      totalGoals: r.total_goals,
      over25: r.over_2_5,
      homeWin: r.home_win,
    }));

    // 2. Forme récente des deux équipes
    const { data: homeFormRow } = await supabaseAdmin
      .from("team_form")
      .select("*")
      .eq("team_id", match.home_team_id)
      .maybeSingle();

    const { data: awayFormRow } = await supabaseAdmin
      .from("team_form")
      .select("*")
      .eq("team_id", match.away_team_id)
      .maybeSingle();

    const homeForm: TeamForm = {
      avgGoalsScoredHome: homeFormRow?.avg_goals_scored_home ?? null,
      avgGoalsScoredAway: homeFormRow?.avg_goals_scored_away ?? null,
      avgGoalsConcededHome: homeFormRow?.avg_goals_conceded_home ?? null,
      avgGoalsConcededAway: homeFormRow?.avg_goals_conceded_away ?? null,
    };
    const awayForm: TeamForm = {
      avgGoalsScoredHome: awayFormRow?.avg_goals_scored_home ?? null,
      avgGoalsScoredAway: awayFormRow?.avg_goals_scored_away ?? null,
      avgGoalsConcededHome: awayFormRow?.avg_goals_conceded_home ?? null,
      avgGoalsConcededAway: awayFormRow?.avg_goals_conceded_away ?? null,
    };

    // 3. Génération
    const predictions = generatePredictions({ h2hMatches, homeForm, awayForm });

    // 4. Upsert des pronostics
    for (const p of predictions) {
      await supabaseAdmin.from("predictions").upsert(
        {
          match_id: match.id,
          market: p.market,
          suggested_outcome: p.suggestedOutcome,
          streak_length: p.streakLength,
          poisson_probability: p.poissonProbability,
          confidence_score: p.confidenceScore,
          reasoning: p.reasoning,
        },
        { onConflict: "match_id,market" }
      );
      generatedCount++;
    }
  }

  return NextResponse.json({ ok: true, predictions_generated: generatedCount });
}
