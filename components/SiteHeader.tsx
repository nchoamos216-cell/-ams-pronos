"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";

export default function SiteHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();
  const supabase = getBrowserSupabaseClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoaded(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-pitch-700/60 bg-pitch-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-lg font-700 text-accent-go">AMS</span>
          <span className="font-display text-lg font-600 text-ink-50">Pronos</span>
        </Link>

        <nav className="flex items-center gap-5 text-sm">
          <Link href="/" className="text-ink-200 transition-colors hover:text-ink-50">
            Matchs
          </Link>
          <Link
            href="/statistiques"
            className="text-ink-200 transition-colors hover:text-ink-50"
          >
            Statistiques
          </Link>

          {loaded && user && (
            <Link
              href="/favoris"
              className="text-ink-200 transition-colors hover:text-ink-50"
            >
              Favoris
            </Link>
          )}

          {loaded && !user && (
            <Link
              href="/login"
              className="rounded-full bg-accent-go px-4 py-1.5 font-medium text-pitch-950 transition-opacity hover:opacity-90"
            >
              Connexion
            </Link>
          )}

          {loaded && user && (
            <button
              onClick={handleLogout}
              className="rounded-full border border-pitch-700 px-4 py-1.5 text-ink-200 transition-colors hover:border-accent-go hover:text-ink-50"
            >
              Déconnexion
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
