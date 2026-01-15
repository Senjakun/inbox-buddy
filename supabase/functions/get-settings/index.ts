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
      const body = await req.json();
      providedSecret = body.owner_secret;
    }

    // Validate owner secret
    if (!ownerSecret || providedSecret !== ownerSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get settings (hide sensitive data partially)
    const { data: settings, error } = await supabase
      .from("bot_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    // Mask sensitive data
    const maskedSettings = settings ? {
      ...settings,
      telegram_bot_token: settings.telegram_bot_token ? "***" + settings.telegram_bot_token.slice(-6) : null,
      outlook_password: settings.outlook_password ? "********" : null,
    } : null;

    return new Response(
      JSON.stringify({ settings: maskedSettings }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error getting settings:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
