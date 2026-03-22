import { useQuery } from "@tanstack/react-query";
import { getSupabaseFunctionUrl } from "@/lib/supabaseFunctions";
import { getSupabaseAuthHeaders } from "@/lib/supabaseAuth";

export interface HourlyTemp {
  hour: number;
  tempF: number;
  tempC: number;
  isRecorded: boolean;
}

export interface DateWeather {
  highF: number | null;
  highC: number | null;
  forecastHighF: number | null;
  forecastHighC: number | null;
  peakHour: number | null;
  pastPeak: boolean;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  observedCoolingConfirmed: boolean;
  coolingStartHour: number | null;
  hourly: HourlyTemp[];
}

export interface CityWeather {
  currentTempF: number | null;
  currentTempC: number | null;
  highestRecordedF: number | null;
  highestRecordedC: number | null;
  forecastHighF: number | null;
  forecastHighC: number | null;
  peakHour: number | null;
  currentHour: number;
  pastPeak: boolean;
  observedCoolingConfirmed: boolean;
  coolingStartHour: number | null;
  timezone: string;
  dates?: Record<string, DateWeather>;
  error?: string;
}

/* ── OWM direct-call config ─────────────────────────────────────────── */

const OWM_KEY = "c373407c1960a367bfdd6779e302577b";

