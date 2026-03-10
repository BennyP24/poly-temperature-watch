import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  dallas: { lat: 32.78, lon: -96.80, tz: "America/Chicago" },
  houston: { lat: 29.76, lon: -95.37, tz: "America/Chicago" },
  phoenix: { lat: 33.45, lon: -112.07, tz: "America/Phoenix" },
  denver: { lat: 39.74, lon: -104.98, tz: "America/Denver" },
  seattle: { lat: 47.61, lon: -122.33, tz: "America/Los_Angeles" },
  berlin: { lat: 52.52, lon: 13.41, tz: "Europe/Berlin" },
  rome: { lat: 41.90, lon: 12.50, tz: "Europe/Rome" },
  madrid: { lat: 40.42, lon: -3.70, tz: "Europe/Madrid" },
  amsterdam: { lat: 52.37, lon: 4.90, tz: "Europe/Amsterdam" },
  dubai: { lat: 25.20, lon: 55.27, tz: "Asia/Dubai" },
  singapore: { lat: 1.35, lon: 103.82, tz: "Asia/Singapore" },
  toronto: { lat: 43.65, lon: -79.38, tz: "America/Toronto" },
  vancouver: { lat: 49.28, lon: -123.12, tz: "America/Vancouver" },
  melbourne: { lat: -37.81, lon: 144.96, tz: "Australia/Melbourne" },
  seoul: { lat: 37.57, lon: 126.98, tz: "Asia/Seoul" },
  bangkok: { lat: 13.76, lon: 100.50, tz: "Asia/Bangkok" },
  "phnom penh": { lat: 11.56, lon: 104.92, tz: "Asia/Phnom_Penh" },
  "ho chi minh": { lat: 10.82, lon: 106.63, tz: "Asia/Ho_Chi_Minh" },
  "kuala lumpur": { lat: 3.14, lon: 101.69, tz: "Asia/Kuala_Lumpur" },
  manila: { lat: 14.60, lon: 120.98, tz: "Asia/Manila" },
  jakarta: { lat: -6.21, lon: 106.85, tz: "Asia/Jakarta" },
  delhi: { lat: 28.61, lon: 77.21, tz: "Asia/Kolkata" },
  mumbai: { lat: 19.08, lon: 72.88, tz: "Asia/Kolkata" },
  "hong kong": { lat: 22.32, lon: 114.17, tz: "Asia/Hong_Kong" },
  beijing: { lat: 39.90, lon: 116.40, tz: "Asia/Shanghai" },
  shanghai: { lat: 31.23, lon: 121.47, tz: "Asia/Shanghai" },
  "san francisco": { lat: 37.77, lon: -122.42, tz: "America/Los_Angeles" },
  boston: { lat: 42.36, lon: -71.06, tz: "America/New_York" },
  atlanta: { lat: 33.75, lon: -84.39, tz: "America/New_York" },
  washington: { lat: 38.91, lon: -77.04, tz: "America/New_York" },
  "las vegas": { lat: 36.17, lon: -115.14, tz: "America/Los_Angeles" },
  austin: { lat: 30.27, lon: -97.74, tz: "America/Chicago" },
  detroit: { lat: 42.33, lon: -83.05, tz: "America/Detroit" },
  portland: { lat: 45.52, lon: -122.68, tz: "America/Los_Angeles" },
  "salt lake city": { lat: 40.76, lon: -111.89, tz: "America/Denver" },
  anchorage: { lat: 61.22, lon: -149.90, tz: "America/Anchorage" },
  honolulu: { lat: 21.31, lon: -157.86, tz: "Pacific/Honolulu" },
  moscow: { lat: 55.76, lon: 37.62, tz: "Europe/Moscow" },
  istanbul: { lat: 41.01, lon: 28.98, tz: "Europe/Istanbul" },
  cairo: { lat: 30.04, lon: 31.24, tz: "Africa/Cairo" },
  "sao paulo": { lat: -23.55, lon: -46.63, tz: "America/Sao_Paulo" },
  "mexico city": { lat: 19.43, lon: -99.13, tz: "America/Mexico_City" },
  "buenos aires": { lat: -34.60, lon: -58.38, tz: "America/Argentina/Buenos_Aires" },
  zurich: { lat: 47.37, lon: 8.54, tz: "Europe/Zurich" },
  auckland: { lat: -36.85, lon: 174.76, tz: "Pacific/Auckland" },
  brisbane: { lat: -27.47, lon: 153.03, tz: "Australia/Brisbane" },
  perth: { lat: -31.95, lon: 115.86, tz: "Australia/Perth" },
  calgary: { lat: 51.05, lon: -114.07, tz: "America/Edmonton" },
  montreal: { lat: 45.50, lon: -73.57, tz: "America/Toronto" },
  ankara: { lat: 39.93, lon: 32.86, tz: "Europe/Istanbul" },
  lucknow: { lat: 26.85, lon: 80.95, tz: "Asia/Kolkata" },
  "tel aviv": { lat: 32.08, lon: 34.78, tz: "Asia/Jerusalem" },
  wellington: { lat: -41.29, lon: 174.78, tz: "Pacific/Auckland" },
  lima: { lat: -12.05, lon: -77.04, tz: "America/Lima" },
  bogota: { lat: 4.71, lon: -74.07, tz: "America/Bogota" },
  santiago: { lat: -33.45, lon: -70.67, tz: "America/Santiago" },
  johannesburg: { lat: -26.20, lon: 28.05, tz: "Africa/Johannesburg" },
};

