/**
 * Full URL for a Supabase Edge Function. Uses `import.meta.env.VITE_SUPABASE_URL`
 * (e.g. local CLI `http://127.0.0.1:54321` or production `https://…supabase.co`).
 * Vite inlines env at dev/build start — restart `npm run dev` after changing `.env`.
 *
 * If the URL stays on localhost but `.env` has hosted Supabase, check for a **shell
 * or OS user env** `VITE_SUPABASE_URL` — Vite does not override existing `process.env` keys.
 *
 * @param path Function name or `name?query` segment — no leading slash, no `/functions/v1` prefix.
 */
export function getSupabaseFunctionUrl(path: string): string {
  const base = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base) {
    console.error(
      "[polymarket-bet-watch] VITE_SUPABASE_URL is empty. Set it in .env and restart the dev server or rebuild.",
    );
  }
  const segment = path.replace(/^\/+/, "");
  return `${base}/functions/v1/${segment}`;
}
