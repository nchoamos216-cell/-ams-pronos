"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";
import MatchCard from "@/components/MatchCard";
import type { MatchWithTeams, PredictionRow } from "@/types";
import type { User } from "@supabase/supabase-js";

export default function FavorisPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [predictionsByMatch, setPredictionsByMatch] = useState<
    Map<string, PredictionRow[]>
  >(new Map());
  const supabase = getBrowserSupabaseClient();

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user ?? null;
      if (!active) return;
      setUser(currentUser);

      if (!currentUser) {
        setLoaded(true);
        return;
      }

      const { data: favRows } = await supabase
        .from("favorites")
        .select("match_id")
        .eq("user_id", currentUser.id);

      const matchIds = (favRows ?? []).map((f) => f.match_id);

      if (matchIds.length === 0) {
        if (active) {
          setMatches([]);
          setLoaded(true);
        }
        return;
      }

      const { data: matchRows } = await supabase
        .from("v_upcoming_matches")
        .select("*")
        .in("id", matchIds)
        .order("match_date", { ascending: true });

      const { data: predictionRows } = await supabase
        .from("predictions")
        .select("*")
        .in("match_id", matchIds)
        .order("confidence_score", { ascending: false });

      const grouped = (predictionRows ?? []).reduce((map, p) => {
        const list = map.get(p.match_id) ?? [];
        list.push(p);
        map.set(p.match_id, list);
        return map;
      }, new Map<string, PredictionRow[]>());

      if (active) {
        setMatches((matchRows ?? []) as MatchWithTeams[]);
        setPredictionsByMatch(grouped);
        setLoaded(true);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  if (loaded && !user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-600 text-ink-50">Favoris</h1>
        <p className="mt-3 text-sm text-ink-400">
          Connecte-toi pour sauvegarder et retrouver tes matchs favoris.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-full bg-accent-go px-5 py-2.5 font-medium text-pitch-950 hover:opacity-90"
        >
          Se connecter
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-accent-go">
          Ta sélection
        </p>
        <h1 className="mt-1 font-display text-3xl font-700 text-ink-50">
          Matchs favoris
        </h1>
      </header>

      {!loaded ? (
        <p className="text-sm text-ink-600">Chargement...</p>
      ) : matches.length === 0 ? (
        <p className="text-sm text-ink-600">
          Aucun favori pour l&apos;instant — clique sur l&apos;étoile ☆ d&apos;un
          match pour l&apos;ajouter ici.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
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