const CITY_ALIASES: Record<string, string> = {
  nyc: "new york",
  "new york city": "new york",
  "washington dc": "washington",
  "washington d c": "washington",
  "washington d.c": "washington",
  "washington d.c.": "washington",
  "são paulo": "sao paulo",
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
  return (f - 32) * 5 / 9;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const cities = (url.searchParams.get("cities") || "").split(",").map(c => c.trim().toLowerCase()).filter(Boolean);

    if (cities.length === 0) {
      return new Response(JSON.stringify({ error: "No cities provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, any> = {};

    await Promise.all(cities.map(async (city) => {
      const normalizedCity = normalizeCityKey(city);
      const canonicalCity = CITY_ALIASES[normalizedCity] ?? normalizedCity;

      const directCoords = CITY_COORDS[canonicalCity];
      const fallbackKey = Object.keys(CITY_COORDS).find(
        (key) => canonicalCity.includes(key) || key.includes(canonicalCity)
      );
      const coords = directCoords ?? (fallbackKey ? CITY_COORDS[fallbackKey] : undefined);

      if (!coords) {
        results[city] = { error: "Unknown city" };
        return;
      }

      try {
        // Fetch from Open-Meteo (same data source as resolution websites like weather.com)
        const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m&hourly=temperature_2m&timezone=${encodeURIComponent(coords.tz)}&forecast_days=3&past_days=2&temperature_unit=fahrenheit`;
        const resp = await fetch(apiUrl);
        const data = await resp.json();

        const currentTempF = data.current?.temperature_2m ?? null;
        const hourlyTimes: string[] = data.hourly?.time || [];
        const hourlyTemps: number[] = data.hourly?.temperature_2m || [];

        const now = new Date();
        const localDateStr = now.toLocaleDateString("en-CA", { timeZone: coords.tz });
        const currentHour = parseInt(now.toLocaleTimeString("en-US", { timeZone: coords.tz, hour: "numeric", hour12: false }));

        // Build hourly data indexed by date
        const hourlyByDate: Record<string, { hour: number; tempF: number }[]> = {};
        for (let i = 0; i < hourlyTimes.length; i++) {
          const dateStr = hourlyTimes[i].split("T")[0];
          const hour = parseInt(hourlyTimes[i].split("T")[1].split(":")[0]);
          if (!hourlyByDate[dateStr]) hourlyByDate[dateStr] = [];
          hourlyByDate[dateStr].push({ hour, tempF: hourlyTemps[i] });
        }

        // For each date, compute high from recorded hours only (for today/past), or full day for future
        const dateData: Record<string, any> = {};
        for (const [dateStr, hours] of Object.entries(hourlyByDate)) {
          const isToday = dateStr === localDateStr;
          const isPast = dateStr < localDateStr;
          const isFuture = dateStr > localDateStr;

          let recordedHours = hours;
          if (isToday) {
            recordedHours = hours.filter(h => h.hour <= currentHour);
          }

          const highF = isPast || isToday
            ? (recordedHours.length > 0 ? Math.max(...recordedHours.map(h => h.tempF)) : null)
            : (hours.length > 0 ? Math.max(...hours.map(h => h.tempF)) : null);

          const peakEntry = hours.reduce((max, h) => h.tempF > max.tempF ? h : max, hours[0]);
          const peakHour = peakEntry?.hour ?? null;
          const pastPeak = isToday && peakHour !== null && currentHour > peakHour;

          // Build hourly array for frontend
          const hourlyArr = hours.map(h => ({
            hour: h.hour,
            tempF: Math.round(h.tempF * 1000) / 1000,
            tempC: Math.round(fToC(h.tempF) * 1000) / 1000,
            isRecorded: isPast || (isToday && h.hour <= currentHour),
          }));

          dateData[dateStr] = {
            highF: highF !== null ? Math.round(highF * 1000) / 1000 : null,
            highC: highF !== null ? Math.round(fToC(highF) * 1000) / 1000 : null,
            forecastHighF: hours.length > 0 ? Math.round(Math.max(...hours.map(h => h.tempF)) * 1000) / 1000 : null,
            forecastHighC: hours.length > 0 ? Math.round(fToC(Math.max(...hours.map(h => h.tempF))) * 1000) / 1000 : null,
            peakHour,
            pastPeak,
            isToday,
            isPast,
            isFuture,
            hourly: hourlyArr,
          };
        }

        const todayData = dateData[localDateStr];

        const round3 = (v: number | null) => v !== null ? Math.round(v * 1000) / 1000 : null;

        results[city] = {
          currentTempF: round3(currentTempF),
          currentTempC: round3(currentTempF !== null ? fToC(currentTempF) : null),
          highestRecordedF: todayData?.highF ?? null,
          highestRecordedC: todayData?.highC ?? null,
          forecastHighF: todayData?.forecastHighF ?? null,
          forecastHighC: todayData?.forecastHighC ?? null,
          peakHour: todayData?.peakHour ?? null,
          currentHour,
          pastPeak: todayData?.pastPeak ?? false,
          timezone: coords.tz,
          // Full date-indexed data for multi-day views
          dates: dateData,
        };
      } catch (e) {
        results[city] = { error: e instanceof Error ? e.message : "Failed to fetch weather" };
      }
    }));

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
