import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ResolutionResult {
  currentTempF: number | null;
  currentTempC: number | null;
  observedHighF: number | null;
  observedHighC: number | null;
  isObserved: boolean;
  source: string;
  error?: string;
  /** True when the daily high is from WU embedded JSON/heuristics, not a guaranteed official daily max. */
  highIsEstimate?: boolean;
}

function fToC(f: number): number {
  return (f - 32) * (5 / 9);
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function validTemp(v: number | null): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  if (v < -60 || v > 160) return null;
  return v;
}

/** Reject obvious scrape errors: "current" far above same-day high (e.g. misparsed HTML field). */
function reconcileCurrentVsHigh(currentF: number | null, highF: number | null): number | null {
  if (currentF === null) return null;
  if (highF === null) return currentF;
  if (currentF > highF + 20) return null;
  if (currentF > 115 && highF < 92) return null;
  return currentF;
}

function parseWuHistoryUrlDateYmd(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/date\/(\d{4})-(\d{1,2})-(\d{1,2})$/i);
    if (!m) return null;
    const y = m[1];
    const mo = String(parseInt(m[2], 10)).padStart(2, "0");
    const d = String(parseInt(m[3], 10)).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  } catch {
    return null;
  }
}

function parseWuDayYmdFromLocal(isoLocal: string): string | null {
  const m = isoLocal.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * WU embeds `v3/dateTime` blobs with `b.dateTime` in the station’s local zone. Edge `Intl` can disagree
 * with that calendar day, which made `findCalendarDayHighFromWuState` match the wrong index (wrong high).
 */
function extractEmbeddedPageDateYmd(root: unknown): string | null {
  let found: string | null = null;
  function visit(obj: unknown): void {
    if (found !== null) return;
    if (obj === null || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        visit(item);
        if (found !== null) return;
      }
      return;
    }
    const o = obj as Record<string, unknown>;
    const b = o.b;
    if (b && typeof b === "object" && !Array.isArray(b)) {
      const bo = b as Record<string, unknown>;
      const dt = bo.dateTime;
      if (
        typeof dt === "string" &&
        /^\d{4}-\d{2}-\d{2}T/.test(dt) &&
        (typeof bo.ianaTimeZone === "string" || typeof bo.timeZoneAbbreviation === "string")
      ) {
        const ymd = parseWuDayYmdFromLocal(dt);
        if (ymd !== null) found = ymd;
      }
    }
    for (const k of Object.keys(o)) {
      visit(o[k]);
      if (found !== null) return;
    }
  }
  visit(root);
  return found;
}

/** Calendar YYYY-MM-DD in an IANA zone (station-local “today” for live /weather/ pages). */
function getTodayYmdInTimezone(timeZone: string, date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    /* ignore */
  }
  return date.toISOString().split("T")[0];
}

/** Known ICAO → IANA (fallback when URL path alone is ambiguous). */
const ICAO_TIMEZONE: Record<string, string> = {
  KDFW: "America/Chicago",
  KATL: "America/New_York",
  KMIA: "America/New_York",
  KORD: "America/Chicago",
  KLGA: "America/New_York",
  KPHX: "America/Phoenix",
  KDEN: "America/Denver",
  KLAX: "America/Los_Angeles",
  KSFO: "America/Los_Angeles",
  KSEA: "America/Los_Angeles",
  KBOS: "America/New_York",
  KIAH: "America/Chicago",
  ZBAA: "Asia/Shanghai",
  ZSPD: "Asia/Shanghai",
  VHHH: "Asia/Hong_Kong",
  EGLL: "Europe/London",
  LFPG: "Europe/Paris",
  CYYZ: "America/Toronto",
  CYVR: "America/Vancouver",
  CYYC: "America/Edmonton",
  CYUL: "America/Toronto",
  CYOW: "America/Toronto",
};

