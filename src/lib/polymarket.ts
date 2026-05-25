import { supabase } from "@/integrations/supabase/client";
import { getSupabaseFunctionUrl } from "@/lib/supabaseFunctions";
import { getSupabaseAuthHeaders } from "@/lib/supabaseAuth";

const CITY_TIMEZONES: Record<string, string> = {
  "munich": "Europe/Berlin",
  "london": "Europe/London",
  "paris": "Europe/Paris",
  "tokyo": "Asia/Tokyo",
  "sydney": "Australia/Sydney",
  "new york": "America/New_York",
  "nyc": "America/New_York",
  "los angeles": "America/Los_Angeles",
  "chicago": "America/Chicago",
  "miami": "America/New_York",
  "dallas": "America/Chicago",
  "houston": "America/Chicago",
  "phoenix": "America/Phoenix",
  "denver": "America/Denver",
  "seattle": "America/Los_Angeles",
  "san francisco": "America/Los_Angeles",
  "boston": "America/New_York",
  "atlanta": "America/New_York",
  "washington": "America/New_York",
  "toronto": "America/Toronto",
  "las vegas": "America/Los_Angeles",
  "austin": "America/Chicago",
  "detroit": "America/Detroit",
  "portland": "America/Los_Angeles",
  "salt lake city": "America/Denver",
  "anchorage": "America/Anchorage",
  "honolulu": "Pacific/Honolulu",
  "berlin": "Europe/Berlin",
  "rome": "Europe/Rome",
  "madrid": "Europe/Madrid",
  "amsterdam": "Europe/Amsterdam",
  "zurich": "Europe/Zurich",
  "dubai": "Asia/Dubai",
  "singapore": "Asia/Singapore",
  "hong kong": "Asia/Hong_Kong",
  "seoul": "Asia/Seoul",
  "beijing": "Asia/Shanghai",
  "shanghai": "Asia/Shanghai",
  "moscow": "Europe/Moscow",
  "istanbul": "Europe/Istanbul",
  "cairo": "Africa/Cairo",
  "johannesburg": "Africa/Johannesburg",
  "são paulo": "America/Sao_Paulo",
  "sao paulo": "America/Sao_Paulo",
  "mexico city": "America/Mexico_City",
  "buenos aires": "America/Argentina/Buenos_Aires",
  "lima": "America/Lima",
  "bogota": "America/Bogota",
  "santiago": "America/Santiago",
  "delhi": "Asia/Kolkata",
  "mumbai": "Asia/Kolkata",
  "bangkok": "Asia/Bangkok",
  "jakarta": "Asia/Jakarta",
  "kuala lumpur": "Asia/Kuala_Lumpur",
  "manila": "Asia/Manila",
  "auckland": "Pacific/Auckland",
  "melbourne": "Australia/Melbourne",
  "brisbane": "Australia/Brisbane",
  "perth": "Australia/Perth",
  "vancouver": "America/Vancouver",
  "calgary": "America/Edmonton",
  "montreal": "America/Toronto",
  "ottawa": "America/Toronto",
  "phnom penh": "Asia/Phnom_Penh",
  "ho chi minh": "Asia/Ho_Chi_Minh",
  ankara: "Europe/Istanbul",
  lucknow: "Asia/Kolkata",
  "tel aviv": "Asia/Jerusalem",
  "ben gurion": "Asia/Jerusalem",
  jerusalem: "Asia/Jerusalem",
  haifa: "Asia/Jerusalem",
  wellington: "Pacific/Auckland",
};

const CITY_ALIASES: Record<string, string> = {
  nyc: "new york",
  "new york city": "new york",
  "washington dc": "washington",
  "washington d c": "washington",
  "washington d.c": "washington",
  "washington d.c.": "washington",
  "sao paulo": "sao paulo",
  "são paulo": "sao paulo",
};

function normalizeLocationKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Priority cities that should appear first (Asian cities ahead in time)
const PRIORITY_CITIES = ["seoul", "phnom penh", "bangkok", "ho chi minh", "tokyo", "beijing", "shanghai", "hong kong", "singapore", "manila", "jakarta", "kuala lumpur"];