const CITY_COORDS: Record<string, { lat: number; lon: number; tz: string }> = {
  munich: { lat: 48.14, lon: 11.58, tz: "Europe/Berlin" },
  london: { lat: 51.51, lon: -0.13, tz: "Europe/London" },
  paris: { lat: 48.86, lon: 2.35, tz: "Europe/Paris" },
  tokyo: { lat: 35.68, lon: 139.69, tz: "Asia/Tokyo" },
  sydney: { lat: -33.87, lon: 151.21, tz: "Australia/Sydney" },
  "new york": { lat: 40.71, lon: -74.01, tz: "America/New_York" },
  "los angeles": { lat: 34.05, lon: -118.24, tz: "America/Los_Angeles" },
  chicago: { lat: 41.88, lon: -87.63, tz: "America/Chicago" },
  miami: { lat: 25.76, lon: -80.19, tz: "America/New_York" },
  dallas: { lat: 32.78, lon: -96.8, tz: "America/Chicago" },
  houston: { lat: 29.76, lon: -95.37, tz: "America/Chicago" },
  phoenix: { lat: 33.45, lon: -112.07, tz: "America/Phoenix" },
  denver: { lat: 39.74, lon: -104.98, tz: "America/Denver" },
  seattle: { lat: 47.61, lon: -122.33, tz: "America/Los_Angeles" },
  berlin: { lat: 52.52, lon: 13.41, tz: "Europe/Berlin" },
  rome: { lat: 41.9, lon: 12.5, tz: "Europe/Rome" },
  madrid: { lat: 40.42, lon: -3.7, tz: "Europe/Madrid" },
  amsterdam: { lat: 52.37, lon: 4.9, tz: "Europe/Amsterdam" },
  dubai: { lat: 25.2, lon: 55.27, tz: "Asia/Dubai" },
  singapore: { lat: 1.35, lon: 103.82, tz: "Asia/Singapore" },
  toronto: { lat: 43.65, lon: -79.38, tz: "America/Toronto" },
  vancouver: { lat: 49.28, lon: -123.12, tz: "America/Vancouver" },
  melbourne: { lat: -37.81, lon: 144.96, tz: "Australia/Melbourne" },
  seoul: { lat: 37.57, lon: 126.98, tz: "Asia/Seoul" },
  bangkok: { lat: 13.76, lon: 100.5, tz: "Asia/Bangkok" },
  "phnom penh": { lat: 11.56, lon: 104.92, tz: "Asia/Phnom_Penh" },
  "ho chi minh": { lat: 10.82, lon: 106.63, tz: "Asia/Ho_Chi_Minh" },
  "kuala lumpur": { lat: 3.14, lon: 101.69, tz: "Asia/Kuala_Lumpur" },
  manila: { lat: 14.6, lon: 120.98, tz: "Asia/Manila" },
  jakarta: { lat: -6.21, lon: 106.85, tz: "Asia/Jakarta" },
  delhi: { lat: 28.61, lon: 77.21, tz: "Asia/Kolkata" },
  mumbai: { lat: 19.08, lon: 72.88, tz: "Asia/Kolkata" },
  "hong kong": { lat: 22.32, lon: 114.17, tz: "Asia/Hong_Kong" },
  beijing: { lat: 39.9, lon: 116.4, tz: "Asia/Shanghai" },
  shanghai: { lat: 31.23, lon: 121.47, tz: "Asia/Shanghai" },
  chengdu: { lat: 30.67, lon: 104.07, tz: "Asia/Shanghai" },
  chongqing: { lat: 29.56, lon: 106.55, tz: "Asia/Shanghai" },
  shenzhen: { lat: 22.54, lon: 114.06, tz: "Asia/Shanghai" },
  wuhan: { lat: 30.59, lon: 114.31, tz: "Asia/Shanghai" },
  "san francisco": { lat: 37.77, lon: -122.42, tz: "America/Los_Angeles" },
  boston: { lat: 42.36, lon: -71.06, tz: "America/New_York" },
  atlanta: { lat: 33.75, lon: -84.39, tz: "America/New_York" },
  washington: { lat: 38.91, lon: -77.04, tz: "America/New_York" },
  "las vegas": { lat: 36.17, lon: -115.14, tz: "America/Los_Angeles" },
  austin: { lat: 30.27, lon: -97.74, tz: "America/Chicago" },
  detroit: { lat: 42.33, lon: -83.05, tz: "America/Detroit" },
  portland: { lat: 45.52, lon: -122.68, tz: "America/Los_Angeles" },
  "salt lake city": { lat: 40.76, lon: -111.89, tz: "America/Denver" },
  anchorage: { lat: 61.22, lon: -149.9, tz: "America/Anchorage" },
  honolulu: { lat: 21.31, lon: -157.86, tz: "Pacific/Honolulu" },
  moscow: { lat: 55.76, lon: 37.62, tz: "Europe/Moscow" },
  istanbul: { lat: 41.01, lon: 28.98, tz: "Europe/Istanbul" },
  cairo: { lat: 30.04, lon: 31.24, tz: "Africa/Cairo" },
  "sao paulo": { lat: -23.55, lon: -46.63, tz: "America/Sao_Paulo" },
  "mexico city": { lat: 19.43, lon: -99.13, tz: "America/Mexico_City" },
  "buenos aires": { lat: -34.6, lon: -58.38, tz: "America/Argentina/Buenos_Aires" },
  zurich: { lat: 47.37, lon: 8.54, tz: "Europe/Zurich" },
  auckland: { lat: -36.85, lon: 174.76, tz: "Pacific/Auckland" },
  brisbane: { lat: -27.47, lon: 153.03, tz: "Australia/Brisbane" },
  perth: { lat: -31.95, lon: 115.86, tz: "Australia/Perth" },
  calgary: { lat: 51.05, lon: -114.07, tz: "America/Edmonton" },
  montreal: { lat: 45.5, lon: -73.57, tz: "America/Toronto" },
  ankara: { lat: 39.93, lon: 32.86, tz: "Europe/Istanbul" },
  lucknow: { lat: 26.85, lon: 80.95, tz: "Asia/Kolkata" },
  "tel aviv": { lat: 32.08, lon: 34.78, tz: "Asia/Jerusalem" },
  "ben gurion": { lat: 32.01, lon: 34.87, tz: "Asia/Jerusalem" },
  jerusalem: { lat: 31.77, lon: 35.22, tz: "Asia/Jerusalem" },
  haifa: { lat: 32.79, lon: 34.99, tz: "Asia/Jerusalem" },
  wellington: { lat: -41.29, lon: 174.78, tz: "Pacific/Auckland" },
  lima: { lat: -12.05, lon: -77.04, tz: "America/Lima" },
  bogota: { lat: 4.71, lon: -74.07, tz: "America/Bogota" },
  santiago: { lat: -33.45, lon: -70.67, tz: "America/Santiago" },
  johannesburg: { lat: -26.2, lon: 28.05, tz: "Africa/Johannesburg" },
  milan: { lat: 45.46, lon: 9.19, tz: "Europe/Rome" },
  warsaw: { lat: 52.23, lon: 21.01, tz: "Europe/Warsaw" },
  taipei: { lat: 25.03, lon: 121.57, tz: "Asia/Taipei" },
};

const CITY_ALIASES: Record<string, string> = {
  nyc: "new york",
  "new york city": "new york",
  "washington dc": "washington",
  "washington d c": "washington",
  "washington d.c": "washington",
  "washington d.c.": "washington",
  "são paulo": "sao paulo",
  "ben-gurion": "ben gurion",
  "ben gurion airport": "ben gurion",
};

function normalizeCityKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

function round3(v: number | null): number | null {
  return v !== null ? Math.round(v * 1000) / 1000 : null;
}

