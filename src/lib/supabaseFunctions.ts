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
  // #region agent log
  fetch('http://127.0.0.1:7858/ingest/c2b3a394-85aa-4e8d-a530-1fbc8eb60c4e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7152ff'},body:JSON.stringify({sessionId:'7152ff',runId:'initial',hypothesisId:'H1',location:'src/lib/supabaseFunctions.ts:12',message:'Computed Supabase base URL',data:{hasBase:Boolean(base),basePreview:base ? base.slice(0, 60) : ""},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!base) {
    console.error(
      "[polymarket-bet-watch] VITE_SUPABASE_URL is empty. Set it in .env and restart the dev server or rebuild.",
    );
  }
  const segment = path.replace(/^\/+/, "");
  return `${base}/functions/v1/${segment}`;
}
