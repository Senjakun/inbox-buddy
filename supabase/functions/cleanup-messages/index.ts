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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get bot settings
    const { data: settings, error: settingsError } = await supabase
      .from("bot_settings")
      .select("telegram_bot_token")
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings?.telegram_bot_token) {
      return new Response(JSON.stringify({ error: "No bot token configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get messages older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: oldMessages, error: fetchError } = await supabase
      .from("sent_messages")
      .select("*")
      .lt("sent_at", sevenDaysAgo.toISOString());

    if (fetchError) {
      throw fetchError;
    }

    let deletedCount = 0;
    const failedDeletes: string[] = [];

    for (const msg of oldMessages || []) {
      try {
        // Delete message from Telegram
        const response = await fetch(
          `https://api.telegram.org/bot${settings.telegram_bot_token}/deleteMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: msg.chat_id,
              message_id: parseInt(msg.telegram_message_id),
            }),
          }
        );

        const result = await response.json();

        if (result.ok || result.description?.includes("message to delete not found")) {
          // Delete from database
          await supabase
            .from("sent_messages")
            .delete()
            .eq("id", msg.id);
          deletedCount++;
        } else {
          failedDeletes.push(msg.id);
        }
      } catch (error) {
        console.error(`Failed to delete message ${msg.id}:`, error);
        failedDeletes.push(msg.id);
      }
    }

    // Also cleanup old processed emails (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await supabase
      .from("processed_emails")
      .delete()
      .lt("processed_at", thirtyDaysAgo.toISOString());

    return new Response(
      JSON.stringify({
        success: true,
        deleted: deletedCount,
        failed: failedDeletes.length,
        total_checked: oldMessages?.length || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in cleanup:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
