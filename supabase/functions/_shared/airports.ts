/**
 * Curated airport database for METAR-based temperature resolution.
 *
 * Single source of truth, imported by:
 *   - Supabase edge functions (Deno): `import { ... } from "../_shared/airports.ts"`
 *   - Vite frontend re-export at `src/lib/airports.ts`
 *
 * Seeded from the previous CITY_WU_URLS + wuIcaoCoords data. Replace or extend
 * via a future ourairports.csv pipeline when broader coverage is needed.
 */

export type AirportSize = "large" | "medium" | "small";

export interface Airport {
  /** ICAO 4-letter code (e.g. "NZWN"). Required. */
  icao: string;
  /** IATA 3-letter code (e.g. "WLG"), or null if none. */
  iata: string | null;
  /** Full airport name (e.g. "Wellington International Airport"). */
  name: string;
  /** Primary city / municipality served (e.g. "Wellington"). */
  city: string;
  /** ISO 3166-1 alpha-2 country code (e.g. "NZ"). */
  country: string;
  lat: number;
  lon: number;
  /** IANA timezone (e.g. "Pacific/Auckland"). */
  timezone: string;
  size: AirportSize;
}

export const airports: Airport[] = [
  // United States
  { icao: "KMIA", iata: "MIA", name: "Miami International Airport", city: "Miami", country: "US", lat: 25.796, lon: -80.291, timezone: "America/New_York", size: "large" },
  { icao: "KLGA", iata: "LGA", name: "LaGuardia Airport", city: "New York", country: "US", lat: 40.777, lon: -73.874, timezone: "America/New_York", size: "large" },
  { icao: "KORD", iata: "ORD", name: "Chicago O'Hare International Airport", city: "Chicago", country: "US", lat: 41.974, lon: -87.907, timezone: "America/Chicago", size: "large" },
  { icao: "KLAX", iata: "LAX", name: "Los Angeles International Airport", city: "Los Angeles", country: "US", lat: 33.943, lon: -118.408, timezone: "America/Los_Angeles", size: "large" },
  { icao: "KIAH", iata: "IAH", name: "George Bush Intercontinental Airport", city: "Houston", country: "US", lat: 29.99, lon: -95.337, timezone: "America/Chicago", size: "large" },
  { icao: "KDFW", iata: "DFW", name: "Dallas/Fort Worth International Airport", city: "Dallas", country: "US", lat: 32.9, lon: -97.04, timezone: "America/Chicago", size: "large" },
  { icao: "KPHX", iata: "PHX", name: "Phoenix Sky Harbor International Airport", city: "Phoenix", country: "US", lat: 33.434, lon: -112.012, timezone: "America/Phoenix", size: "large" },
  { icao: "KDEN", iata: "DEN", name: "Denver International Airport", city: "Denver", country: "US", lat: 39.856, lon: -104.674, timezone: "America/Denver", size: "large" },
  { icao: "KSEA", iata: "SEA", name: "Seattle-Tacoma International Airport", city: "Seattle", country: "US", lat: 47.45, lon: -122.309, timezone: "America/Los_Angeles", size: "large" },
  { icao: "KSFO", iata: "SFO", name: "San Francisco International Airport", city: "San Francisco", country: "US", lat: 37.621, lon: -122.379, timezone: "America/Los_Angeles", size: "large" },
  { icao: "KBOS", iata: "BOS", name: "Boston Logan International Airport", city: "Boston", country: "US", lat: 42.366, lon: -71.01, timezone: "America/New_York", size: "large" },
  { icao: "KATL", iata: "ATL", name: "Hartsfield-Jackson Atlanta International Airport", city: "Atlanta", country: "US", lat: 33.641, lon: -84.428, timezone: "America/New_York", size: "large" },
  { icao: "KDCA", iata: "DCA", name: "Ronald Reagan Washington National Airport", city: "Washington", country: "US", lat: 38.851, lon: -77.04, timezone: "America/New_York", size: "large" },
  { icao: "KLAS", iata: "LAS", name: "Harry Reid International Airport", city: "Las Vegas", country: "US", lat: 36.084, lon: -115.154, timezone: "America/Los_Angeles", size: "large" },
  { icao: "KAUS", iata: "AUS", name: "Austin-Bergstrom International Airport", city: "Austin", country: "US", lat: 30.195, lon: -97.67, timezone: "America/Chicago", size: "large" },
  { icao: "KDTW", iata: "DTW", name: "Detroit Metropolitan Wayne County Airport", city: "Detroit", country: "US", lat: 42.216, lon: -83.355, timezone: "America/Detroit", size: "large" },
  { icao: "KPDX", iata: "PDX", name: "Portland International Airport", city: "Portland", country: "US", lat: 45.59, lon: -122.595, timezone: "America/Los_Angeles", size: "large" },
  { icao: "KSLC", iata: "SLC", name: "Salt Lake City International Airport", city: "Salt Lake City", country: "US", lat: 40.79, lon: -111.979, timezone: "America/Denver", size: "large" },
  { icao: "PANC", iata: "ANC", name: "Ted Stevens Anchorage International Airport", city: "Anchorage", country: "US", lat: 61.174, lon: -149.996, timezone: "America/Anchorage", size: "large" },
  { icao: "PHNL", iata: "HNL", name: "Daniel K. Inouye International Airport", city: "Honolulu", country: "US", lat: 21.325, lon: -157.925, timezone: "Pacific/Honolulu", size: "large" },

  // Canada
  { icao: "CYYZ", iata: "YYZ", name: "Toronto Pearson International Airport", city: "Toronto", country: "CA", lat: 43.678, lon: -79.625, timezone: "America/Toronto", size: "large" },
  { icao: "CYVR", iata: "YVR", name: "Vancouver International Airport", city: "Vancouver", country: "CA", lat: 49.195, lon: -123.179, timezone: "America/Vancouver", size: "large" },
  { icao: "CYYC", iata: "YYC", name: "Calgary International Airport", city: "Calgary", country: "CA", lat: 51.114, lon: -114.02, timezone: "America/Edmonton", size: "large" },
  { icao: "CYUL", iata: "YUL", name: "Montreal-Trudeau International Airport", city: "Montreal", country: "CA", lat: 45.458, lon: -73.75, timezone: "America/Toronto", size: "large" },
  { icao: "CYOW", iata: "YOW", name: "Ottawa Macdonald-Cartier International Airport", city: "Ottawa", country: "CA", lat: 45.323, lon: -75.669, timezone: "America/Toronto", size: "large" },

  // Europe
  { icao: "EGLL", iata: "LHR", name: "London Heathrow Airport", city: "London", country: "GB", lat: 51.47, lon: -0.454, timezone: "Europe/London", size: "large" },
  { icao: "LFPG", iata: "CDG", name: "Paris Charles de Gaulle Airport", city: "Paris", country: "FR", lat: 49.01, lon: 2.548, timezone: "Europe/Paris", size: "large" },
  { icao: "EDDB", iata: "BER", name: "Berlin Brandenburg Airport", city: "Berlin", country: "DE", lat: 52.367, lon: 13.503, timezone: "Europe/Berlin", size: "large" },
  { icao: "EDDM", iata: "MUC", name: "Munich Airport", city: "Munich", country: "DE", lat: 48.354, lon: 11.786, timezone: "Europe/Berlin", size: "large" },
  { icao: "LIRF", iata: "FCO", name: "Leonardo da Vinci-Fiumicino Airport", city: "Rome", country: "IT", lat: 41.8, lon: 12.238, timezone: "Europe/Rome", size: "large" },
  { icao: "LEMD", iata: "MAD", name: "Adolfo Suarez Madrid-Barajas Airport", city: "Madrid", country: "ES", lat: 40.472, lon: -3.563, timezone: "Europe/Madrid", size: "large" },
  { icao: "EHAM", iata: "AMS", name: "Amsterdam Airport Schiphol", city: "Amsterdam", country: "NL", lat: 52.311, lon: 4.768, timezone: "Europe/Amsterdam", size: "large" },
  { icao: "LSZH", iata: "ZRH", name: "Zurich Airport", city: "Zurich", country: "CH", lat: 47.458, lon: 8.556, timezone: "Europe/Zurich", size: "large" },
  { icao: "UUEE", iata: "SVO", name: "Sheremetyevo International Airport", city: "Moscow", country: "RU", lat: 55.973, lon: 37.415, timezone: "Europe/Moscow", size: "large" },
  { icao: "LTFM", iata: "IST", name: "Istanbul Airport", city: "Istanbul", country: "TR", lat: 41.262, lon: 28.728, timezone: "Europe/Istanbul", size: "large" },
  { icao: "LTAC", iata: "ESB", name: "Ankara Esenboga Airport", city: "Ankara", country: "TR", lat: 40.128, lon: 32.995, timezone: "Europe/Istanbul", size: "large" },

  // Middle East / Africa
  { icao: "HECA", iata: "CAI", name: "Cairo International Airport", city: "Cairo", country: "EG", lat: 30.122, lon: 31.406, timezone: "Africa/Cairo", size: "large" },
  { icao: "FAOR", iata: "JNB", name: "O. R. Tambo International Airport", city: "Johannesburg", country: "ZA", lat: -26.139, lon: 28.246, timezone: "Africa/Johannesburg", size: "large" },
  { icao: "OMDB", iata: "DXB", name: "Dubai International Airport", city: "Dubai", country: "AE", lat: 25.253, lon: 55.366, timezone: "Asia/Dubai", size: "large" },
  { icao: "LLBG", iata: "TLV", name: "Ben Gurion International Airport", city: "Tel Aviv", country: "IL", lat: 32.011, lon: 34.887, timezone: "Asia/Jerusalem", size: "large" },

  // Asia
  { icao: "RKSI", iata: "ICN", name: "Incheon International Airport", city: "Seoul", country: "KR", lat: 37.46, lon: 126.441, timezone: "Asia/Seoul", size: "large" },
  { icao: "RJTT", iata: "HND", name: "Tokyo Haneda Airport", city: "Tokyo", country: "JP", lat: 35.549, lon: 139.78, timezone: "Asia/Tokyo", size: "large" },
  { icao: "ZBAA", iata: "PEK", name: "Beijing Capital International Airport", city: "Beijing", country: "CN", lat: 40.08, lon: 116.603, timezone: "Asia/Shanghai", size: "large" },
  { icao: "ZSPD", iata: "PVG", name: "Shanghai Pudong International Airport", city: "Shanghai", country: "CN", lat: 31.143, lon: 121.805, timezone: "Asia/Shanghai", size: "large" },
  { icao: "VHHH", iata: "HKG", name: "Hong Kong International Airport", city: "Hong Kong", country: "HK", lat: 22.308, lon: 113.919, timezone: "Asia/Hong_Kong", size: "large" },
  { icao: "WSSS", iata: "SIN", name: "Singapore Changi Airport", city: "Singapore", country: "SG", lat: 1.364, lon: 103.992, timezone: "Asia/Singapore", size: "large" },
  { icao: "VTBS", iata: "BKK", name: "Suvarnabhumi Airport", city: "Bangkok", country: "TH", lat: 13.681, lon: 100.747, timezone: "Asia/Bangkok", size: "large" },
  { icao: "RPLL", iata: "MNL", name: "Ninoy Aquino International Airport", city: "Manila", country: "PH", lat: 14.509, lon: 121.02, timezone: "Asia/Manila", size: "large" },
  { icao: "WIII", iata: "CGK", name: "Soekarno-Hatta International Airport", city: "Jakarta", country: "ID", lat: -6.126, lon: 106.656, timezone: "Asia/Jakarta", size: "large" },
  { icao: "WMKK", iata: "KUL", name: "Kuala Lumpur International Airport", city: "Kuala Lumpur", country: "MY", lat: 2.746, lon: 101.71, timezone: "Asia/Kuala_Lumpur", size: "large" },
  { icao: "VDPP", iata: "PNH", name: "Phnom Penh International Airport", city: "Phnom Penh", country: "KH", lat: 11.547, lon: 104.844, timezone: "Asia/Phnom_Penh", size: "large" },
  { icao: "VVTS", iata: "SGN", name: "Tan Son Nhat International Airport", city: "Ho Chi Minh City", country: "VN", lat: 10.819, lon: 106.652, timezone: "Asia/Ho_Chi_Minh", size: "large" },
  { icao: "VIDP", iata: "DEL", name: "Indira Gandhi International Airport", city: "Delhi", country: "IN", lat: 28.555, lon: 77.084, timezone: "Asia/Kolkata", size: "large" },
  { icao: "VABB", iata: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport", city: "Mumbai", country: "IN", lat: 19.09, lon: 72.868, timezone: "Asia/Kolkata", size: "large" },
  { icao: "VILK", iata: "LKO", name: "Chaudhary Charan Singh International Airport", city: "Lucknow", country: "IN", lat: 26.761, lon: 80.889, timezone: "Asia/Kolkata", size: "medium" },

  // Oceania
  { icao: "YSSY", iata: "SYD", name: "Sydney Kingsford Smith Airport", city: "Sydney", country: "AU", lat: -33.946, lon: 151.177, timezone: "Australia/Sydney", size: "large" },
  { icao: "YMML", iata: "MEL", name: "Melbourne Airport", city: "Melbourne", country: "AU", lat: -37.673, lon: 144.843, timezone: "Australia/Melbourne", size: "large" },
  { icao: "YBBN", iata: "BNE", name: "Brisbane Airport", city: "Brisbane", country: "AU", lat: -27.384, lon: 153.118, timezone: "Australia/Brisbane", size: "large" },
  { icao: "YPPH", iata: "PER", name: "Perth Airport", city: "Perth", country: "AU", lat: -31.94, lon: 115.967, timezone: "Australia/Perth", size: "large" },
  { icao: "NZAA", iata: "AKL", name: "Auckland Airport", city: "Auckland", country: "NZ", lat: -37.008, lon: 174.785, timezone: "Pacific/Auckland", size: "large" },
  { icao: "NZWN", iata: "WLG", name: "Wellington International Airport", city: "Wellington", country: "NZ", lat: -41.327, lon: 174.805, timezone: "Pacific/Auckland", size: "large" },

  // Latin America
  { icao: "SBGR", iata: "GRU", name: "São Paulo/Guarulhos International Airport", city: "São Paulo", country: "BR", lat: -23.436, lon: -46.473, timezone: "America/Sao_Paulo", size: "large" },
  { icao: "MMMX", iata: "MEX", name: "Mexico City International Airport", city: "Mexico City", country: "MX", lat: 19.436, lon: -99.072, timezone: "America/Mexico_City", size: "large" },
  { icao: "SAEZ", iata: "EZE", name: "Ministro Pistarini International Airport", city: "Buenos Aires", country: "AR", lat: -34.822, lon: -58.536, timezone: "America/Argentina/Buenos_Aires", size: "large" },
  { icao: "SPJC", iata: "LIM", name: "Jorge Chavez International Airport", city: "Lima", country: "PE", lat: -12.022, lon: -77.114, timezone: "America/Lima", size: "large" },
  { icao: "SKBO", iata: "BOG", name: "El Dorado International Airport", city: "Bogota", country: "CO", lat: 4.702, lon: -74.147, timezone: "America/Bogota", size: "large" },
  { icao: "SCEL", iata: "SCL", name: "Comodoro Arturo Merino Benitez International Airport", city: "Santiago", country: "CL", lat: -33.393, lon: -70.786, timezone: "America/Santiago", size: "large" },
];

/**
 * Direct city → ICAO mapping for the most common Polymarket market locations.
 * Keys are normalized (lowercase, ASCII). Used as the first lookup pass in
 * `resolveAirportForLocation` so heuristics don't pick the wrong nearby airport.
 */
const CITY_TO_ICAO: Record<string, string> = {
  "miami": "KMIA",
  "new york": "KLGA",
  "chicago": "KORD",
  "los angeles": "KLAX",
  "houston": "KIAH",
  "dallas": "KDFW",
  "phoenix": "KPHX",
  "denver": "KDEN",
  "seattle": "KSEA",
  "san francisco": "KSFO",
  "boston": "KBOS",
  "atlanta": "KATL",
  "washington": "KDCA",
  "las vegas": "KLAS",
  "austin": "KAUS",
  "detroit": "KDTW",
  "portland": "KPDX",
  "salt lake city": "KSLC",
  "anchorage": "PANC",
  "honolulu": "PHNL",
  "toronto": "CYYZ",
  "vancouver": "CYVR",
  "calgary": "CYYC",
  "montreal": "CYUL",
  "ottawa": "CYOW",
  "london": "EGLL",
  "paris": "LFPG",
  "berlin": "EDDB",
  "munich": "EDDM",
  "rome": "LIRF",
  "madrid": "LEMD",
  "amsterdam": "EHAM",
  "zurich": "LSZH",
  "moscow": "UUEE",
  "istanbul": "LTFM",
  "ankara": "LTAC",
  "cairo": "HECA",
  "johannesburg": "FAOR",
  "dubai": "OMDB",
  "seoul": "RKSI",
  "tokyo": "RJTT",
  "beijing": "ZBAA",
  "shanghai": "ZSPD",
  "hong kong": "VHHH",
  "singapore": "WSSS",
  "bangkok": "VTBS",
  "manila": "RPLL",
  "jakarta": "WIII",
  "kuala lumpur": "WMKK",
  "phnom penh": "VDPP",
  "ho chi minh": "VVTS",
  "ho chi minh city": "VVTS",
  "delhi": "VIDP",
  "new delhi": "VIDP",
  "mumbai": "VABB",
  "lucknow": "VILK",
  "tel aviv": "LLBG",
  "ben gurion": "LLBG",
  // Polymarket Israel temperature markets settle on Ben Gurion observations.
  "jerusalem": "LLBG",
  "haifa": "LLBG",
  "sydney": "YSSY",
  "melbourne": "YMML",
  "brisbane": "YBBN",
  "perth": "YPPH",
  "auckland": "NZAA",
  "wellington": "NZWN",
  "sao paulo": "SBGR",
  "são paulo": "SBGR",
  "mexico city": "MMMX",
  "buenos aires": "SAEZ",
  "lima": "SPJC",
  "bogota": "SKBO",
  "bogotá": "SKBO",
  "santiago": "SCEL",
};

const LOCATION_ALIASES: Record<string, string> = {
  "nyc": "new york",
  "new york city": "new york",
  "washington dc": "washington",
  "washington d c": "washington",
  "washington d.c": "washington",
  "washington d.c.": "washington",
};

/** Lowercase, strip diacritics, collapse whitespace. Matches `polymarket.ts` semantics. */
export function normalizeLocationKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const byIcao: Map<string, Airport> = new Map(airports.map((a) => [a.icao.toUpperCase(), a]));

export function findAirportByIcao(icao: string): Airport | null {
  if (!icao) return null;
  return byIcao.get(icao.toUpperCase()) ?? null;
}

/**
 * Pick the most likely METAR-reporting airport for a Polymarket location string.
 *
 * Strategy (highest precedence first):
 *   1. Exact normalized match in `CITY_TO_ICAO` (or after alias resolution).
 *   2. Substring match between the location and any `CITY_TO_ICAO` key.
 *   3. Scored search over the full `airports` list:
 *      - exact city match: +10
 *      - substring city match: +3
 *      - country hint match: +5
 *      - size: large +5 / medium +2
 *      - has IATA: +1
 *      Only airports with an ICAO are considered.
 *
 * Returns `null` when no plausible station is found (caller should surface an
 * explicit "No airport station match found" error instead of silently falling
 * back to a different temperature source).
 */
export function resolveAirportForLocation(location: string, country?: string): Airport | null {
  if (!location) return null;
  const normalized = normalizeLocationKey(location);
  const canonical = LOCATION_ALIASES[normalized] ?? normalized;

  const directIcao = CITY_TO_ICAO[canonical];
  if (directIcao) {
    const airport = findAirportByIcao(directIcao);
    if (airport) return airport;
  }

  for (const [city, icao] of Object.entries(CITY_TO_ICAO)) {
    if (canonical.includes(city) || city.includes(canonical)) {
      const airport = findAirportByIcao(icao);
      if (airport) return airport;
    }
  }

  let bestScore = 0;
  let best: Airport | null = null;
  for (const a of airports) {
    if (!a.icao) continue;
    const cityNorm = normalizeLocationKey(a.city);
    // Require some level of city signal so we don't pick a random large airport
    // for unrelated locations (e.g. "Atlantis" -> Perth).
    let cityScore = 0;
    if (cityNorm === canonical) cityScore = 10;
    else if (canonical.includes(cityNorm) || cityNorm.includes(canonical)) cityScore = 3;
    else continue;

    let score = cityScore;
    if (country && a.country.toLowerCase() === country.toLowerCase()) score += 5;
    if (a.iata) score += 1;
    if (a.size === "large") score += 5;
    else if (a.size === "medium") score += 2;
    if (score > bestScore || (score === bestScore && best !== null && a.name.length < best.name.length)) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}
