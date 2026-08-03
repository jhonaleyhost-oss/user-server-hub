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
    const triggerSecret = Deno.env.get("PUSH_TRIGGER_SECRET");
    const providedSecret = req.headers.get("x-push-secret") ?? "";
    const viaTrigger = !!triggerSecret && providedSecret === triggerSecret;
    if (!authHeader && !viaTrigger) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = !!token && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let isAdmin = false;
    if (viaTrigger || isServiceRole) {
      isAdmin = true;
    } else {
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);
      const { data: adminFlag } = await admin.rpc("is_admin", { _user_id: userData.user.id });
      isAdmin = !!adminFlag;
    }

    const body = await req.json().catch(() => ({}));
    const title = String(body.title ?? "").trim();
    const message = String(body.body ?? "").trim();
    const url = body.url ? String(body.url).trim() : "/";
    const image = body.image ? String(body.image).trim() : undefined;
    const target_user_id = body.target_user_id ? String(body.target_user_id).trim() : undefined;
    const exclude_user_id = body.exclude_user_id ? String(body.exclude_user_id).trim() : undefined;
    const role = body.role ? String(body.role).trim() : undefined;
    const broadcast = !(target_user_id || exclude_user_id || role);

    if (broadcast && !isAdmin) return json({ error: "admin_only" }, 403);
    if (target_user_id && !isAdmin) return json({ error: "target_user_id requires admin" }, 403);
    if (role && role !== "admin" && !isAdmin) return json({ error: "role selain admin memerlukan admin" }, 403);

    if (!title || title.length > 120) return json({ error: "title wajib diisi (maks 120 karakter)" }, 400);
    if (!message || message.length > 500) return json({ error: "isi pesan wajib diisi (maks 500 karakter)" }, 400);

    let subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }> = [];

    if (target_user_id) {
      const { data, error } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", target_user_id);
      if (error) return json({ error: error.message }, 500);
      subs = data ?? [];
    } else if (role) {
      const { data: userIds, error: roleErr } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", role);
      if (roleErr) return json({ error: roleErr.message }, 500);
      const ids = (userIds ?? []).map((u) => u.user_id).filter(Boolean);
      if (ids.length) {
        const { data, error } = await admin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .in("user_id", ids);
        if (error) return json({ error: error.message }, 500);
        subs = data ?? [];
      }
    } else {
      let q = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth");
      if (exclude_user_id) q = q.neq("user_id", exclude_user_id);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      subs = data ?? [];
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url,
      image,
      tag: body.tag ? String(body.tag).trim() : `bc-${Date.now()}`,
    });

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
