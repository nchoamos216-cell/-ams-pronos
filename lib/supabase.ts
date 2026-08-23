import { createClient } from "@supabase/supabase-js";

// Clé "anon" — lecture publique uniquement (RLS actif côté Supabase, voir schema.sql)
// Créé via une fonction (et non une constante au niveau du module) pour éviter
// que Next.js n'exécute createClient() pendant la phase de build.
//
// IMPORTANT : on force explicitement { cache: "no-store" } sur chaque requête,
// car Next.js met en cache les appels fetch() par défaut (y compris ceux faits
// par supabase-js en interne) — sans ça, les données affichées peuvent rester
// figées sur une ancienne réponse (ex. une table vide interrogée avant d'être remplie).
export function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (url, options = {}) =>
          fetch(url, { ...options, cache: "no-store" }),
      },
    }
  );
}
