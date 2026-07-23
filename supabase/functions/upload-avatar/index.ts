import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extensionFrom(fileName: string, contentType: string) {
  const fromName = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
  const allowed = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  if (allowed.has(fromName)) return fromName === "jpeg" ? "jpg" : fromName;

  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

function decodeBase64(input: string) {
  const clean = input.includes(",") ? input.split(",").pop() || "" : input;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "Konfigurasi backend belum lengkap" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sesi tidak ditemukan, silakan login ulang" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Sesi tidak valid, silakan login ulang" }, 401);

    const body = await req.json().catch(() => null) as null | {
      fileName?: string;
      contentType?: string;
      fileBase64?: string;
    };
    const fileName = String(body?.fileName || "avatar.jpg");
    const contentType = String(body?.contentType || "image/jpeg");
    const fileBase64 = String(body?.fileBase64 || "");

    if (!contentType.startsWith("image/")) return json({ error: "File harus berupa gambar" }, 400);
    if (!fileBase64) return json({ error: "File kosong" }, 400);

    const bytes = decodeBase64(fileBase64);
    if (bytes.byteLength > MAX_FILE_SIZE) return json({ error: "Maksimal 5 MB" }, 400);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const ext = extensionFrom(fileName, contentType);
    const path = `${userData.user.id}/avatar-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("avatars")
      .upload(path, bytes, { contentType, upsert: false });
    if (uploadError) return json({ error: uploadError.message }, 500);

    const { data: publicData } = admin.storage.from("avatars").getPublicUrl(path);
    const publicUrl = publicData.publicUrl;

    const { error: profileError } = await admin
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("user_id", userData.user.id);
    if (profileError) return json({ error: profileError.message }, 500);

    await admin.from("user_activity_logs").insert({
      user_id: userData.user.id,
      action: "update_avatar",
      detail: "Mengubah foto profil",
      new_value: publicUrl,
    });

    return json({ success: true, publicUrl, path });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Gagal upload foto" }, 500);
  }
});