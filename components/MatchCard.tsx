"use client";

import { useState } from "react";
import type { MatchWithTeams, PredictionRow } from "@/types";
import { MARKET_LABELS } from "@/types";

interface MatchCardProps {
  match: MatchWithTeams;
  predictions: PredictionRow[];
}

function confidenceColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-slate-400";
}

export default function MatchCard({ match, predictions }: MatchCardProps) {
  const [expanded, setExpanded] = useState(false);

  const topPrediction = predictions[0];
  const matchDate = new Date(match.match_date);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="text-xs font-medium text-slate-500">
          {match.competition_name ?? "Compétition"}
        </span>
        <span className="text-xs text-slate-400">
          {matchDate.toLocaleString("fr-FR", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Équipes */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex flex-1 flex-col items-center gap-2">
          {match.home_team_logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.home_team_logo} alt="" className="h-10 w-10 object-contain" />
          )}
          <span className="text-sm font-semibold text-slate-800 text-center">
            {match.home_team_name}
          </span>
        </div>

        <span className="px-3 text-sm font-bold text-slate-400">VS</span>

        <div className="flex flex-1 flex-col items-center gap-2">
          {match.away_team_logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.away_team_logo} alt="" className="h-10 w-10 object-contain" />
          )}
          <span className="text-sm font-semibold text-slate-800 text-center">
            {match.away_team_name}
          </span>
        </div>
      </div>

      {/* Pronostic principal */}
      {topPrediction ? (
        <div className="mx-4 mb-3 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              {MARKET_LABELS[topPrediction.market]}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${confidenceColor(
                topPrediction.confidence_score
              )}`}
            >
              {topPrediction.confidence_score.toFixed(0)}% confiance
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{topPrediction.reasoning}</p>
        </div>
      ) : (
        <div className="mx-4 mb-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-400">
          Aucune anomalie H2H détectée pour ce match.
        </div>
      )}

      {/* Détails (autres pronostics) */}
      {predictions.length > 1 && (
        <div className="border-t border-slate-100 px-4 py-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
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
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-slate-700">
                    {MARKET_LABELS[p.market]}
                  </span>
                  <span className="text-slate-500">
                    série de {p.streak_length} · {p.confidence_score.toFixed(0)}%
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
