const GAMMA_API = "https://gamma-api.polymarket.com";

export interface PolymarketMarket {
  id: string;
  question: string;
  slug: string;
  description: string;
  outcomes: string;
  outcomePrices: string;
  active: boolean;
  closed: boolean;
  startDate: string;
  endDate: string;
  createdAt: string;
  volume: string;
  liquidity: string;
  image: string;
  icon: string;
  tags?: { id: string; label: string; slug: string }[];
}

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  startDate: string;
  endDate: string;
  markets: PolymarketMarket[];
  createdAt: string;
  volume: string;
  liquidity: string;
  image: string;
  icon: string;
  tags?: { id: string; label: string; slug: string }[];
}

export interface ParsedTemperatureBet {
  id: string;
  question: string;
  slug: string;
  description: string;
  location: string;
  timezone: string;
  outcomes: string[];
  prices: number[];
  active: boolean;
  closed: boolean;
  endDate: string;
  createdAt: string;
  volume: string;
  referenceLinks: string[];
  isNew: boolean;
  polymarketUrl: string;
}

// Known city → timezone mappings for temperature bets
const CITY_TIMEZONES: Record<string, string> = {
  "new york": "America/New_York",
  "nyc": "America/New_York",
  "los angeles": "America/Los_Angeles",
  "la": "America/Los_Angeles",
  "chicago": "America/Chicago",
  "miami": "America/New_York",
  "dallas": "America/Chicago",
  "houston": "America/Chicago",
  "phoenix": "America/Phoenix",
  "denver": "America/Denver",
  "seattle": "America/Los_Angeles",
  "san francisco": "America/Los_Angeles",
  "sf": "America/Los_Angeles",
  "boston": "America/New_York",
  "atlanta": "America/New_York",
  "washington": "America/New_York",
  "dc": "America/New_York",
  "london": "Europe/London",
  "paris": "Europe/Paris",
  "tokyo": "Asia/Tokyo",
  "sydney": "Australia/Sydney",
  "toronto": "America/Toronto",
  "las vegas": "America/Los_Angeles",
  "austin": "America/Chicago",
  "nashville": "America/Chicago",
  "detroit": "America/Detroit",
  "minneapolis": "America/Chicago",
  "philadelphia": "America/New_York",
  "portland": "America/Los_Angeles",
  "charlotte": "America/New_York",
  "san diego": "America/Los_Angeles",
  "tampa": "America/New_York",
  "orlando": "America/New_York",
  "sacramento": "America/Los_Angeles",
  "salt lake city": "America/Denver",
  "pittsburgh": "America/New_York",
  "cleveland": "America/New_York",
  "columbus": "America/New_York",
  "indianapolis": "America/Indiana/Indianapolis",
  "kansas city": "America/Chicago",
  "st louis": "America/Chicago",
  "memphis": "America/Chicago",
  "milwaukee": "America/Chicago",
  "jacksonville": "America/New_York",
  "raleigh": "America/New_York",
  "richmond": "America/New_York",
  "louisville": "America/Kentucky/Louisville",
  "oklahoma city": "America/Chicago",
  "new orleans": "America/Chicago",
  "anchorage": "America/Anchorage",
  "honolulu": "Pacific/Honolulu",
};

function extractLocation(question: string): string {
  // Try to extract city name from temperature bet questions
  // Common patterns: "Will the temperature in X exceed...", "X temperature above..."
  const patterns = [
    /(?:temperature|temp)\s+in\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:exceed|above|below|reach|hit|be|on|for))/i,
    /(?:Will|What)\s+(?:the\s+)?(?:high|low)?\s*(?:temperature|temp)\s+in\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:exceed|above|below|reach|hit|be|on|for))/i,
    /([A-Z][a-zA-Z\s]+?)\s+(?:high|low)?\s*(?:temperature|temp)/i,
    /(?:in\s+)([A-Z][a-zA-Z\s,]+?)(?:\s+on|\s+be|\s+exceed|\?)/i,
  ];

  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "Unknown Location";
}

function getTimezone(location: string): string {
  const lower = location.toLowerCase().trim();
  for (const [city, tz] of Object.entries(CITY_TIMEZONES)) {
    if (lower.includes(city)) return tz;
  }
  return "America/New_York"; // Default fallback
}