function guessTimezoneFromWuPath(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const segs = u.pathname.toLowerCase().split("/").filter(Boolean);
    const i = segs.indexOf("weather");
    if (i < 0 || segs.length < i + 3) return null;
    const region = segs[i + 1];
    if (region === "us") {
      const state = segs[i + 2];
      const CENTRAL = new Set([
        "tx", "ok", "ks", "ne", "sd", "nd", "mn", "ia", "mo", "ar", "la", "wi", "il", "ms", "al",
      ]);
      const EASTERN = new Set([
        "ga", "fl", "sc", "nc", "va", "wv", "md", "de", "pa", "ny", "nj", "ct", "ri", "ma", "vt", "nh", "me",
        "oh", "mi", "ky", "tn", "in", "dc",
      ]);
      const MOUNTAIN = new Set(["mt", "wy", "co", "nm", "id"]);
      const PACIFIC = new Set(["ca", "wa", "or", "nv"]);
      if (CENTRAL.has(state)) return "America/Chicago";
      if (EASTERN.has(state)) return "America/New_York";
      if (state === "az") return "America/Phoenix";
      if (MOUNTAIN.has(state)) return "America/Denver";
      if (PACIFIC.has(state)) return "America/Los_Angeles";
      if (state === "ak") return "America/Anchorage";
      if (state === "hi") return "Pacific/Honolulu";
      return null;
    }
    if (region === "cn") return "Asia/Shanghai";
    if (region === "hk") return "Asia/Hong_Kong";
    if (region === "jp") return "Asia/Tokyo";
    if (region === "kr") return "Asia/Seoul";
    if (region === "gb") return "Europe/London";
    if (region === "fr") return "Europe/Paris";
    if (region === "de") return "Europe/Berlin";
    if (region === "ae") return "Asia/Dubai";
    if (region === "au") return "Australia/Sydney";
    if (region === "ca") return "America/Toronto";
    return null;
  } catch {
    return null;
  }
}

function timezoneForWuUrl(urlStr: string): string {
  const st = parseWuStationIdFromUrl(urlStr);
  if (st) {
    const u = st.toUpperCase();
    if (ICAO_TIMEZONE[u]) return ICAO_TIMEZONE[u];
  }
  const g = guessTimezoneFromWuPath(urlStr);
  if (g) return g;
  return "UTC";
}

function extractAppRootStateJson(html: string): unknown | null {
  const m = html.match(/<script id="app-root-state"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/** Last path segment before `date`, or last segment of `/weather/.../STATION`. */
function parseWuStationIdFromUrl(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const parts = u.pathname.split("/").filter(Boolean);
    const di = parts.indexOf("date");
    if (di > 0) return parts[di - 1] ?? null;
    const wi = parts.indexOf("weather");
    if (wi >= 0 && parts.length > wi + 1) return parts[parts.length - 1] ?? null;
    return null;
  } catch {
    return null;
  }
}

/**
 * Max of station `temperatureMax24Hour` / `temperatureMaxSince7Am` from Weather.com blobs
 * that belong to this ICAO/PWS id (matches sibling location or single-station API URL).
 */
function findStationObservationMaxF(root: unknown, stationId: string | null): number | null {
  if (!stationId) return null;
  const sid = stationId.toUpperCase();
  let best: number | null = null;

  function consider(o: Record<string, unknown>): void {
    const t24 = o.temperatureMax24Hour;
    const t7 = o.temperatureMaxSince7Am;
    const nums: number[] = [];
    if (typeof t24 === "number" && Number.isFinite(t24)) nums.push(t24);
    if (typeof t7 === "number" && Number.isFinite(t7)) nums.push(t7);
    if (nums.length === 0) return;
    const m = Math.max(...nums);
    if (m < -60 || m > 160) return;
    best = best === null ? m : Math.max(best, m);
  }

  function urlHasIcao(url: string | undefined): boolean {
    if (!url) return false;
    return new RegExp(`[?&]icaoCode=${sid}(&|$)`, "i").test(url);
  }

  function visit(obj: unknown, urlHint?: string): void {
    if (obj === null || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) visit(item, urlHint);
      return;
    }
    const o = obj as Record<string, unknown>;
    const u = o.u ?? o.url;
    const nextUrl = typeof u === "string" ? u : urlHint;

    const locPt = o["v3-location-point"] as Record<string, unknown> | undefined;
    const locFromPt = locPt?.location as Record<string, unknown> | undefined;
    const icaoSibling = locFromPt?.icaoCode;

    const v3 = o["v3-wx-observations-current"];
    if (v3 && typeof v3 === "object") {
      const vo = v3 as Record<string, unknown>;
      const loc = vo.location as Record<string, unknown> | undefined;
      const icao = loc?.icaoCode;
      if (typeof icao === "string" && icao.toUpperCase() === sid) {
        consider(vo);
      } else if (typeof icaoSibling === "string" && icaoSibling.toUpperCase() === sid) {
        consider(vo);
      } else if (urlHasIcao(nextUrl)) {
        consider(vo);
      }
    }

    if (urlHasIcao(nextUrl)) {
      if (o.b && typeof o.b === "object") consider(o.b as Record<string, unknown>);
      if (o.value && typeof o.value === "object") consider(o.value as Record<string, unknown>);
    }

    const loc = o.location as Record<string, unknown> | undefined;
    if (typeof loc?.icaoCode === "string" && (loc.icaoCode as string).toUpperCase() === sid) {
      consider(o);
    }

    for (const k of Object.keys(o)) visit(o[k], typeof u === "string" ? u : urlHint);
  }

  visit(root);
  return best;
}

