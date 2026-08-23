"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Client "navigateur" — utilisé dans les composants client (auth, favoris).
// Contrairement à lib/supabase.ts (server-only), celui-ci garde la session
// utilisateur en mémoire/localStorage entre les pages, comme un client Supabase
// classique dans une SPA.
let browserClient: SupabaseClient | null = null;

export function getBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return browserClient;
}
