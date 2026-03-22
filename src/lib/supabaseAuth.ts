/**
 * Anon / publishable key for Supabase REST and Edge Functions (`VITE_SUPABASE_ANON_KEY`).
 */
export function getSupabaseAnonKey(): string {
  return String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
}

/** Headers Supabase expects on REST and Edge Function requests. */
export function getSupabaseAuthHeaders(): Record<string, string> {
  const key = getSupabaseAnonKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}
