import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SettingsRequest {
  owner_secret: string;
  telegram_bot_token?: string;
  telegram_owner_id?: string;
  outlook_email?: string;
  outlook_password?: string;
  polling_interval_minutes?: number;
  email_filter?: string;
  is_active?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ownerSecret = Deno.env.get("OWNER_SECRET");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SettingsRequest = await req.json();

    // Validate owner secret
    if (!ownerSecret || body.owner_secret !== ownerSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current settings
    const { data: currentSettings } = await supabase
      .from("bot_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (!currentSettings) {
      // Create new settings
      const { error } = await supabase.from("bot_settings").insert({
        telegram_bot_token: body.telegram_bot_token,
        telegram_owner_id: body.telegram_owner_id,
        outlook_email: body.outlook_email,
        outlook_password: body.outlook_password,
        polling_interval_minutes: body.polling_interval_minutes || 1,
        email_filter: body.email_filter || "OTP",
        is_active: body.is_active || false,
      });

      if (error) throw error;
    } else {
      // Update existing settings
      const updateData: Record<string, any> = {};
      
      if (body.telegram_bot_token !== undefined) updateData.telegram_bot_token = body.telegram_bot_token;
      if (body.telegram_owner_id !== undefined) updateData.telegram_owner_id = body.telegram_owner_id;
      if (body.outlook_email !== undefined) updateData.outlook_email = body.outlook_email;
      if (body.outlook_password !== undefined) updateData.outlook_password = body.outlook_password;
      if (body.polling_interval_minutes !== undefined) updateData.polling_interval_minutes = body.polling_interval_minutes;
      if (body.email_filter !== undefined) updateData.email_filter = body.email_filter;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      const { error } = await supabase
        .from("bot_settings")
        .update(updateData)
        .eq("id", currentSettings.id);

      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error updating settings:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