function toLocalDate(epochSec: number, tz: string): string {
  return new Date(epochSec * 1000).toLocaleDateString("en-CA", { timeZone: tz });
}

function toLocalHour(epochSec: number, tz: string): number {
  return parseInt(
    new Date(epochSec * 1000).toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }),
  );
}

function resolveCoords(city: string) {
  const normalized = normalizeCityKey(city);
  const canonical = CITY_ALIASES[normalized] ?? normalized;
  const direct = CITY_COORDS[canonical];
  if (direct) return direct;
  const fallbackKey = Object.keys(CITY_COORDS).find(
    (k) => canonical.includes(k) || k.includes(canonical),
  );
  return fallbackKey ? CITY_COORDS[fallbackKey] : undefined;
}

/** Placeholder locations from extractLocation when city cannot be parsed — not worth console noise. */
function isUnknownLocationLabel(city: string): boolean {
  const n = normalizeCityKey(city);
  return n === "" || n === "unknown" || n === "unknown city";
}

function processOwmData(
  currentTempF: number | null,
  todayMaxF: number | null,
  forecastList: any[],
  tz: string,
): Omit<CityWeather, "error"> {
  const now = new Date();
  const localDateStr = now.toLocaleDateString("en-CA", { timeZone: tz });
  const currentHourNum = parseInt(
    now.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", hour12: false }),
  );

  const hourlyByDate: Record<string, { hour: number; tempF: number }[]> = {};

  for (const entry of forecastList) {
    const dt: number = entry.dt;
    const dateStr = toLocalDate(dt, tz);
    const hour = toLocalHour(dt, tz);
    const tempF: number = entry.main?.temp ?? 0;
    const entryMax: number | null = entry.main?.temp_max ?? null;
    const bestTemp = entryMax !== null ? Math.max(tempF, entryMax) : tempF;
    if (!hourlyByDate[dateStr]) hourlyByDate[dateStr] = [];
    hourlyByDate[dateStr].push({ hour, tempF: bestTemp });
  }

  if (currentTempF !== null) {
    const bestCurrentF = todayMaxF !== null ? Math.max(currentTempF, todayMaxF) : currentTempF;
    if (!hourlyByDate[localDateStr]) hourlyByDate[localDateStr] = [];
    const existing = hourlyByDate[localDateStr].find((h) => h.hour === currentHourNum);
    if (!existing) {
      hourlyByDate[localDateStr].push({ hour: currentHourNum, tempF: bestCurrentF });
    } else if (bestCurrentF > existing.tempF) {
      existing.tempF = bestCurrentF;
    }
    hourlyByDate[localDateStr].sort((a, b) => a.hour - b.hour);
  }

  const dateData: Record<string, DateWeather> = {};

  for (const [dateStr, hours] of Object.entries(hourlyByDate)) {
    const isToday = dateStr === localDateStr;
    const isPast = dateStr < localDateStr;
    const isFuture = dateStr > localDateStr;

    const recordedHours = isToday
      ? hours.filter((h) => h.hour <= currentHourNum)
      : isPast
        ? hours
        : [];

    let highF: number | null;
    if (isPast) {
      highF = recordedHours.length > 0
        ? Math.max(...recordedHours.map((h) => h.tempF))
        : null;
    } else if (isToday) {
      const allTemps = hours.map((h) => h.tempF);
      highF = allTemps.length > 0 ? Math.max(...allTemps) : null;
    } else {
      highF = hours.length > 0
        ? Math.max(...hours.map((h) => h.tempF))
        : null;
    }

    const peakEntry =
      hours.length > 0
        ? hours.reduce((max, h) => (h.tempF > max.tempF ? h : max), hours[0])
        : null;
    const peakHour = peakEntry?.hour ?? null;
    const pastPeak = isToday && peakHour !== null && currentHourNum > peakHour;

    const hourlyArr: HourlyTemp[] = hours.map((h) => ({
      hour: h.hour,
      tempF: round3(h.tempF)!,
      tempC: round3(fToC(h.tempF))!,
      isRecorded: isPast || (isToday && h.hour <= currentHourNum),
    }));

    let observedCoolingConfirmed = false;
    let coolingStartHour: number | null = null;

    if (isPast) {
      observedCoolingConfirmed = true;
    } else if (isToday && recordedHours.length >= 3) {
      const recPeak = recordedHours.reduce(
        (max, h) => (h.tempF > max.tempF ? h : max),
        recordedHours[0],
      );
      const afterPeak = recordedHours
        .filter((h) => h.hour > recPeak.hour)
        .sort((a, b) => a.hour - b.hour);

      let consecutiveDeclines = 0;
      for (let i = 1; i < afterPeak.length; i++) {
        if (afterPeak[i].tempF < afterPeak[i - 1].tempF) {
          consecutiveDeclines++;
          if (consecutiveDeclines >= 2) {
            observedCoolingConfirmed = true;
            coolingStartHour =
              afterPeak[i - consecutiveDeclines]?.hour ?? afterPeak[i - 1].hour;
            break;
          }
        } else {
          consecutiveDeclines = 0;
        }
      }
    }

    dateData[dateStr] = {
      highF: round3(highF),
      highC: round3(highF !== null ? fToC(highF) : null),
      forecastHighF: hours.length > 0 ? round3(Math.max(...hours.map((h) => h.tempF))) : null,
      forecastHighC:
        hours.length > 0 ? round3(fToC(Math.max(...hours.map((h) => h.tempF)))) : null,
      peakHour,
      pastPeak,
      isToday,
      isPast,
      isFuture,
      observedCoolingConfirmed,
      coolingStartHour,
      hourly: hourlyArr,
    };
  }

  const todayData = dateData[localDateStr];

  return {
    currentTempF: round3(currentTempF),
    currentTempC: round3(currentTempF !== null ? fToC(currentTempF) : null),
    highestRecordedF: todayData?.highF ?? null,
    highestRecordedC: todayData?.highC ?? null,
    forecastHighF: todayData?.forecastHighF ?? null,
    forecastHighC: todayData?.forecastHighC ?? null,
    peakHour: todayData?.peakHour ?? null,
    currentHour: currentHourNum,
    pastPeak: todayData?.pastPeak ?? false,
    observedCoolingConfirmed: todayData?.observedCoolingConfirmed ?? false,
    coolingStartHour: todayData?.coolingStartHour ?? null,
    timezone: tz,
    dates: dateData,
  };
}