function combineForecastAndObsHigh(
  calendarOrForecast: number | null,
  stationObs: number | null,
): { high: number | null } {
  if (calendarOrForecast !== null && stationObs !== null) {
    return { high: Math.min(calendarOrForecast, stationObs) };
  }
  if (calendarOrForecast !== null) return { high: calendarOrForecast };
  if (stationObs !== null) return { high: stationObs };
  return { high: null };
}

/**
 * Live `/weather/` scrape: `highF` comes from forecast JSON; `obsM` is station max since 7am / 24h.
 * - Pure `min` undercuts the headline when the station lags a few °F (e.g. Chicago 41 vs 40).
 * - Pure `max` overstates when the embedded forecast is a wrong daypart/slot but obs matches the page (e.g. Atlanta/Dallas).
 */
function mergeLiveForecastWithStationHigh(highF: number | null, obsM: number): number | null {
  const h = validTemp(highF);
  const o = validTemp(obsM);
  if (h === null) return o;
  if (o === null) return h;
  const gap = h - o;
  // Inflated JSON forecast vs credible station max-so-far (e.g. 84 vs 79).
  if (gap > 4 && o < h && o >= h * 0.84 - 0.5) {
    return o;
  }
  // Bad station blob can exceed a good calendar day high (e.g. Dallas 94 vs 79); don't raise above forecast.
  if (o > h + 4) {
    return h;
  }
  const merged = Math.max(h, o);
  return validTemp(merged);
}

/**
 * WU history/daily pages embed forecast-style arrays in `app-root-state` JSON.
 * Match `calendarDayTemperatureMax[i]` to `validTimeLocal[i]` for the requested calendar day.
 */
function findCalendarDayHighFromWuState(
  root: unknown,
  targetYmd: string,
  /** Live pages: use `min` when duplicate day rows disagree (Dallas 79 vs 94). History: keep `max`. */
  aggregate: "min" | "max" = "max",
): { highF: number | null; firstDayHigh: number | null; firstDayYmd: string | null } {
  let matched: number | null = null;
  let firstDayHigh: number | null = null;
  let firstDayYmd: string | null = null;

  function considerBlock(vtl: unknown, cmax: unknown): void {
    if (!Array.isArray(vtl) || !Array.isArray(cmax) || vtl.length !== cmax.length) return;
    if (vtl.length === 0) return;
    const d0 = parseWuDayYmdFromLocal(String(vtl[0]));
    const h0 = typeof cmax[0] === "number" ? cmax[0] as number : null;
    if (d0 !== null && h0 !== null && Number.isFinite(h0) && firstDayHigh === null) {
      firstDayHigh = h0;
      firstDayYmd = d0;
    }
    for (let i = 0; i < vtl.length; i++) {
      const day = parseWuDayYmdFromLocal(String(vtl[i]));
      if (day !== targetYmd) continue;
      const v = cmax[i];
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      matched = matched === null
        ? v
        : aggregate === "min"
        ? Math.min(matched, v)
        : Math.max(matched, v);
    }
  }

  function visit(obj: unknown): void {
    if (obj === null || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) visit(item);
      return;
    }
    const o = obj as Record<string, unknown>;
    considerBlock(o.validTimeLocal, o.calendarDayTemperatureMax);
    for (const k of Object.keys(o)) visit(o[k]);
  }

  visit(root);
  return { highF: matched, firstDayHigh, firstDayYmd };
}

