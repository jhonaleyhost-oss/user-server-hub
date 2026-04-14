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
    console.log("Starting cleanup...");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log("Listing auth users...");
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;
    console.log(`Found ${users.length} auth users`);

    const { data: profiles } = await adminClient.from("profiles").select("user_id");
    const validIds = new Set((profiles || []).map((p: any) => p.user_id));
    console.log(`Found ${validIds.size} valid profiles`);

    const orphans = users.filter(u => !validIds.has(u.id));
    console.log(`Found ${orphans.length} orphans to delete`);
    
    const deleted: string[] = [];
    const errors: string[] = [];

    for (const orphan of orphans) {
      console.log(`Deleting orphan: ${orphan.email || orphan.id}`);
      await adminClient.from("user_panels").delete().eq("user_id", orphan.id);
      await adminClient.from("user_roles").delete().eq("user_id", orphan.id);
      
      const { error } = await adminClient.auth.admin.deleteUser(orphan.id);
      if (error) {
        errors.push(`${orphan.email}: ${error.message}`);
      } else {
        deleted.push(orphan.email || orphan.id);
      }
    }

    console.log("Cleanup complete!");
    return new Response(JSON.stringify({ 
      total_auth_users: users.length,
      valid_profiles: validIds.size,
      orphans_found: orphans.length,
      deleted,
      errors 
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
