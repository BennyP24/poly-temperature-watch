import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { normalizeMarketId } from "@/lib/polymarket";
import { getSupabaseFunctionUrl } from "@/lib/supabaseFunctions";
import { getSupabaseAuthHeaders } from "@/lib/supabaseAuth";

/** Per-outcome prices for marking paper trades. Both values are best bid (highest bid) — what you receive when selling that side. Never ask / lowest ask. */
export interface MarketPrice {
  yesPrice: number;
  noPrice: number;
}

function parseClobTokenIds(m: Record<string, unknown>): string[] | null {
  const raw = m.clobTokenIds ?? m.clob_token_ids;
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch {
      /* noop */
    }
  }
  return null;
}

/** Map outcome index → token id. When labels are literally Yes/No, use those indices; else [0]=yes [1]=no (paper trading). */
function yesNoTokenIdsFromMarket(m: Record<string, unknown>): { yesTok: string; noTok: string } | null {
  const tokens = parseClobTokenIds(m);
  if (!tokens || tokens.length < 2) return null;
  let labels: string[] = [];
  try {
    const raw = m.outcomes;
    if (typeof raw === "string") labels = JSON.parse(raw) as string[];
    else if (Array.isArray(raw)) labels = raw.map((x) => String(x));
  } catch {
    return { yesTok: tokens[0], noTok: tokens[1] };
  }
  if (labels.length >= 2) {
    const yesI = labels.findIndex((l) => /^\s*yes\s*$/i.test(String(l)));
    const noI = labels.findIndex((l) => /^\s*no\s*$/i.test(String(l)));
    if (yesI >= 0 && noI >= 0 && yesI < tokens.length && noI < tokens.length) {
      return { yesTok: tokens[yesI], noTok: tokens[noI] };
    }
  }
  return { yesTok: tokens[0], noTok: tokens[1] };
}

/** Highest bid in the CLOB snapshot (sell price). Ignores asks entirely. */
function highestBidFromBook(book: { bids?: { price?: string }[]; asks?: unknown } | undefined): number | null {
  if (!book?.bids?.length) return null;
  let best = -1;
  for (const b of book.bids) {
    const n = parseFloat(b.price);
    if (Number.isFinite(n) && n > best) best = n;
  }
  return best >= 0 ? best : null;
}

/** Gamma bestBid = top of YES bid book (sell YES). We do not use bestAsk for Sell @. */
function readGammaBestBid(m: Record<string, unknown>): number | null {
  const rawBid = m.bestBid ?? (m as { best_bid?: unknown }).best_bid;
  const bid = rawBid != null && rawBid !== "" ? parseFloat(String(rawBid)) : NaN;
  return Number.isFinite(bid) ? bid : null;
}

/** CLOB snapshot for one outcome token (from polymarket-proxy books). */
export interface OrderBookSummary {
  asset_id?: string;
  /** Bid side only — used for sell / mark. */
  bids?: { price: string; size: string }[];
  asks?: { price: string; size: string }[];
}

/** YES and NO token books for a market (normalized market id key). */
export interface MarketSideBooks {
  yesBook: OrderBookSummary | null;
  noBook: OrderBookSummary | null;
}

export interface MarketPricesPayload {
  prices: Map<string, MarketPrice>;
  orderBooksByMarketId: Map<string, MarketSideBooks>;
}

async function fetchClobBooks(tokenIds: string[]): Promise<Map<string, OrderBookSummary>> {
  if (tokenIds.length === 0) return new Map();
  const response = await fetch(getSupabaseFunctionUrl("polymarket-proxy"), {
    method: "POST",
    headers: getSupabaseAuthHeaders(),
    body: JSON.stringify({ tokenIds }),
  });
  if (!response.ok) throw new Error(`CLOB books error: ${response.status}`);
  const data: unknown = await response.json();
  const list = Array.isArray(data) ? data : [];
  const map = new Map<string, OrderBookSummary>();
  const requested = [...new Set(tokenIds)];
  for (let i = 0; i < list.length; i++) {
    const b = list[i] as OrderBookSummary & { assetId?: string; token_id?: string };
    const key =
      b.asset_id != null && String(b.asset_id) !== "undefined"
        ? String(b.asset_id)
        : b.assetId != null
          ? String(b.assetId)
          : b.token_id != null
            ? String(b.token_id)
            : null;
    if (key) map.set(key, b);
    else if (i < requested.length) map.set(requested[i], b);
  }
  return map;
}