/**
 * Live `/weather/`: WU embeds several `validTimeLocal`+`calendarDayTemperatureMax` blocks. The **longest**
 * strip is not always first in the tree; another strip can list the same calendar day with a much higher
 * value (e.g. 94 vs 79 for Dallas KDFW). Take **Math.min** of every `calendarDayTemperatureMax[i]`
 * whose `validTimeLocal[i]` matches `targetYmd` so we align with the conservative “today” high the UI shows.
 */
function extractPrimaryCalendarHighForDay(root: unknown, targetYmd: string): number | null {
  const candidates: number[] = [];

  function visit(obj: unknown): void {
    if (obj === null || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) visit(item);
      return;
    }
    const o = obj as Record<string, unknown>;
    const vtl = o.validTimeLocal;
    const cmax = o.calendarDayTemperatureMax;
    if (Array.isArray(vtl) && Array.isArray(cmax) && vtl.length === cmax.length && vtl.length > 0) {
      for (let i = 0; i < vtl.length; i++) {
        const day = parseWuDayYmdFromLocal(String(vtl[i]));
        if (day !== targetYmd) continue;
        const v = cmax[i];
        if (typeof v !== "number" || !Number.isFinite(v)) continue;
        const t = validTemp(v);
        if (t !== null) candidates.push(t);
      }
    }
    for (const k of Object.keys(o)) visit(o[k]);
  }

  visit(root);
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

async function scrapeWuHistoryDailyPage(url: string): Promise<ResolutionResult> {
  const empty: ResolutionResult = {
    currentTempF: null, currentTempC: null,
    observedHighF: null, observedHighC: null,
    isObserved: false, source: url,
  };

  const targetYmd = parseWuHistoryUrlDateYmd(url);
  if (!targetYmd) {
    return { ...empty, error: "Could not parse history date from URL" };
  }

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!resp.ok) {
      return { ...empty, error: `HTTP ${resp.status}` };
    }
    const html = await resp.text();

    // Do NOT bail on "No data recorded" in the Summary UI: WU still embeds
    // forecast JSON in app-root-state (and daypart text like "High 71F" for *other* days).
    const stationId = parseWuStationIdFromUrl(url);
    const root = extractAppRootStateJson(html);

    let calendarHigh: number | null = null;

    function applyCalendarFromState(state: unknown): void {
      const { highF: matched, firstDayHigh, firstDayYmd } = findCalendarDayHighFromWuState(state, targetYmd);
      if (matched !== null) {
        const v = validTemp(matched);
        if (v !== null) calendarHigh = calendarHigh === null ? v : Math.max(calendarHigh, v);
      } else if (
        firstDayHigh !== null && firstDayYmd !== null && firstDayYmd === targetYmd
      ) {
        const v = validTemp(firstDayHigh);
        if (v !== null) calendarHigh = calendarHigh === null ? v : Math.max(calendarHigh, v);
      }
    }

    if (root) applyCalendarFromState(root);

    let nextDataParsed: unknown = null;
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        nextDataParsed = JSON.parse(nextDataMatch[1]);
      } catch { /* ignore */ }
    }
    if (calendarHigh === null && nextDataParsed) applyCalendarFromState(nextDataParsed);

    let obsMax: number | null = null;
    if (root) obsMax = findStationObservationMaxF(root, stationId);
    if (nextDataParsed) {
      const o2 = findStationObservationMaxF(nextDataParsed, stationId);
      obsMax = obsMax === null ? o2 : o2 === null ? obsMax : Math.max(obsMax, o2);
    }

    const { high: combinedHigh } = combineForecastAndObsHigh(calendarHigh, obsMax);
    const highF = combinedHigh !== null ? validTemp(combinedHigh) : null;

    // No broad regex on full HTML: narratives list multiple "High XXF" days (e.g. tomorrow 71F)
    // and would override the correct calendarDayTemperatureMax for the URL date.

    return {
      currentTempF: null,
      currentTempC: null,
      observedHighF: highF !== null ? round3(highF) : null,
      observedHighC: highF !== null ? round3(fToC(highF)) : null,
      isObserved: highF !== null,
      source: url,
      highIsEstimate: highF !== null,
      error: highF === null ? "Could not read daily high from history page" : undefined,
    };
  } catch (e) {
    return {
      ...empty,
      error: e instanceof Error ? e.message : "History scrape failed",
    };
  }
}

