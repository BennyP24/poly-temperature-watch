import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ResolutionResult {
  observedHighF: number | null;
  observedHighC: number | null;
  isObserved: boolean;
  source: string;
  rawSnippet?: string;
  error?: string;
}

function fToC(f: number): number {
  return (f - 32) * (5 / 9);
}

async function scrapeWeatherUnderground(url: string): Promise<ResolutionResult> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!resp.ok) {
      return { observedHighF: null, observedHighC: null, isObserved: false, source: url, error: `HTTP ${resp.status}` };
    }
    const html = await resp.text();

    // Weather Underground embeds observation data in the page.
    // Look for "Observed" or "History" markers and temperature values.
    const hasObserved = /observed|observation|history/i.test(html);

    // Try to extract high temperature from common WU patterns
    // Pattern: "High: XX °F" or "Max Temperature" followed by a number
    let highF: number | null = null;

    const maxTempMatch = html.match(
      /(?:max(?:imum)?\s*temp(?:erature)?|high\s*(?:temp(?:erature)?)?)\s*[:=]?\s*([\d.]+)\s*°?\s*F/i
    );
    if (maxTempMatch) {
      highF = parseFloat(maxTempMatch[1]);
    }

    if (highF === null) {
      // Try JSON-LD or embedded JSON data
      const jsonMatch = html.match(/"maxTemperature"\s*:\s*{\s*"value"\s*:\s*([\d.]+)/);
      if (jsonMatch) highF = parseFloat(jsonMatch[1]);
    }

    if (highF === null) {
      // Try the observation table pattern
      const tableMatch = html.match(/High[\s\S]{0,200}?([\d]{2,3}(?:\.\d+)?)\s*°?\s*F/i);
      if (tableMatch) highF = parseFloat(tableMatch[1]);
    }

    // Extract a raw snippet around "observed" or "high" for debugging
    const snippetMatch = html.match(/.{0,100}(?:observed|high\s*temp).{0,100}/i);

    return {
      observedHighF: highF,
      observedHighC: highF !== null ? Math.round(fToC(highF) * 1000) / 1000 : null,
      isObserved: hasObserved && highF !== null,
      source: url,
      rawSnippet: snippetMatch?.[0]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200),
    };
  } catch (e) {
    return {
      observedHighF: null,
      observedHighC: null,
      isObserved: false,
      source: url,
      error: e instanceof Error ? e.message : "Scrape failed",
    };
  }
}

async function scrapeGenericWeatherPage(url: string): Promise<ResolutionResult> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!resp.ok) {
      return { observedHighF: null, observedHighC: null, isObserved: false, source: url, error: `HTTP ${resp.status}` };
    }
    const html = await resp.text();

    const hasObserved = /observed|observation|actual|recorded/i.test(html);

    let highF: number | null = null;
    const highMatch = html.match(/(?:high|max(?:imum)?)\s*(?:temp(?:erature)?)?\s*[:=]?\s*([\d]{2,3}(?:\.\d+)?)\s*°?\s*F/i);
    if (highMatch) highF = parseFloat(highMatch[1]);

    return {
      observedHighF: highF,
      observedHighC: highF !== null ? Math.round(fToC(highF) * 1000) / 1000 : null,
      isObserved: hasObserved && highF !== null,
      source: url,
    };
  } catch (e) {
    return {
      observedHighF: null,
      observedHighC: null,
      isObserved: false,
      source: url,
      error: e instanceof Error ? e.message : "Scrape failed",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
