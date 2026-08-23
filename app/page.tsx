import { getSupabaseClient } from "@/lib/supabase";
import MatchCard from "@/components/MatchCard";
import type { MatchWithTeams, PredictionRow } from "@/types";
import DashboardFilters from "@/components/DashboardFilters";

// Empêche Next.js de tenter un rendu statique de cette page au build
// (elle dépend de Supabase et des searchParams, donc doit être dynamique).
export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: { competition?: string; date?: string; type?: string };
}

export default async function Home({ searchParams }: HomeProps) {
  const supabase = getSupabaseClient();

  // --- 1. Récupération des matchs à venir (vue v_upcoming_matches) ---
  let query = supabase.from("v_upcoming_matches").select("*");

  if (searchParams.competition) {
    query = query.eq("competition_name", searchParams.competition);
  }
  if (searchParams.date) {
    const start = `${searchParams.date}T00:00:00Z`;
    const end = `${searchParams.date}T23:59:59Z`;
    query = query.gte("match_date", start).lte("match_date", end);
  }

  const { data: matches, error } = await query.order("match_date", {
    ascending: true,
  });

  if (error) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p className="text-accent-bad">Erreur de chargement : {error.message}</p>
      </main>
    );
  }

  const matchList = (matches ?? []) as MatchWithTeams[];
  const matchIds = matchList.map((m) => m.id);

  // --- 2. Récupération des pronostics associés ---
  let predictionsByMatch = new Map<string, PredictionRow[]>();
  if (matchIds.length > 0) {
    const { data: predictions } = await supabase
      .from("predictions")
      .select("*")
      .in("match_id", matchIds)
      .order("confidence_score", { ascending: false });

    let filtered = (predictions ?? []) as PredictionRow[];
    if (searchParams.type) {
      filtered = filtered.filter((p) => p.market === searchParams.type);
    }

    predictionsByMatch = filtered.reduce((map, p) => {
      const list = map.get(p.match_id) ?? [];
      list.push(p);
      map.set(p.match_id, list);
      return map;
    }, new Map<string, PredictionRow[]>());
  }

  // Si un filtre "type" est actif, on ne garde que les matchs concernés
  const visibleMatches = searchParams.type
    ? matchList.filter((m) => predictionsByMatch.has(m.id))
    : matchList;

  // --- 3. Liste des compétitions pour le filtre ---
  const competitions = Array.from(
    new Set(matchList.map((m) => m.competition_name).filter(Boolean))
  ) as string[];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-accent-go">
          Tableau de bord
        </p>
        <h1 className="mt-1 font-display text-3xl font-700 text-ink-50">
          Matchs à venir
        </h1>
        <p className="mt-2 text-sm text-ink-400">
          Pronostics statistiques basés sur l&apos;historique H2H et la détection
          d&apos;anomalies.
        </p>
      </header>

      <DashboardFilters competitions={competitions} searchParams={searchParams} />

      {visibleMatches.length === 0 ? (
        <p className="mt-10 text-center text-sm text-ink-600">
          Aucun match ne correspond aux filtres sélectionnés.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              predictions={predictionsByMatch.get(match.id) ?? []}
            />
          ))}
        </div>
      )}
    </main>
  );
}