async function fetchMarketPrices(marketIds: string[]): Promise<MarketPricesPayload> {
  /** Gamma rejects comma-separated `id` (422). Use repeated `id=` params and dedupe. */
  const uniqueIds = [...new Set(marketIds.map((id) => normalizeMarketId(id)))].filter(Boolean);
  if (uniqueIds.length === 0) {
    return { prices: new Map(), orderBooksByMarketId: new Map() };
  }

  const params = new URLSearchParams();
  for (const id of uniqueIds) {
    params.append("id", id);
  }
  params.set("limit", String(uniqueIds.length));

  const response = await fetch(
    `${getSupabaseFunctionUrl("polymarket-proxy")}?endpoint=markets&params=${encodeURIComponent(params.toString())}`,
    { headers: getSupabaseAuthHeaders() }
  );

  if (!response.ok) throw new Error(`Market prices error: ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    const err =
      data && typeof data === "object" && "error" in data
        ? JSON.stringify((data as { error: unknown }).error)
        : JSON.stringify(data);
    throw new Error(`Market prices: expected array, got ${err}`);
  }

  const result = new Map<string, MarketPrice>();
  const orderBooksByMarketId = new Map<string, MarketSideBooks>();
  const markets = data;

  const tokenIds: string[] = [];
  const marketTokens: {
    marketId: string;
    yesTok: string;
    noTok: string;
    fallbackYes: number;
    fallbackNo: number;
    gammaBestBid: number | null;
  }[] = [];

  for (const m of markets) {
    if (!m?.id) continue;
    let fallbackYes = 0;
    let fallbackNo = 0;
    try {
      const prices = JSON.parse(m.outcomePrices || "[0,0]");
      fallbackYes = parseFloat(prices[0]) || 0;
      fallbackNo = parseFloat(prices[1]) || 0;
    } catch {
      /* noop */
    }

    const gammaBestBid = readGammaBestBid(m as Record<string, unknown>);

    const pair = yesNoTokenIdsFromMarket(m as Record<string, unknown>);
    const mid = normalizeMarketId(m.id as string | number);
    if (pair) {
      const { yesTok, noTok } = pair;
      marketTokens.push({
        marketId: mid,
        yesTok,
        noTok,
        fallbackYes,
        fallbackNo,
        gammaBestBid,
      });
      tokenIds.push(yesTok, noTok);
    } else {
      result.set(mid, {
        yesPrice: gammaBestBid ?? fallbackYes,
        noPrice: fallbackNo,
      });
      orderBooksByMarketId.set(mid, { yesBook: null, noBook: null });
    }
  }

  let booksByToken = new Map<string, OrderBookSummary>();
  if (tokenIds.length > 0) {
    try {
      booksByToken = await fetchClobBooks([...new Set(tokenIds)]);
    } catch {
      booksByToken = new Map();
    }
  }

  // Sell YES: Gamma bestBid is YES-side; CLOB yesTok is YES token. Use best of both when both exist, then mid fallback.
  for (const row of marketTokens) {
    const yesBook = booksByToken.get(row.yesTok);
    const noBook = booksByToken.get(row.noTok);
    orderBooksByMarketId.set(row.marketId, {
      yesBook: yesBook ?? null,
      noBook: noBook ?? null,
    });
    const yesBid = highestBidFromBook(yesBook);
    const noBid = highestBidFromBook(noBook);
    const fromBooks = [yesBid, row.gammaBestBid].filter((x): x is number => x != null && Number.isFinite(x));
    const finalYes = fromBooks.length > 0 ? Math.max(...fromBooks) : row.fallbackYes;
    const finalNo = noBid ?? row.fallbackNo;
    result.set(row.marketId, {
      yesPrice: finalYes,
      noPrice: finalNo,
    });
  }

  return { prices: result, orderBooksByMarketId };
}

/** Poll open-position sell/bid prices at most every 2s (Sell @, P&L marks). */
export const MARKET_PRICES_REFETCH_MS = 2_000;

export function useMarketPrices(marketIds: string[]) {
  const queryClient = useQueryClient();
  const sortedIds = [...new Set(marketIds.map((id) => normalizeMarketId(id)))].filter(Boolean).sort();
  const cacheKey = sortedIds.join(",");

  const query = useQuery<MarketPricesPayload>({
    queryKey: ["market-prices", cacheKey],
    queryFn: () => fetchMarketPrices(sortedIds),
    enabled: sortedIds.length > 0,
    staleTime: 0,
    /** Rely on explicit invalidate interval below — refetchInterval can stall when paused/offline in some setups. */
    refetchInterval: false,
    refetchOnWindowFocus: true,
    structuralSharing: false,
    networkMode: "always",
    retry: 1,
  });

  useEffect(() => {
    if (sortedIds.length === 0) return;
    const tick = () => {
      queryClient.invalidateQueries({ queryKey: ["market-prices", cacheKey] });
    };
    const id = window.setInterval(tick, MARKET_PRICES_REFETCH_MS);
    return () => window.clearInterval(id);
  }, [queryClient, cacheKey]);

  return query;
}
