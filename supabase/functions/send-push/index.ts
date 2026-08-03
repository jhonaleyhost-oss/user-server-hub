import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);

    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userData.user.id });
    if (!isAdmin) return json({ error: "admin_only" }, 403);

    const body = await req.json().catch(() => ({}));
    const title = String(body.title ?? "").trim();
    const message = String(body.body ?? "").trim();
    const url = body.url ? String(body.url).trim() : "/";
    const image = body.image ? String(body.image).trim() : undefined;

    if (!title || title.length > 120) return json({ error: "title wajib diisi (maks 120 karakter)" }, 400);
    if (!message || message.length > 500) return json({ error: "isi pesan wajib diisi (maks 500 karakter)" }, 400);

    const { data: subs, error: subErr } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (subErr) return json({ error: subErr.message }, 500);

    const payload = JSON.stringify({ title, body: message, url, image, tag: `bc-${Date.now()}` });

    let sent = 0;
    let failed = 0;
    const stale: string[] = [];

    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        failed++;
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) stale.push(s.id);
      }
    }

    if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);

    return json({ success: true, total: subs?.length ?? 0, sent, failed, removed: stale.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
