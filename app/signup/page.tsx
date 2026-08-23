"use client";

import { useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = getBrowserSupabaseClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
        <h1 className="font-display text-2xl font-600 text-ink-50">
          Vérifie ta boîte mail
        </h1>
        <p className="mt-3 text-sm text-ink-400">
          Un e-mail de confirmation a été envoyé à {email}. Clique sur le lien
          pour activer ton compte, puis connecte-toi.
        </p>
        <Link
          href="/login"
          className="mt-6 rounded-full bg-accent-go px-4 py-2.5 text-center font-medium text-pitch-950 transition-opacity hover:opacity-90"
        >
          Aller à la connexion
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
      <h1 className="font-display text-2xl font-600 text-ink-50">Créer un compte</h1>
      <p className="mt-1 text-sm text-ink-400">
        Gratuit — pour suivre tes matchs favoris.
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
          Mot de passe (6 caractères minimum)
          <input
            type="password"
            required
            minLength={6}
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
          {loading ? "Création..." : "Créer mon compte"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-400">
        Déjà un compte ?{" "}
        <Link href="/login" className="text-accent-go hover:underline">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
