"use client";

import { useEffect, useState } from "react";
import type { MatchWithTeams, PredictionRow } from "@/types";
import { MARKET_LABELS } from "@/types";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";

interface MatchCardProps {
  match: MatchWithTeams;
  predictions: PredictionRow[];
}

function confidenceStyle(score: number): string {
  if (score >= 70) return "bg-accent-go/15 text-accent-go border border-accent-go/30";
  if (score >= 45) return "bg-accent-warn/15 text-accent-warn border border-accent-warn/30";
  return "bg-ink-600/15 text-ink-400 border border-ink-600/30";
}

export default function MatchCard({ match, predictions }: MatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const supabase = getBrowserSupabaseClient();

  const topPrediction = predictions[0];
  const matchDate = new Date(match.match_date);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const { data: favRow } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", currentUser.id)
          .eq("match_id", match.id)
          .maybeSingle();
        if (active) setIsFavorite(!!favRow);
      }
    });
    return () => {
      active = false;
    };
  }, [supabase, match.id]);

  async function toggleFavorite() {
    if (!user) return;
    setFavLoading(true);
    if (isFavorite) {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("match_id", match.id);
      setIsFavorite(false);
    } else {
      await supabase
        .from("favorites")
        .insert({ user_id: user.id, match_id: match.id });
      setIsFavorite(true);
    }
    setFavLoading(false);
  }

  return (
    <div className="group rounded-2xl border border-pitch-700/60 bg-pitch-900/60 backdrop-blur transition-colors hover:border-pitch-700">
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-400">
          {match.competition_name ?? "Compétition"}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-ink-400">
            {matchDate.toLocaleString("fr-FR", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {user && (
            <button
              onClick={toggleFavorite}
              disabled={favLoading}
              aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
              className="text-base leading-none transition-transform hover:scale-110 disabled:opacity-50"
            >
              {isFavorite ? "★" : "☆"}
            </button>
          )}
        </div>
      </div>

      {/* Équipes */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex flex-1 flex-col items-center gap-2">
          {match.home_team_logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.home_team_logo} alt="" className="h-10 w-10 object-contain" />
          )}
          <span className="text-center text-sm font-semibold text-ink-50">
            {match.home_team_name}
          </span>
        </div>

        <span className="px-3 font-mono text-xs font-bold text-ink-600">VS</span>

        <div className="flex flex-1 flex-col items-center gap-2">
          {match.away_team_logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.away_team_logo} alt="" className="h-10 w-10 object-contain" />
          )}
          <span className="text-center text-sm font-semibold text-ink-50">
            {match.away_team_name}
          </span>
        </div>
      </div>

      {/* Pronostic principal */}
      {topPrediction ? (
        <div className="mx-4 mb-3 rounded-xl bg-pitch-950/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink-50">
              {MARKET_LABELS[topPrediction.market]}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${confidenceStyle(
                topPrediction.confidence_score
              )}`}
            >
              {topPrediction.confidence_score.toFixed(0)}%
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-400">{topPrediction.reasoning}</p>
        </div>
      ) : (
        <div className="mx-4 mb-3 rounded-xl bg-pitch-950/60 p-3 text-xs text-ink-600">
          Aucune anomalie H2H détectée pour ce match.
        </div>
      )}

      {/* Détails (autres pronostics) */}
      {predictions.length > 1 && (
        <div className="border-t border-pitch-700/60 px-4 py-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-accent-cool hover:text-ink-50"
          >
            {expanded
              ? "Masquer les autres options"
              : `Voir ${predictions.length - 1} autre(s) option(s) →`}
          </button>

          {expanded && (
            <ul className="mt-2 space-y-2 pb-2">
              {predictions.slice(1).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg bg-pitch-950/60 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-ink-200">
                    {MARKET_LABELS[p.market]}
                  </span>
                  <span className="font-mono text-ink-400">
                    série {p.streak_length} · {p.confidence_score.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
