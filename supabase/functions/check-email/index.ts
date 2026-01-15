import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple IMAP client using raw TCP
async function connectIMAP(host: string, port: number, email: string, password: string) {
  const conn = await Deno.connectTls({ hostname: host, port });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  async function readResponse(): Promise<string> {
    const buffer = new Uint8Array(4096);
    const n = await conn.read(buffer);
    if (n === null) return "";
    return decoder.decode(buffer.subarray(0, n));
  }

  async function sendCommand(tag: string, command: string): Promise<string> {
    await conn.write(encoder.encode(`${tag} ${command}\r\n`));
    let response = "";
    let attempts = 0;
    while (!response.includes(`${tag} OK`) && !response.includes(`${tag} NO`) && !response.includes(`${tag} BAD`) && attempts < 10) {
      const chunk = await readResponse();
      response += chunk;
      attempts++;
    }
    return response;
  }

  // Read greeting
  await readResponse();

  // Login
  const loginResp = await sendCommand("A1", `LOGIN "${email}" "${password}"`);
  if (loginResp.includes("A1 NO") || loginResp.includes("A1 BAD")) {
    conn.close();
    throw new Error("Login failed: " + loginResp);
  }

  // Select INBOX
  await sendCommand("A2", "SELECT INBOX");

  // Search for unseen messages
  const searchResp = await sendCommand("A3", "SEARCH UNSEEN");
  const messageIds: number[] = [];
  const searchMatch = searchResp.match(/\* SEARCH (.+)/);
  if (searchMatch) {
    messageIds.push(...searchMatch[1].trim().split(" ").filter(Boolean).map(Number));
  }

  const messages: Array<{ uid: number; subject: string; from: string; body: string; messageId: string }> = [];

  for (const uid of messageIds.slice(0, 10)) { // Limit to 10 messages
    const fetchResp = await sendCommand("A4", `FETCH ${uid} (BODY[HEADER.FIELDS (FROM SUBJECT MESSAGE-ID)] BODY[TEXT])`);
    
    const subjectMatch = fetchResp.match(/Subject:\s*(.+?)(?:\r\n|\n)/i);
    const fromMatch = fetchResp.match(/From:\s*(.+?)(?:\r\n|\n)/i);
    const msgIdMatch = fetchResp.match(/Message-ID:\s*(.+?)(?:\r\n|\n)/i);
    
    // Get body text (simplified)
    let body = "";
    const bodyMatch = fetchResp.match(/\)\r\n([\s\S]*?)(?:\r\n\* |\r\nA4)/);
    if (bodyMatch) {
      body = bodyMatch[1].substring(0, 500).replace(/\r\n/g, "\n").trim();
    }

    messages.push({
      uid,
      subject: subjectMatch?.[1]?.trim() || "No Subject",
      from: fromMatch?.[1]?.trim() || "Unknown",
      body,
      messageId: msgIdMatch?.[1]?.trim() || `msg-${uid}`,
    });
  }

  // Mark messages as seen
  if (messageIds.length > 0) {
    await sendCommand("A5", `STORE ${messageIds.join(",")} +FLAGS (\\Seen)`);
  }

  // Logout
  await sendCommand("A6", "LOGOUT");
  conn.close();

  return messages;
}

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
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings) {
      return new Response(JSON.stringify({ error: "No settings found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!settings.is_active) {
      return new Response(JSON.stringify({ message: "Bot is not active" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!settings.telegram_bot_token || !settings.telegram_owner_id || !settings.outlook_email || !settings.outlook_password) {
      return new Response(JSON.stringify({ error: "Missing credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Connect to IMAP and get messages
    const messages = await connectIMAP(
      "imap-mail.outlook.com",
      993,
      settings.outlook_email,
      settings.outlook_password
    );

    let processedCount = 0;

    for (const message of messages) {
      // Check if already processed
      const { data: existing } = await supabase
        .from("processed_emails")
        .select("id")
        .eq("message_id", message.messageId)
        .maybeSingle();

      if (existing) continue;

      // Check email filter
      if (settings.email_filter && !message.subject.toLowerCase().includes(settings.email_filter.toLowerCase())) {
        continue;
      }

      // Send to Telegram
      const telegramMessage = `📧 *New Email*\n\n*From:* ${message.from.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}\n*Subject:* ${message.subject.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}\n\n${message.body.substring(0, 300).replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}`;
      
      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: settings.telegram_owner_id,
            text: telegramMessage,
            parse_mode: "MarkdownV2",
          }),
        }
      );

      const telegramResult = await telegramResponse.json();

      if (telegramResult.ok) {
        // Save sent message for auto-delete
        await supabase.from("sent_messages").insert({
          telegram_message_id: telegramResult.result.message_id.toString(),
          chat_id: settings.telegram_owner_id,
        });

        // Mark email as processed
        await supabase.from("processed_emails").insert({
          message_id: message.messageId,
          subject: message.subject,
          sender: message.from,
        });

        processedCount++;
      } else {
        console.error("Telegram error:", telegramResult);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: processedCount, total_found: messages.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error checking email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
