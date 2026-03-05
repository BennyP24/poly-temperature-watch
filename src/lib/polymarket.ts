import { supabase } from "@/integrations/supabase/client";

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
};

function extractLocation(title: string): string {
  // Match patterns like "temperature in Munich" or "temperature in New York"
  const match = title.match(/(?:temperature|temp)\s+in\s+([A-Za-z\s]+?)(?:\s+(?:be|on|exceed|above|below|reach|hit))/i);
  if (match?.[1]) return match[1].trim();

  // Try from event title like "Highest Temperature in Munich on March 6"
  const match2 = title.match(/in\s+([A-Za-z\s]+?)(?:\s+on\s)/i);
  if (match2?.[1]) return match2[1].trim();

  return "Unknown";
}

function getTimezone(location: string): string {
  const lower = location.toLowerCase().trim();
  for (const [city, tz] of Object.entries(CITY_TIMEZONES)) {
    if (lower.includes(city)) return tz;
  }
  return "UTC";
}

function extractLinks(description: string): string[] {
  const urlRegex = /https?:\/\/[^\s)<>"\\]+/g;
  return description.match(urlRegex) || [];
}

export interface TemperatureEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  timezone: string;
  endDate: string;
  createdAt: string;
  image: string;
  slug: string;
  resolutionSource: string;
  referenceLinks: string[];
  volume: number;
  liquidity: number;
  polymarketUrl: string;
  isNew: boolean;
  markets: TemperatureMarket[];
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
  isFulfilled: boolean; // 100% on one side
}

async function callProxy(endpoint: string, params: string) {
  const { data, error } = await supabase.functions.invoke("polymarket-proxy", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, params }),
  });

  if (error) throw error;
  return data;
}

export async function fetchTemperatureEvents(): Promise<TemperatureEvent[]> {
  // Use GET with query params through the proxy
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/polymarket-proxy?endpoint=events&params=${encodeURIComponent("active=true&closed=false&limit=100&order=createdAt&ascending=false&tag_slug=weather")}`,
    {
      headers: {
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    }
  );

  if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
  const events = await response.json();

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return events
    .filter((e: any) => {
      // Must be active, not closed, and temperature-related
      if (e.closed) return false;
      const text = `${e.title || ""} ${e.description || ""}`.toLowerCase();
      return text.includes("temperature") || text.includes("°c") || text.includes("°f");
    })
    .map((event: any) => {
      const title = event.title || "";
      const description = event.description || "";
      const location = extractLocation(title) || extractLocation(description);
      const timezone = getTimezone(location);
      const referenceLinks = extractLinks(description);
      const resolutionSource = event.markets?.[0]?.resolutionSource || referenceLinks[0] || "";

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

      // Filter out events where ALL markets are fulfilled (100%)
      const hasUnfulfilled = markets.some((m) => !m.isFulfilled);

      return {
        id: event.id,
        title,
        description,
        location,
        timezone,
        endDate: event.endDate,
        createdAt: event.createdAt,
        image: event.image || event.icon || "",
        slug: event.slug || "",
        resolutionSource,
        referenceLinks,
        volume: event.volume || 0,
        liquidity: event.liquidity || event.liquidityClob || 0,
        polymarketUrl: `https://polymarket.com/event/${event.slug}`,
        isNew: new Date(event.createdAt) > oneDayAgo,
        markets: markets.filter((m) => !m.isFulfilled), // Only show unfulfilled
        _hasUnfulfilled: hasUnfulfilled,
      };
    })
    .filter((e: any) => e._hasUnfulfilled && e.markets.length > 0)
    .map(({ _hasUnfulfilled, ...e }: any) => e);
}