function extractLinks(description: string): string[] {
  const urlRegex = /https?:\/\/[^\s)<>"]+/g;
  return description.match(urlRegex) || [];
}

function isNewBet(createdAt: string): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  return hoursDiff < 24;
}

export async function fetchTemperatureMarkets(): Promise<ParsedTemperatureBet[]> {
  try {
    // Search for temperature-related events
    const response = await fetch(
      `${GAMMA_API}/events?active=true&closed=false&limit=100&order=createdAt&ascending=false`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const events: PolymarketEvent[] = await response.json();

    // Filter for temperature-related events
    const tempEvents = events.filter((event) => {
      const text = `${event.title} ${event.description}`.toLowerCase();
      return (
        text.includes("temperature") ||
        text.includes("degrees") ||
        text.includes("°f") ||
        text.includes("°c") ||
        text.includes("weather") ||
        (text.includes("high") && text.includes("forecast"))
      );
    });

    const bets: ParsedTemperatureBet[] = [];

    for (const event of tempEvents) {
      if (event.markets) {
        for (const market of event.markets) {
          const location = extractLocation(market.question || event.title);
          const timezone = getTimezone(location);
          const description = market.description || event.description || "";

          let outcomes: string[] = [];
          let prices: number[] = [];

          try {
            outcomes = JSON.parse(market.outcomes || "[]");
            prices = JSON.parse(market.outcomePrices || "[]").map(Number);
          } catch {
            outcomes = ["Yes", "No"];
            prices = [0.5, 0.5];
          }

          bets.push({
            id: market.id,
            question: market.question || event.title,
            slug: market.slug || event.slug,
            description,
            location,
            timezone,
            outcomes,
            prices,
            active: market.active,
            closed: market.closed,
            endDate: market.endDate || event.endDate,
            createdAt: market.createdAt || event.createdAt,
            volume: market.volume || "0",
            referenceLinks: extractLinks(description),
            isNew: isNewBet(market.createdAt || event.createdAt),
            polymarketUrl: `https://polymarket.com/event/${event.slug}`,
          });
        }
      }
    }

    return bets;
  } catch (error) {
    console.error("Failed to fetch temperature markets:", error);
    return [];
  }
}

// Also try searching directly for temperature markets
export async function searchTemperatureMarkets(): Promise<ParsedTemperatureBet[]> {
  try {
    const response = await fetch(
      `${GAMMA_API}/markets?active=true&closed=false&limit=50&order=createdAt&ascending=false&tag_slug=weather`
    );

    if (!response.ok) {
      // Fallback: search by text
      const searchRes = await fetch(
        `${GAMMA_API}/markets?active=true&closed=false&limit=50&order=createdAt&ascending=false`
      );
      if (!searchRes.ok) return [];
      const markets: PolymarketMarket[] = await searchRes.json();
      return processMarkets(markets);
    }

    const markets: PolymarketMarket[] = await response.json();
    return processMarkets(markets);
  } catch {
    return [];
  }
}

function processMarkets(markets: PolymarketMarket[]): ParsedTemperatureBet[] {
  return markets
    .filter((m) => {
      const text = `${m.question} ${m.description}`.toLowerCase();
      return text.includes("temperature") || text.includes("degrees") || text.includes("°f") || text.includes("°c");
    })
    .map((market) => {
      const location = extractLocation(market.question);
      const timezone = getTimezone(location);
      const description = market.description || "";

      let outcomes: string[] = [];
      let prices: number[] = [];
      try {
        outcomes = JSON.parse(market.outcomes || "[]");
        prices = JSON.parse(market.outcomePrices || "[]").map(Number);
      } catch {
        outcomes = ["Yes", "No"];
        prices = [0.5, 0.5];
      }

      return {
        id: market.id,
        question: market.question,
        slug: market.slug,
        description,
        location,
        timezone,
        outcomes,
        prices,
        active: market.active,
        closed: market.closed,
        endDate: market.endDate,
        createdAt: market.createdAt,
        volume: market.volume || "0",
        referenceLinks: extractLinks(description),
        isNew: isNewBet(market.createdAt),
        polymarketUrl: `https://polymarket.com/market/${market.slug}`,
      };
    });
}
