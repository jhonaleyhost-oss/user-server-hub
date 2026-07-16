import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: isAdmin } = await callerClient.rpc("is_admin", { _user_id: caller.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, allow_reregister } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent admin from deleting themselves
    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Delete panels first
    await adminClient.from("user_panels").delete().eq("user_id", user_id);
    // Delete roles
    await adminClient.from("user_roles").delete().eq("user_id", user_id);

    // If admin wants to allow this device to register again, wipe the IP/FP
    // from the profile BEFORE deleting (so archive trigger has nothing to
    // archive) and delete any pre-existing blocked_devices rows that match.
    if (allow_reregister) {
      const { data: prof } = await adminClient
        .from("profiles")
        .select("ip_address, device_fingerprint")
        .eq("user_id", user_id)
        .maybeSingle();
      const ip = prof?.ip_address as string | null;
      const fp = prof?.device_fingerprint as string | null;

      await adminClient
        .from("profiles")
        .update({ ip_address: null, device_fingerprint: null })
        .eq("user_id", user_id);

      // Wipe any archived blocks for this user and any matching ip/fp
      await adminClient.from("blocked_devices").delete().eq("original_user_id", user_id);
      if (ip) await adminClient.from("blocked_devices").delete().eq("ip_address", ip);
      if (fp) await adminClient.from("blocked_devices").delete().eq("device_fingerprint", fp);
    }

    // Delete profile
    await adminClient.from("profiles").delete().eq("user_id", user_id);
    // Delete from auth.users (this is the key part!)
    const { error } = await adminClient.auth.admin.deleteUser(user_id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
