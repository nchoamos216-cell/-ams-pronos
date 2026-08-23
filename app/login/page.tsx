"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = getBrowserSupabaseClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "E-mail ou mot de passe incorrect."
          : error.message
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
      <h1 className="font-display text-2xl font-600 text-ink-50">Connexion</h1>
      <p className="mt-1 text-sm text-ink-400">
        Accède à tes matchs favoris et à tes préférences.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm text-ink-200">
          E-mail
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-ink-50 outline-none focus:border-accent-go"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-ink-200">
          Mot de passe
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-ink-50 outline-none focus:border-accent-go"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-accent-bad/10 px-3 py-2 text-sm text-accent-bad">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-full bg-accent-go px-4 py-2.5 font-medium text-pitch-950 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-400">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="text-accent-go hover:underline">
          Créer un compte
        </Link>
      </p>
    </main>
  );
}
