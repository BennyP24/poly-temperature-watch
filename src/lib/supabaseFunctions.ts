/**
 * Full URL for a Supabase Edge Function. Uses `import.meta.env.VITE_SUPABASE_URL`
 * (e.g. local CLI `http://127.0.0.1:54321` or production `https://…supabase.co`).
 *
 * @param path Function name or `name?query` segment — no leading slash, no `/functions/v1` prefix.
 */
export function getSupabaseFunctionUrl(path: string): string {
  const base = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  const segment = path.replace(/^\/+/, "");
  return `${base}/functions/v1/${segment}`;
}