async function scrapeWeatherUnderground(url: string): Promise<ResolutionResult> {
  const empty: ResolutionResult = {
    currentTempF: null, currentTempC: null,
    observedHighF: null, observedHighC: null,
    isObserved: false, source: url,
  };

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!resp.ok) {
      return { ...empty, error: `HTTP ${resp.status}` };
    }
    const html = await resp.text();

    const rs = extractAppRootStateJson(html);
    let nd: unknown = null;
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        nd = JSON.parse(nextDataMatch[1]);
      } catch { /* ignore */ }
    }

    // Same calendar-day logic as /history/daily/: `forecast.daily[0]` is often wrong (Dallas/Atlanta);
    // `validTimeLocal` + `calendarDayTemperatureMax` matches the “today” row users see on WU.
    // Prefer embedded `dateTime` YMD so we align with WU’s own clock (Edge Intl alone can pick the wrong day).
    const tz = timezoneForWuUrl(url);
    const targetYmd =
      extractEmbeddedPageDateYmd(rs) ??
      extractEmbeddedPageDateYmd(nd) ??
      getTodayYmdInTimezone(tz);
    let calendarHighLive: number | null = rs
      ? extractPrimaryCalendarHighForDay(rs, targetYmd)
      : null;
    if (calendarHighLive === null && nd) {
      calendarHighLive = extractPrimaryCalendarHighForDay(nd, targetYmd);
    }
    if (calendarHighLive === null) {
      const pick = (state: unknown) => {
        const { highF: matched, firstDayHigh, firstDayYmd } = findCalendarDayHighFromWuState(
          state,
          targetYmd,
          "min",
        );
        if (matched !== null) return validTemp(matched);
        if (firstDayHigh !== null && firstDayYmd !== null && firstDayYmd === targetYmd) {
          return validTemp(firstDayHigh);
        }
        return null;
      };
      if (rs) calendarHighLive = pick(rs);
      if (calendarHighLive === null && nd) calendarHighLive = pick(nd);
    }

    let currentF: number | null = null;
    let highF: number | null = null;

    // --- Try to extract from __NEXT_DATA__ JSON (WU uses Next.js) ---
    if (nd) {
      try {
        const dig = (obj: any, ...keys: string[]): any => {
          let cur = obj;
          for (const k of keys) {
            if (cur == null || typeof cur !== "object") return undefined;
            cur = cur[k];
          }
          return cur;
        };

        const pages = dig(nd, "props", "pageProps");
        if (pages) {
          // Current observation — prefer explicit imperial °F; avoid raw `temperature` (wrong field/order on some pages)
          const obs = pages.currentObservation ?? pages.observation ?? pages.cu ?? undefined;
          if (obs) {
            const imp = obs.imperial as Record<string, unknown> | undefined;
            const met = obs.metric as Record<string, unknown> | undefined;
            const tImp = typeof imp?.temp === "number" ? imp.temp : typeof imp?.temp === "string" ? parseFloat(String(imp.temp)) : NaN;
            const tMetC = typeof met?.temp === "number" ? met.temp : typeof met?.temp === "string" ? parseFloat(String(met.temp)) : NaN;
            if (Number.isFinite(tImp)) {
              currentF = validTemp(tImp);
            } else if (Number.isFinite(tMetC)) {
              currentF = validTemp(tMetC * (9 / 5) + 32);
            } else {
              currentF = validTemp(
                typeof obs.temp === "number"
                  ? obs.temp
                  : typeof obs.temperature === "number"
                    ? obs.temperature
                    : null,
              );
            }
          }
          // Forecast high (fallback when calendar arrays are missing)
          const fc = pages.forecast?.daily?.[0] ?? pages.forecast?.[0] ?? undefined;
          if (fc) {
            highF = validTemp(fc.temperatureMax ?? fc.high ?? fc.imperial?.temperatureMax ?? null);
          }
          // Almanac / history high
          const alm = pages.almanac ?? pages.history ?? undefined;
          if (alm) {
            highF = highF ?? validTemp(alm.temperatureMax ?? alm.high ?? null);
          }
        }
      } catch { /* JSON parse failed, continue with regex */ }
    }

    if (calendarHighLive !== null) {
      highF = calendarHighLive;
    }

    // --- Try JSON-LD structured data ---
    if (highF === null) {
      const jsonldMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonldMatch) {
        for (const block of jsonldMatch) {
          const inner = block.replace(/<\/?script[^>]*>/gi, "");
          try {
            const ld = JSON.parse(inner);
            const items = Array.isArray(ld) ? ld : [ld];
            for (const item of items) {
              if (item?.["@type"] === "WeatherForecast" || item?.mainEntity?.["@type"] === "WeatherForecast") {
                const target = item?.mainEntity ?? item;
                highF = highF ?? validTemp(target?.temperature?.maxValue ?? target?.highTemperature ?? null);
                currentF = currentF ?? validTemp(target?.temperature?.value ?? null);
              }
            }
          } catch { /* skip */ }
        }
      }
    }

    // --- Regex fallback: extract high temp ---
    // Pattern: "High 69 °F" or "High 69F" in forecast text
    if (highF === null) {
      const highMatch = html.match(/High\s+(\d{1,3})\s*°?\s*F/i);
      if (highMatch) highF = validTemp(parseFloat(highMatch[1]));
    }

    // Pattern: "Max Temperature" or "Maximum Temperature: XX"
    if (highF === null) {
      const maxMatch = html.match(/(?:max(?:imum)?\s*temp(?:erature)?)\s*[:=]?\s*(\d{1,3}(?:\.\d+)?)\s*°?\s*F/i);
      if (maxMatch) highF = validTemp(parseFloat(maxMatch[1]));
    }

    // Pattern: "XX° | YY°" (high | low on summary line)
    if (highF === null) {
      const summaryMatch = html.match(/(\d{1,3})\s*°\s*\|\s*(\d{1,3})\s*°/);
      if (summaryMatch) {
        const a = parseFloat(summaryMatch[1]);
        const b = parseFloat(summaryMatch[2]);
        highF = validTemp(Math.max(a, b));
      }
    }

    // --- Regex fallback: extract current temp ---
    // Pattern: standalone "69 °F" followed by "like" (feels-like indicator)
    if (currentF === null) {
      const currentMatch = html.match(/(\d{1,3})\s*°\s*F\s*[\s\S]{0,20}like/i);
      if (currentMatch) currentF = validTemp(parseFloat(currentMatch[1]));
    }

    // Pattern: large current temp display "XX °F" near station/report
    if (currentF === null) {
      const stationMatch = html.match(/Station\|Report[\s\S]{0,500}?(\d{1,3})\s*°?\s*F/i);
      if (stationMatch) currentF = validTemp(parseFloat(stationMatch[1]));
    }

    // Last resort: "Current" / observation context only (avoid first random °F on the page = wrong value)
    if (currentF === null) {
      const contextual = html.match(
        /(?:current|observed|now|temperature at)[\s\S]{0,80}?(\d{1,3})\s*°\s*F/i,
      );
      if (contextual) currentF = validTemp(parseFloat(contextual[1]));
    }

    currentF = reconcileCurrentVsHigh(currentF, highF);

    const hasObserved = /observed|observation|history|actual|recorded/i.test(html);

    let highIsEstimate = false;
    if (highF !== null) {
      highIsEstimate = true;
      const st = parseWuStationIdFromUrl(url);
      let obsM: number | null = rs ? findStationObservationMaxF(rs, st) : null;
      if (nd) {
        const o2 = findStationObservationMaxF(nd, st);
        obsM = obsM === null ? o2 : o2 === null ? obsM : Math.max(obsM, o2);
      }
      if (obsM !== null) {
        const merged = mergeLiveForecastWithStationHigh(highF, obsM);
        if (merged !== null) highF = merged;
      }
    }

    return {
      currentTempF: currentF !== null ? round3(currentF) : null,
      currentTempC: currentF !== null ? round3(fToC(currentF)) : null,
      observedHighF: highF !== null ? round3(highF) : null,
      observedHighC: highF !== null ? round3(fToC(highF)) : null,
      isObserved: (hasObserved || highF !== null) && highF !== null,
      source: url,
      highIsEstimate: highF !== null ? highIsEstimate : undefined,
    };
  } catch (e) {
    return {
      currentTempF: null, currentTempC: null,
      observedHighF: null, observedHighC: null,
      isObserved: false, source: url,
      error: e instanceof Error ? e.message : "Scrape failed",
    };
  }
}

