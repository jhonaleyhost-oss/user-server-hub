// Forward user support messages to Telegram owner and record telegram_message_id
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const OWNER_ID = Deno.env.get("TELEGRAM_OWNER_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    const body = await req.json();
    const content: string = (body.content || "").toString().trim().slice(0, 2000);
    const imageUrl: string | null = body.image_url ? String(body.image_url).slice(0, 500) : null;
    if (!content && !imageUrl) return json({ error: "empty" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get profile + role
    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      admin.from("profiles").select("full_name,email").eq("user_id", user.id).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    ]);
    const role = roleRow?.role || "free";
    const username = profile?.full_name || user.email?.split("@")[0] || "User";

    // Insert message
    const { data: inserted, error: insErr } = await admin
      .from("support_messages")
      .insert({
        thread_user_id: user.id,
        sender_user_id: user.id,
        sender_role: "user",
        content: content || null,
        image_url: imageUrl,
      })
      .select("id")
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    // Forward to Telegram owner
    const header =
      `📩 <b>Pesan Support Baru</b>\n` +
      `👤 <b>${esc(username)}</b>\n` +
      `📧 ${esc(profile?.email || user.email)}\n` +
      `🎖️ Role: <code>${esc(role)}</code>\n` +
      `🆔 <code>${user.id}</code>\n` +
      (content ? `\n💬 ${esc(content)}` : "");

    let tgMessageId: number | null = null;
    try {
      if (imageUrl) {
        const r = await fetch(`${TG}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: OWNER_ID,
            photo: imageUrl,
            caption: header,
            parse_mode: "HTML",
          }),
        });
        const j = await r.json();
        tgMessageId = j?.result?.message_id ?? null;
      } else {
        const r = await fetch(`${TG}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: OWNER_ID,
            text: header + "\n\n<i>↩️ Reply pesan ini untuk membalas user.</i>",
            parse_mode: "HTML",
          }),
        });
        const j = await r.json();
        tgMessageId = j?.result?.message_id ?? null;
      }
    } catch (e) {
      console.error("telegram error", e);
    }

    if (tgMessageId) {
      await admin
        .from("support_messages")
        .update({ telegram_message_id: tgMessageId })
        .eq("id", inserted.id);
    }

    return json({ success: true, id: inserted.id });
  } catch (e) {
    console.error("support-send", e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});