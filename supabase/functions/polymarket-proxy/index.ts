import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, cache-control, pragma, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

const MAX_CLOB_TOKENS = 80;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === "POST") {
      const body = await req.json() as { tokenIds?: unknown };
      const raw = body?.tokenIds;
      if (!Array.isArray(raw) || raw.length === 0) {
        return new Response(JSON.stringify({ error: "Expected { tokenIds: string[] }" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const tokenIds = raw.slice(0, MAX_CLOB_TOKENS).map((t) => String(t)).filter(Boolean);
      if (tokenIds.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch(`${CLOB_API}/books`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(tokenIds.map((token_id) => ({ token_id }))),
      });

      if (!response.ok) {
        const text = await response.text();
        return new Response(JSON.stringify({ error: `CLOB error [${response.status}]: ${text}` }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint") || "events";
    const params = url.searchParams.get("params") || "";

    const apiUrl = `${GAMMA_API}/${endpoint}${params ? "?" + params : ""}`;

    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(JSON.stringify({ error: `Polymarket API error [${response.status}]: ${text}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
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