async function scrapeGenericWeatherPage(url: string): Promise<ResolutionResult> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!resp.ok) {
      return {
        currentTempF: null, currentTempC: null,
        observedHighF: null, observedHighC: null,
        isObserved: false, source: url, error: `HTTP ${resp.status}`,
      };
    }
    const html = await resp.text();

    const hasObserved = /observed|observation|actual|recorded/i.test(html);

    let highF: number | null = null;
    const highMatch = html.match(/(?:high|max(?:imum)?)\s*(?:temp(?:erature)?)?\s*[:=]?\s*(\d{1,3}(?:\.\d+)?)\s*°?\s*F/i);
    if (highMatch) highF = validTemp(parseFloat(highMatch[1]));

    let currentF: number | null = null;
    const curMatch = html.match(
      /(?:current|now|observed)[\s\S]{0,120}?(\d{1,3})\s*°\s*F/i,
    );
    if (curMatch) currentF = validTemp(parseFloat(curMatch[1]));
    if (currentF === null) {
      const loose = html.match(/(\d{2,3})\s*°\s*F/);
      if (loose) currentF = validTemp(parseFloat(loose[1]));
    }

    currentF = reconcileCurrentVsHigh(currentF, highF);

    return {
      currentTempF: currentF !== null ? round3(currentF) : null,
      currentTempC: currentF !== null ? round3(fToC(currentF)) : null,
      observedHighF: highF !== null ? round3(highF) : null,
      observedHighC: highF !== null ? round3(fToC(highF)) : null,
      isObserved: hasObserved && highF !== null,
      source: url,
    };
  } catch (e) {
    return {
      currentTempF: null, currentTempC: null,
      observedHighF: null, observedHighC: null,
      isObserved: false, source: url,
      error: e instanceof Error ? e.message : "Scrape failed",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  /** Fast connectivity check from useResolutionData (no scrape). */
  if (req.method === "HEAD") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const resolutionUrl = url.searchParams.get("url");

    if (!resolutionUrl) {
      return new Response(JSON.stringify({ error: "Missing 'url' parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: ResolutionResult;

    if (resolutionUrl.includes("wunderground.com")) {
      if (/\/history\/daily\//i.test(resolutionUrl)) {
        result = await scrapeWuHistoryDailyPage(resolutionUrl);
      } else {
        result = await scrapeWeatherUnderground(resolutionUrl);
      }
    } else {
      result = await scrapeGenericWeatherPage(resolutionUrl);
    }

    return new Response(JSON.stringify(result), {
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
