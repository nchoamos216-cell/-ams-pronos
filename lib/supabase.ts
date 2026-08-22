import { createClient } from "@supabase/supabase-js";

// Clé "anon" — lecture publique uniquement (RLS actif côté Supabase, voir schema.sql)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
