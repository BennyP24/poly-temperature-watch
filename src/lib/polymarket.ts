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

// City → Weather Underground URL path for the resolution source
const CITY_WU_URLS: Record<string, string> = {
  "miami": "https://www.wunderground.com/weather/us/fl/miami/KMIA",
  "new york": "https://www.wunderground.com/weather/us/ny/new-york-city/KLGA",
  "nyc": "https://www.wunderground.com/weather/us/ny/new-york-city/KLGA",
  "chicago": "https://www.wunderground.com/weather/us/il/chicago/KORD",
  "los angeles": "https://www.wunderground.com/weather/us/ca/los-angeles/KLAX",
  "houston": "https://www.wunderground.com/weather/us/tx/houston/KIAH",
  "dallas": "https://www.wunderground.com/weather/us/tx/dallas/KDFW",
  "phoenix": "https://www.wunderground.com/weather/us/az/phoenix/KPHX",
  "denver": "https://www.wunderground.com/weather/us/co/denver/KDEN",
  "seattle": "https://www.wunderground.com/weather/us/wa/seattle/KSEA",
  "san francisco": "https://www.wunderground.com/weather/us/ca/san-francisco/KSFO",
  "boston": "https://www.wunderground.com/weather/us/ma/boston/KBOS",
  "atlanta": "https://www.wunderground.com/weather/us/ga/atlanta/KATL",
  "washington": "https://www.wunderground.com/weather/us/dc/washington/KDCA",
  "las vegas": "https://www.wunderground.com/weather/us/nv/las-vegas/KLAS",
  "austin": "https://www.wunderground.com/weather/us/tx/austin/KAUS",
  "detroit": "https://www.wunderground.com/weather/us/mi/detroit/KDTW",
  "portland": "https://www.wunderground.com/weather/us/or/portland/KPDX",
  "salt lake city": "https://www.wunderground.com/weather/us/ut/salt-lake-city/KSLC",
  "anchorage": "https://www.wunderground.com/weather/us/ak/anchorage/PANC",
  "honolulu": "https://www.wunderground.com/weather/us/hi/honolulu/PHNL",
  "toronto": "https://www.wunderground.com/weather/ca/toronto/CYYZ",
  "vancouver": "https://www.wunderground.com/weather/ca/vancouver/CYVR",
  "calgary": "https://www.wunderground.com/weather/ca/calgary/CYYC",
  "montreal": "https://www.wunderground.com/weather/ca/montreal/CYUL",
  "ottawa": "https://www.wunderground.com/weather/ca/ottawa/CYOW",
  "london": "https://www.wunderground.com/weather/gb/london/EGLL",
  "paris": "https://www.wunderground.com/weather/fr/paris/LFPG",
  "berlin": "https://www.wunderground.com/weather/de/berlin/EDDB",
  "munich": "https://www.wunderground.com/weather/de/munich/EDDM",
  "rome": "https://www.wunderground.com/weather/it/rome/LIRF",
  "madrid": "https://www.wunderground.com/weather/es/madrid/LEMD",
  "amsterdam": "https://www.wunderground.com/weather/nl/amsterdam/EHAM",
  "zurich": "https://www.wunderground.com/weather/ch/zurich/LSZH",
  "moscow": "https://www.wunderground.com/weather/ru/moscow/UUEE",
  "istanbul": "https://www.wunderground.com/weather/tr/istanbul/LTFM",
  "ankara": "https://www.wunderground.com/weather/tr/ankara/LTAC",
  "cairo": "https://www.wunderground.com/weather/eg/cairo/HECA",
  "johannesburg": "https://www.wunderground.com/weather/za/johannesburg/FAOR",
  "dubai": "https://www.wunderground.com/weather/ae/dubai/OMDB",
  "seoul": "https://www.wunderground.com/weather/kr/seoul/RKSS",
  "tokyo": "https://www.wunderground.com/weather/jp/tokyo/RJTT",
  "beijing": "https://www.wunderground.com/weather/cn/beijing/ZBAA",
  "shanghai": "https://www.wunderground.com/weather/cn/shanghai/ZSPD",
  "hong kong": "https://www.wunderground.com/weather/hk/hong-kong/VHHH",
  "singapore": "https://www.wunderground.com/weather/sg/singapore/WSSS",
  "bangkok": "https://www.wunderground.com/weather/th/bangkok/VTBS",
  "manila": "https://www.wunderground.com/weather/ph/manila/RPLL",
  "jakarta": "https://www.wunderground.com/weather/id/jakarta/WIII",
  "kuala lumpur": "https://www.wunderground.com/weather/my/kuala-lumpur/WMKK",
  "phnom penh": "https://www.wunderground.com/weather/kh/phnom-penh/VDPP",
  "ho chi minh": "https://www.wunderground.com/weather/vn/ho-chi-minh-city/VVTS",
  "delhi": "https://www.wunderground.com/weather/in/delhi/VIDP",
  "mumbai": "https://www.wunderground.com/weather/in/mumbai/VABB",
  "lucknow": "https://www.wunderground.com/weather/in/lucknow/VILK",
  "tel aviv": "https://www.wunderground.com/weather/il/tel-aviv/LLBG",
  "ben gurion": "https://www.wunderground.com/weather/il/tel-aviv/LLBG",
  "jerusalem": "https://www.wunderground.com/weather/il/jerusalem",
  "haifa": "https://www.wunderground.com/weather/il/haifa",
  "sydney": "https://www.wunderground.com/weather/au/sydney/YSSY",
  "melbourne": "https://www.wunderground.com/weather/au/melbourne/YMML",
  "brisbane": "https://www.wunderground.com/weather/au/brisbane/YBBN",
  "perth": "https://www.wunderground.com/weather/au/perth/YPPH",
  "auckland": "https://www.wunderground.com/weather/nz/auckland/NZAA",
  "wellington": "https://www.wunderground.com/weather/nz/wellington/NZWN",
  "sao paulo": "https://www.wunderground.com/weather/br/sao-paulo/SBGR",
  "mexico city": "https://www.wunderground.com/weather/mx/mexico-city/MMMX",
  "buenos aires": "https://www.wunderground.com/weather/ar/buenos-aires/SAEZ",
  "lima": "https://www.wunderground.com/weather/pe/lima/SPJC",
  "bogota": "https://www.wunderground.com/weather/co/bogota/SKBO",
  "santiago": "https://www.wunderground.com/weather/cl/santiago/SCEL",
};

