import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
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

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // List all auth users
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;

    // Get valid user_ids from profiles
    const { data: profiles } = await adminClient.from("profiles").select("user_id");
    const validIds = new Set((profiles || []).map((p: any) => p.user_id));

    // Find orphans
    const orphans = users.filter(u => !validIds.has(u.id));
    const deleted: string[] = [];
    const errors: string[] = [];

    for (const orphan of orphans) {
      // Don't delete the admin caller
      if (orphan.id === caller.id) continue;
      
      // Clean up any remaining data
      await adminClient.from("user_panels").delete().eq("user_id", orphan.id);
      await adminClient.from("user_roles").delete().eq("user_id", orphan.id);
      
      const { error } = await adminClient.auth.admin.deleteUser(orphan.id);
      if (error) {
        errors.push(`${orphan.email}: ${error.message}`);
      } else {
        deleted.push(orphan.email || orphan.id);
      }
    }

    return new Response(JSON.stringify({ 
      total_auth_users: users.length,
      valid_profiles: validIds.size,
      orphans_found: orphans.length,
      deleted,
      errors 
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