function extractLocation(title: string): string {
  const match = title.match(/(?:temperature|temp)\s+in\s+([\p{L}\s.'-]+?)(?:\s+(?:be|on|exceed|above|below|reach|hit))/iu);
  if (match?.[1]) return match[1].trim();

  const match2 = title.match(/in\s+([\p{L}\s.'-]+?)(?:\s+on\s)/iu);
  if (match2?.[1]) return match2[1].trim();

  return "Unknown";
}

function getTimezone(location: string): string {
  const normalized = normalizeLocationKey(location);
  const canonical = CITY_ALIASES[normalized] ?? normalized;

  for (const [city, tz] of Object.entries(CITY_TIMEZONES)) {
    if (canonical.includes(city)) return tz;
  }

  // Best-effort partial fallback (e.g. "city center")
  const partialMatch = Object.entries(CITY_TIMEZONES).find(([city]) =>
    city.includes(canonical) || canonical.includes(city)
  );

  return partialMatch?.[1] ?? "UTC";
}

function extractLinks(description: string): string[] {
  const urlRegex = /https?:\/\/[^\s)<>"\\]+/g;
  return description.match(urlRegex) || [];
}

function isPriorityCity(location: string): number {
  const lower = location.toLowerCase().trim();
  for (let i = 0; i < PRIORITY_CITIES.length; i++) {
    if (lower.includes(PRIORITY_CITIES[i])) return i;
  }
  return PRIORITY_CITIES.length + 1;
}

function isTemperatureBet(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes("temperature") || lower.includes("°f") || lower.includes("°c") || lower.includes("highest") || lower.includes("temp ");
}

/** Substrings merged from Index + TempAccount; used for Asian tabs and fetch rules. */
const ASIAN_LOCATION_KEYWORDS = [
  "seoul", "phnom penh", "bangkok", "ho chi minh", "tokyo", "beijing", "shanghai",
  "hong kong", "singapore", "manila", "jakarta", "kuala lumpur", "delhi", "mumbai", "dubai",
  "tel aviv", "ben gurion", "jerusalem", "haifa", "lucknow", "ankara", "istanbul", "cairo",
  "taipei", "hanoi", "colombo", "karachi", "dhaka", "riyadh", "doha", "muscat", "tehran",
];

/** True if `location` matches an Asian city/region used for UI tabs and market visibility. */
export function isAsianLocation(location: string): boolean {
  const lower = location.toLowerCase().trim();
  return ASIAN_LOCATION_KEYWORDS.some((c) => lower.includes(c));
}

const MONTH_MAP: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

function extractBetDateFromTitle(title: string): string | null {
  const match = title.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?\b/i
  );
  if (!match) return null;
  const month = MONTH_MAP[match[1].toLowerCase()];
  if (!month) return null;
  const day = match[2].padStart(2, "0");
  const year = match[3] || new Date().getFullYear().toString();
  return `${year}-${month}-${day}`;
}

export interface TemperatureEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  timezone: string;
  endDate: string;
  createdAt: string;
  betDate: string;
  image: string;
  slug: string;
  resolutionSource: string;
  referenceLinks: string[];
  volume: number;
  liquidity: number;
  polymarketUrl: string;
  isNew: boolean;
  markets: TemperatureMarket[];
  priorityRank: number;
}

/** Gamma JSON often has numeric `id`; paper trades use string `market_id`. Use for Map keys / lookups. */
export function normalizeMarketId(id: string | number): string {
  return String(id);
}

export interface TemperatureMarket {
  id: string;
  question: string;
  groupItemTitle: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  active: boolean;
  closed: boolean;
  isFulfilled: boolean;
}

export async function fetchTemperatureEvents(): Promise<TemperatureEvent[]> {
  const headers = getSupabaseAuthHeaders();
  
  // Make two API calls: one for soonest events, one for latest created (future events)
  const ascUrl = `${getSupabaseFunctionUrl("polymarket-proxy")}?endpoint=events&params=${encodeURIComponent("closed=false&limit=300&order=endDate&ascending=true&tag_slug=weather")}`;
  const descUrl = `${getSupabaseFunctionUrl("polymarket-proxy")}?endpoint=events&params=${encodeURIComponent("closed=false&limit=300&order=createdAt&ascending=false&tag_slug=weather")}`;
  
  let ascResponse: Response, descResponse: Response;
  try {
    [ascResponse, descResponse] = await Promise.all([
      fetch(ascUrl, { headers }),
      fetch(descUrl, { headers }),
    ]);
  } catch (error) {
    throw error;
  }

  if (!ascResponse.ok || !descResponse.ok) {
    throw new Error(`Proxy error: ${ascResponse.status} / ${descResponse.status}`);
  }
  
  const [ascEvents, descEvents] = await Promise.all([
    ascResponse.json(),
    descResponse.json(),
  ]);
  
  // Merge and dedupe by event id
  const seenIds = new Set<string>();
  const events: any[] = [];
  for (const e of [...ascEvents, ...descEvents]) {
    if (!seenIds.has(e.id)) {
      seenIds.add(e.id);
      events.push(e);
    }
  }

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const mapped = events
    .filter((e: any) => {
      const title = e.title || "";
      if (!isTemperatureBet(title)) return false;
      // Don't filter by e.closed - let events through if they have open markets
      return true;
    })
    .map((event: any) => {
      const title = event.title || "";
      const description = event.description || "";
      const location = extractLocation(title) || extractLocation(description);
      const timezone = getTimezone(location);
      const referenceLinks = extractLinks(description);
      const resolutionSource = event.markets?.[0]?.resolutionSource || referenceLinks[0] || "";

      const asian = isAsianLocation(location);

      // Include all markets, even closed ones - filter only truly closed (resolved) ones
      const markets: TemperatureMarket[] = (event.markets || [])
        .map((m: any) => {
          let yesPrice = 0;
          let noPrice = 0;
          try {
            const prices = JSON.parse(m.outcomePrices || "[0,0]");
            yesPrice = parseFloat(prices[0]) || 0;
            noPrice = parseFloat(prices[1]) || 0;
          } catch { /* noop */ }

          const isFulfilled = yesPrice >= 0.99 || noPrice >= 0.99;

          return {
            id: m.id,
            question: m.question || "",
            groupItemTitle: m.groupItemTitle || m.question || "",
            yesPrice,
            noPrice,
            volume: m.volumeNum || parseFloat(m.volume) || 0,
            active: m.active,
            closed: m.closed,
            isFulfilled,
          };
        })
        .filter((m: TemperatureMarket) => !m.closed);

      const hasUnfulfilled = asian
        ? markets.length > 0
        : markets.some((m) => !m.isFulfilled);

      const betDate = extractBetDateFromTitle(title)
        || (event.endDate || event.createdAt || "").split("T")[0];

      return {
        id: event.id,
        title,
        description,
        location,
        timezone,
        endDate: event.endDate,
        createdAt: event.createdAt,
        betDate,
        image: event.image || event.icon || "",
        slug: event.slug || "",
        resolutionSource,
        referenceLinks,
        volume: event.volume || 0,
        liquidity: event.liquidity || event.liquidityClob || 0,
        polymarketUrl: `https://polymarket.com/event/${event.slug}`,
        isNew: new Date(event.createdAt) > oneDayAgo,
        markets,
        priorityRank: isPriorityCity(location),
        _hasUnfulfilled: hasUnfulfilled,
      };
    });

  // Filter out events where ANY market is at 99%+ (essentially resolved)
  return mapped
    .filter((e: any) => {
      if (e.markets.length === 0) return false;
      // Remove event if ANY market has yesPrice >= 0.99 (essentially decided)
      const hasResolvedMarket = e.markets.some((m: TemperatureMarket) => m.yesPrice >= 0.99);
      return !hasResolvedMarket;
    })
    .map(({ _hasUnfulfilled, ...e }: any) => e);
}