function getWuUrl(location: string): string | null {
  const normalized = normalizeLocationKey(location);
  const canonical = CITY_ALIASES[normalized] ?? normalized;

  const direct = CITY_WU_URLS[canonical];
  if (direct) return direct;

  for (const [city, url] of Object.entries(CITY_WU_URLS)) {
    if (canonical.includes(city) || city.includes(canonical)) return url;
  }

  return null;
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
  const response = await fetch(
    `${getSupabaseFunctionUrl("polymarket-proxy")}?endpoint=events&params=${encodeURIComponent("active=true&closed=false&limit=200&order=createdAt&ascending=false&tag_slug=weather")}`,
    { headers: getSupabaseAuthHeaders() }
  );

  if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
  const events = await response.json();

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return events
    .filter((e: any) => {
      if (e.closed) return false;
      const title = e.title || "";
      return isTemperatureBet(title);
    })
    .map((event: any) => {
      const title = event.title || "";
      const description = event.description || "";
      const location = extractLocation(title) || extractLocation(description);
      const timezone = getTimezone(location);
      const referenceLinks = extractLinks(description);
      const polymarketResSource = event.markets?.[0]?.resolutionSource || referenceLinks[0] || "";
      const wuUrl = getWuUrl(location);
      const resolutionSource = wuUrl || polymarketResSource;

      const asian = isAsianLocation(location);

      const markets: TemperatureMarket[] = (event.markets || [])
        .filter((m: any) => !m.closed)
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
        });

      const hasUnfulfilled = asian
        ? markets.length > 0
        : markets.some((m) => !m.isFulfilled);

      const betDate = extractBetDateFromTitle(title)
        || (event.endDate || event.createdAt || "").split("T")[0];

      // All open outcomes (match Polymarket event page); resolved/near-1¢ bins stay visible.
      const marketsForEvent = markets;

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
        markets: marketsForEvent,
        priorityRank: isPriorityCity(location),
        _hasUnfulfilled: hasUnfulfilled,
      };
    })
    .filter((e: any) => e._hasUnfulfilled && e.markets.length > 0)
    .map(({ _hasUnfulfilled, ...e }: any) => e);
}
