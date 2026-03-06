import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// City coordinates for Open-Meteo
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
};

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
      const coords = CITY_COORDS[city];
      if (!coords) {
        results[city] = { error: "Unknown city" };
        return;
      }

      try {
        // Request Fahrenheit directly from API and include past_days=1 for yesterday data
        const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m&hourly=temperature_2m&timezone=${encodeURIComponent(coords.tz)}&forecast_days=2&past_days=1&temperature_unit=fahrenheit`;
        const resp = await fetch(apiUrl);
        const data = await resp.json();

        const currentTemp = data.current?.temperature_2m ?? null;
        const hourlyTimes: string[] = data.hourly?.time || [];
        const hourlyTemps: number[] = data.hourly?.temperature_2m || [];

        // Get today's and yesterday's date in the city's timezone
        const now = new Date();
        const todayStr = now.toLocaleDateString("en-CA", { timeZone: coords.tz });
        const yesterday = new Date(now.getTime() - 86400000);
        const yesterdayStr = yesterday.toLocaleDateString("en-CA", { timeZone: coords.tz });
        const currentHour = parseInt(now.toLocaleTimeString("en-US", { timeZone: coords.tz, hour: "numeric", hour12: false }));

        // Today's temps
        const todayTemps: { hour: number; temp: number }[] = [];
        // Yesterday's temps
        const yesterdayTemps: { hour: number; temp: number }[] = [];

        for (let i = 0; i < hourlyTimes.length; i++) {
          const dateStr = hourlyTimes[i].split("T")[0];
          const hour = parseInt(hourlyTimes[i].split("T")[1].split(":")[0]);
          if (dateStr === todayStr) {
            todayTemps.push({ hour, temp: hourlyTemps[i] });
          } else if (dateStr === yesterdayStr) {
            yesterdayTemps.push({ hour, temp: hourlyTemps[i] });
          }
        }

        // Highest recorded so far today (up to current hour)
        const recordedTemps = todayTemps.filter(t => t.hour <= currentHour);
        const highestRecorded = recordedTemps.length > 0 
          ? Math.max(...recordedTemps.map(t => t.temp)) 
          : null;

        // Forecast high for the full day
        const forecastHigh = todayTemps.length > 0 
          ? Math.max(...todayTemps.map(t => t.temp)) 
          : null;

        // Peak hour
        const peakHour = todayTemps.length > 0
          ? todayTemps.reduce((max, t) => t.temp > max.temp ? t : max, todayTemps[0]).hour
          : null;

        const pastPeak = peakHour !== null && currentHour > peakHour;

        // Yesterday's highest (full day, already complete)
        const yesterdayHigh = yesterdayTemps.length > 0
          ? Math.max(...yesterdayTemps.map(t => t.temp))
          : null;

        // Return with 3 decimal precision (°F)
        const round3 = (v: number | null) => v !== null ? Math.round(v * 1000) / 1000 : null;

        results[city] = {
          currentTemp: round3(currentTemp),
          highestRecorded: round3(highestRecorded),
          forecastHigh: round3(forecastHigh),
          yesterdayHigh: round3(yesterdayHigh),
          peakHour,
          currentHour,
          pastPeak,
          timezone: coords.tz,
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
