import { getSupabaseClient } from "@/lib/supabase";
import { MARKET_LABELS, type MarketKey, type PredictionRow } from "@/types";

export const dynamic = "force-dynamic";

interface EvaluatedRow extends PredictionRow {
  actual_outcome: string | null;
  is_correct: boolean | null;
  evaluated_at: string | null;
}

export default async function StatistiquesPage() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("predictions")
    .select("*")
    .not("is_correct", "is", null)
    .order("evaluated_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-accent-bad">Erreur de chargement : {error.message}</p>
      </main>
    );
  }

  const evaluated = (data ?? []) as EvaluatedRow[];

  // --- Agrégation par marché ---
  const byMarket = new Map<MarketKey, { total: number; correct: number }>();
  for (const p of evaluated) {
    const entry = byMarket.get(p.market) ?? { total: 0, correct: 0 };
    entry.total += 1;
    if (p.is_correct) entry.correct += 1;
    byMarket.set(p.market, entry);
  }

  const overallTotal = evaluated.length;
  const overallCorrect = evaluated.filter((p) => p.is_correct).length;
  const overallRate = overallTotal > 0 ? (overallCorrect / overallTotal) * 100 : 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-accent-go">
          Bilan
        </p>
        <h1 className="mt-1 font-display text-3xl font-700 text-ink-50">
          Statistiques de performance
        </h1>
        <p className="mt-2 text-sm text-ink-400">
          Taux de réussite réel des pronostics une fois les matchs terminés.
        </p>
      </header>

      {overallTotal === 0 ? (
        <p className="rounded-xl border border-pitch-700/60 bg-pitch-900/60 p-6 text-sm text-ink-400">
          Aucun pronostic évalué pour l&apos;instant — reviens une fois que des
          matchs pronostiqués seront terminés.
        </p>
      ) : (
        <>
          {/* Bilan global */}
          <div className="mb-8 flex items-baseline gap-4 rounded-2xl border border-pitch-700/60 bg-pitch-900/60 p-6">
            <span className="font-mono text-4xl font-bold text-accent-go">
              {overallRate.toFixed(1)}%
            </span>
            <span className="text-sm text-ink-400">
              de réussite globale sur {overallTotal} pronostics évalués (
              {overallCorrect} corrects)
            </span>
          </div>

          {/* Détail par marché */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from(byMarket.entries())
              .sort((a, b) => b[1].total - a[1].total)
              .map(([market, stat]) => {
                const rate = (stat.correct / stat.total) * 100;
                return (
                  <div
                    key={market}
                    className="rounded-xl border border-pitch-700/60 bg-pitch-900/60 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink-50">
                        {MARKET_LABELS[market]}
                      </span>
                      <span className="font-mono text-sm font-bold text-accent-go">
                        {rate.toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-pitch-950">
                      <div
                        className="h-full bg-accent-go"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <p className="mt-2 font-mono text-xs text-ink-400">
                      {stat.correct} / {stat.total} corrects
                    </p>
                  </div>
                );
              })}
          </div>

          {/* Historique récent */}
          <h2 className="mb-4 mt-10 font-display text-xl font-600 text-ink-50">
            Derniers pronostics évalués
          </h2>
          <div className="overflow-hidden rounded-xl border border-pitch-700/60">
            <table className="w-full text-left text-sm">
              <thead className="bg-pitch-900 text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-2">Marché</th>
                  <th className="px-4 py-2">Suggéré</th>
                  <th className="px-4 py-2">Réel</th>
                  <th className="px-4 py-2">Résultat</th>
                </tr>
              </thead>
              <tbody>
                {evaluated.slice(0, 30).map((p) => (
                  <tr key={p.id} className="border-t border-pitch-700/60">
                    <td className="px-4 py-2 text-ink-200">
                      {MARKET_LABELS[p.market]}
                    </td>
                    <td className="px-4 py-2 font-mono text-ink-400">
                      {p.suggested_outcome}
                    </td>
                    <td className="px-4 py-2 font-mono text-ink-400">
                      {p.actual_outcome}
                    </td>
                    <td className="px-4 py-2">
                      {p.is_correct ? (
                        <span className="rounded-full bg-accent-go/15 px-2 py-0.5 text-xs font-medium text-accent-go">
                          Correct
                        </span>
                      ) : (
                        <span className="rounded-full bg-accent-bad/15 px-2 py-0.5 text-xs font-medium text-accent-bad">
                          Incorrect
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
