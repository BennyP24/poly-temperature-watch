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

    let currentF: number | null = null;
    let highF: number | null = null;

    // --- Try to extract from __NEXT_DATA__ JSON (WU uses Next.js) ---
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const nd = JSON.parse(nextDataMatch[1]);
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
          // Forecast high
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

    return {
      currentTempF: currentF !== null ? round3(currentF) : null,
      currentTempC: currentF !== null ? round3(fToC(currentF)) : null,
      observedHighF: highF !== null ? round3(highF) : null,
      observedHighC: highF !== null ? round3(fToC(highF)) : null,
      isObserved: (hasObserved || highF !== null) && highF !== null,
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
      result = await scrapeWeatherUnderground(resolutionUrl);
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