/* ── Strategy 1: call OWM directly from the browser ─────────────────── */

async function fetchAllOwmDirect(
  cities: string[],
): Promise<Record<string, CityWeather>> {
  const results: Record<string, CityWeather> = {};

  await Promise.all(
    cities.map(async (city) => {
      try {
        const coords = resolveCoords(city);
        if (!coords) {
          if (!isUnknownLocationLabel(city)) {
            console.warn(`[weather] Unknown city: ${city}`);
          }
          return;
        }

        const base = "https://api.openweathermap.org/data/2.5";
        const qs = `lat=${coords.lat}&lon=${coords.lon}&appid=${OWM_KEY}&units=imperial`;

        const [currentResp, forecastResp] = await Promise.all([
          fetch(`${base}/weather?${qs}`),
          fetch(`${base}/forecast?${qs}`),
        ]);

        if (!currentResp.ok) {
          console.warn(`[weather] OWM current failed for ${city}: ${currentResp.status}`);
          return;
        }

        const currentData = await currentResp.json();
        const forecastData = await forecastResp.json();

        const currentTempF: number | null = currentData.main?.temp ?? null;
        const todayMaxF: number | null = currentData.main?.temp_max ?? null;
        const forecastList: any[] = forecastData.list ?? [];

        results[city] = processOwmData(currentTempF, todayMaxF, forecastList, coords.tz);
      } catch (err) {
        console.warn(`[weather] OWM fetch failed for ${city}:`, err);
      }
    }),
  );

  if (Object.keys(results).length === 0) {
    throw new Error("OWM returned no results for any city");
  }

  return results;
}

/* ── Strategy 2: fall back to the old Supabase edge function ────────── */

async function fetchAllViaEdgeFunction(
  cities: string[],
): Promise<Record<string, CityWeather>> {
  const response = await fetch(
    `${getSupabaseFunctionUrl("weather-data")}?cities=${encodeURIComponent(cities.join(","))}`,
    { headers: getSupabaseAuthHeaders() },
  );
  if (!response.ok) throw new Error(`Edge function ${response.status}`);
  return response.json();
}

/* ── Hook ───────────────────────────────────────────────────────────── */

export function useWeatherData(cities: string[]) {
  return useQuery<Record<string, CityWeather>>({
    queryKey: ["weather-data", cities.sort().join(",")],
    queryFn: async () => {
      if (cities.length === 0) return {};

      try {
        const data = await fetchAllOwmDirect(cities);
        return data;
      } catch (err) {
        console.warn("[weather] OWM direct failed, falling back to edge function:", err);
      }

      try {
        return await fetchAllViaEdgeFunction(cities);
      } catch {
        console.warn("[weather] Edge function also failed");
      }

      return {};
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: cities.length > 0,
    placeholderData: (prev) => prev,
  });
}
