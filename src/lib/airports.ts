/**
 * Frontend re-export of the shared airport database used by the Supabase
 * edge function. The canonical source lives in
 * `supabase/functions/_shared/airports.ts` so Deno bundles can reference it
 * directly (edge functions can't import from `src/`).
 *
 * Import sites in `src/` should use `@/lib/airports` for ergonomics.
 */
export type { Airport, AirportSize } from "../../supabase/functions/_shared/airports";
export {
  airports,
  findAirportByIcao,
  normalizeLocationKey,
  resolveAirportForLocation,
} from "../../supabase/functions/_shared/airports";
