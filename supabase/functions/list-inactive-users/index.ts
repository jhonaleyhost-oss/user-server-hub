import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await callerClient.rpc("is_admin", { _user_id: caller.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let days = 30;
    try {
      const body = await req.json();
      if (body && typeof body.days === "number" && body.days > 0) days = Math.floor(body.days);
    } catch { /* no body */ }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch all auth users (paginated)
    const authUsers: any[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      authUsers.push(...data.users);
      if (data.users.length < 1000) break;
      page++;
      if (page > 50) break;
    }

    // Fetch profiles + roles
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, full_name, email, avatar_url, ip_address, device_fingerprint, created_at");
    const { data: roles } = await admin.from("user_roles").select("user_id, role");
    const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    // Panel counts
    const { data: panels } = await admin.from("user_panels").select("user_id, created_at, updated_at");
    const panelCount = new Map<string, number>();
    const panelLastActivity = new Map<string, number>();
    (panels || []).forEach((p: any) => {
      panelCount.set(p.user_id, (panelCount.get(p.user_id) || 0) + 1);
      const t = new Date(p.updated_at || p.created_at).getTime();
      if (!panelLastActivity.has(p.user_id) || t > (panelLastActivity.get(p.user_id) || 0)) {
        panelLastActivity.set(p.user_id, t);
      }
    });

    // Activity logs (last action per user)
    const activityLast = new Map<string, number>();
    const { data: acts } = await admin
      .from("user_activity_logs")
      .select("user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(50000);
    (acts || []).forEach((a: any) => {
      if (!activityLast.has(a.user_id)) {
        activityLast.set(a.user_id, new Date(a.created_at).getTime());
      }
    });

    // Recent paid orders (also a signal of activity)
    const orderLast = new Map<string, number>();
    const { data: ords } = await admin
      .from("reseller_orders")
      .select("user_id, paid_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20000);
    (ords || []).forEach((o: any) => {
      const t = new Date(o.paid_at || o.created_at).getTime();
      if (!orderLast.has(o.user_id) || t > (orderLast.get(o.user_id) || 0)) {
        orderLast.set(o.user_id, t);
      }
    });

    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
    const EXCLUDED = new Set(["admin", "reseller", "adp_server"]);

    const inactive = authUsers
      .map((u: any) => {
        const role = (roleMap.get(u.id) as string) || "free";
        const prof = profileMap.get(u.id) as any;
        const created = u.created_at ? new Date(u.created_at).getTime() : 0;
        const signIn = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
        const lastActivity = Math.max(
          signIn,
          created,
          activityLast.get(u.id) || 0,
          panelLastActivity.get(u.id) || 0,
          orderLast.get(u.id) || 0,
        );
        return {
          user_id: u.id,
          email: u.email || prof?.email || null,
          full_name: prof?.full_name || null,
          avatar_url: prof?.avatar_url || null,
          role,
          ip_address: prof?.ip_address || null,
          device_fingerprint: prof?.device_fingerprint || null,
          last_sign_in_at: u.last_sign_in_at || null,
          created_at: u.created_at,
          panel_count: panelCount.get(u.id) || 0,
          days_inactive: lastActivity ? Math.floor((Date.now() - lastActivity) / 86400000) : null,
          account_age_days: created ? Math.floor((Date.now() - created) / 86400000) : null,
          _lastActivity: lastActivity,
          _created: created,
        };
      })
      .filter((u) =>
        !EXCLUDED.has(u.role) &&
        u._created > 0 &&
        u._created < threshold && // account itself must be older than N days
        u._lastActivity < threshold // and no activity within N days
      )
      .sort((a, b) => a._lastActivity - b._lastActivity)
      .map(({ _lastActivity, _created, ...rest }) => rest);

    return new Response(JSON.stringify({ success: true, days, users: inactive, total: inactive.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});