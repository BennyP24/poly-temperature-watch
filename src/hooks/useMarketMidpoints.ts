import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseFunctionUrl } from "@/lib/supabaseFunctions";
import { getSupabaseAuthHeaders } from "@/lib/supabaseAuth";

/**
 * Live CLOB midpoint prices keyed by token id. The midpoint ((best bid + best ask) / 2)
 * is the price Polymarket shows on a market, so using it for the bet-card odds keeps the
 * displayed price correlated with the platform instead of the slower Gamma `outcomePrices`
 * (which can lag the live book by several cents).
 *
 * Two transport paths, tried in order so this works regardless of which proxy version is
 * deployed:
 *  1. lightweight `{ midpointTokenIds }` -> CLOB /midpoints (returned as tokenId -> price)
 *  2. fallback `{ tokenIds }` -> CLOB /books, midpoint computed here from best bid/ask.
 * Path 2 uses the proxy's original books mode, so live prices work even before the
 * midpoint-mode proxy update is deployed.
 */

/** Proxy caps CLOB token batches; keep below it and chunk the rest. */
const MAX_TOKENS_PER_REQUEST = 80;
export const MIDPOINTS_REFETCH_MS = 5_000;

export type MidpointMap = Map<string, number>;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Parse the CLOB /midpoints response: { "<tokenId>": "0.55", ... } into a numeric map. */
export function parseMidpointResponse(data: unknown, into: MidpointMap): void {
  if (!data || typeof data !== "object" || Array.isArray(data)) return;
  for (const [token, value] of Object.entries(data as Record<string, unknown>)) {
    if (token === "error") continue;
    const n = parseFloat(String(value));
    if (Number.isFinite(n)) into.set(token, n);
  }
}

interface BookLevel {
  price?: string | number;
  size?: string | number;
}
interface RawBook {
  asset_id?: string;
  assetId?: string;
  token_id?: string;
  bids?: BookLevel[];
  asks?: BookLevel[];
}

/** tokenId for a CLOB book entry across the field-name variants the API uses. */
function bookKey(book: RawBook): string | null {
  const raw = book.asset_id ?? book.assetId ?? book.token_id;
  return raw != null && String(raw) !== "undefined" ? String(raw) : null;
}

/**
 * Midpoint from a single order book: (best bid + best ask) / 2. This is exactly the
 * value the CLOB /midpoints endpoint returns and what Polymarket displays. Falls back
 * to whichever side exists when the book is one-sided.
 */
export function midpointFromBook(book: RawBook | undefined): number | null {
  if (!book) return null;
  let bestBid: number | null = null;
  for (const b of book.bids ?? []) {
    const n = parseFloat(String(b.price));
    if (Number.isFinite(n) && (bestBid === null || n > bestBid)) bestBid = n;
  }
  let bestAsk: number | null = null;
  for (const a of book.asks ?? []) {
    const n = parseFloat(String(a.price));
    if (Number.isFinite(n) && (bestAsk === null || n < bestAsk)) bestAsk = n;
  }
  if (bestBid !== null && bestAsk !== null) return (bestBid + bestAsk) / 2;
  if (bestBid !== null) return bestBid;
  if (bestAsk !== null) return bestAsk;
  return null;
}

/** Compute midpoints from a CLOB /books array response into the map. Returns count added. */
function parseBooksIntoMidpoints(data: unknown, batch: string[], into: MidpointMap): number {
  if (!Array.isArray(data)) return 0;
  let added = 0;
  for (let i = 0; i < data.length; i++) {
    const book = data[i] as RawBook;
    const key = bookKey(book) ?? batch[i];
    const mid = midpointFromBook(book);
    if (key && mid !== null) {
      into.set(String(key), mid);
      added++;
    }
  }
  return added;
}

async function fetchMidpoints(tokenIds: string[]): Promise<MidpointMap> {
  const result: MidpointMap = new Map();
  const unique = [...new Set(tokenIds)].filter(Boolean);
  if (unique.length === 0) return result;
  const proxyUrl = getSupabaseFunctionUrl("polymarket-proxy");

  for (const batch of chunk(unique, MAX_TOKENS_PER_REQUEST)) {
    // 1) Lightweight midpoint mode (used once the updated proxy is deployed).
    let gotFromMidpoints = false;
    try {
      const response = await fetch(proxyUrl, {
        method: "POST",
        headers: getSupabaseAuthHeaders(),
        body: JSON.stringify({ midpointTokenIds: batch }),
      });
      if (response.ok) {
        const before = result.size;
        parseMidpointResponse(await response.json(), result);
        gotFromMidpoints = result.size > before;
      }
    } catch {
      /* fall through to books */
    }
    if (gotFromMidpoints) continue;

    // 2) Fallback: order books (original proxy mode) -> compute midpoint locally.
    try {
      const response = await fetch(proxyUrl, {
        method: "POST",
        headers: getSupabaseAuthHeaders(),
        body: JSON.stringify({ tokenIds: batch }),
      });
      if (!response.ok) continue;
      parseBooksIntoMidpoints(await response.json(), batch, result);
    } catch {
      /* swallow — caller falls back to Gamma outcomePrices */
    }
  }
  return result;
}

/**
 * Poll midpoints for the given outcome token ids. Returns a map of tokenId -> price (0..1).
 */
export function useMarketMidpoints(tokenIds: string[]) {
  const queryClient = useQueryClient();
  const sorted = [...new Set(tokenIds)].filter(Boolean).sort();
  const cacheKey = sorted.join(",");

  const query = useQuery<MidpointMap>({
    queryKey: ["market-midpoints", cacheKey],
    queryFn: () => fetchMidpoints(sorted),
    enabled: sorted.length > 0,
    staleTime: 0,
    refetchInterval: false,
    refetchOnWindowFocus: true,
    structuralSharing: false,
    networkMode: "always",
    retry: 1,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (sorted.length === 0) return;
    const id = window.setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["market-midpoints", cacheKey] });
    }, MIDPOINTS_REFETCH_MS);
    return () => window.clearInterval(id);
  }, [queryClient, cacheKey, sorted.length]);

  return query;
}
