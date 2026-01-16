import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ownerSecret = Deno.env.get("OWNER_SECRET");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get owner_secret from query params or body
    const url = new URL(req.url);
    let providedSecret = url.searchParams.get("owner_secret");

    if (!providedSecret && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      providedSecret = body.owner_secret;
    }

    // Validate owner secret
    if (!ownerSecret || providedSecret !== ownerSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings, error } = await supabase
      .from("bot_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return new Response(JSON.stringify({ settings }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // Prevent proxies from caching secrets
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Error getting bot settings:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
