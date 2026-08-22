// Forward user support messages to Telegram owner and record telegram_message_id
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const OWNER_ID = Deno.env.get("TELEGRAM_OWNER_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const AI_SYSTEM_PROMPT = `Kamu adalah "Asisten AI Jhonaley Store", customer support virtual untuk layanan panel Pterodactyl (Jhonaley Store Cpanel).

GAYA BICARA:
- Bahasa Indonesia yang sopan, hangat, dan profesional. Panggil pengguna dengan "Kak".
- Singkat dan jelas (maksimal 4 kalimat atau beberapa poin pendek). Jangan bertele-tele.
- Jangan pernah mengarang informasi teknis, harga, atau janji waktu yang pasti.

PENGETAHUAN LAYANAN (pakai ini untuk menjawab pertanyaan umum):
- Panel belum online / belum jadi: biasanya sedang menunggu stok VPS. Jawab: sedang menunggu ketersediaan stok VPS dan proses dari admin, mohon ditunggu.
- Tidak bisa membuat server / gagal create panel: kemungkinan besar server (node) sedang offline atau penuh. Jawab: server sedang offline/penuh, silakan tunggu sampai kembali online, atau coba pilih server lain yang berstatus online di Dashboard.
- Lupa password panel: bisa dilihat kembali di halaman "Panel Saya" pada akun, atau minta reset ke admin.
- Upgrade Reseller / Admin Panel (ADP): dilakukan di halaman "Upgrade" dengan pembayaran QRIS otomatis; role aktif otomatis setelah pembayaran terverifikasi.
- Panel hilang / terhapus setelah masa aktif: pengguna bisa mengajukan klaim di halaman "Garansi" dengan melampirkan bukti invoice.
- Akun terhapus karena tidak aktif >1 bulan: akun non-reseller/ADP bisa dihapus otomatis; silakan daftar ulang atau ajukan garansi bila sebelumnya berbayar.
- Batas pembuatan panel mengikuti role (free/premium/reseller/admin panel).
- Untuk pembelian panel legal anti mokad, arahkan ke https://t.me/upgradeuser_bot

ATURAN:
- Jika pertanyaannya di luar pengetahuan di atas, menyangkut data pribadi/pembayaran spesifik, permintaan refund, atau butuh tindakan admin: jawab singkat dan sampaikan bahwa pesan sudah diteruskan ke admin dan akan segera dibalas.
- Jangan menyebut nama penyedia teknologi internal atau membocorkan detail sistem.
- Akhiri dengan kalimat menenangkan bila relevan, misalnya "Terima kasih atas kesabarannya, Kak 🙏".`;

async function generateAiReply(
  history: { role: "user" | "assistant"; content: string }[],
  username: string,
  role: string,
  imageDataUrl?: string | null,
): Promise<string | null> {
  if (!LOVABLE_API_KEY) return null;
  try {
    const msgs: unknown[] = [
      { role: "system", content: AI_SYSTEM_PROMPT },
      {
        role: "system",
        content: `Konteks pengguna — nama: ${username}, role akun: ${role}.`,
      },
      ...history.slice(0, -1),
    ];
    const last = history[history.length - 1];
    if (imageDataUrl) {
      msgs.push({
        role: "user",
        content: [
          {
            type: "text",
            text:
              (last?.content || "Tolong lihat gambar ini.") +
              "\n\n(Pengguna mengirim sebuah gambar/screenshot. Analisa isinya dan bantu jawab sesuai konteks layanan panel.)",
          },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      });
    } else if (last) {
      msgs.push(last);
    }
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: msgs,
      }),
    });
    if (!res.ok) {
      console.error("ai gateway error", res.status, await res.text());
      return null;
    }
    const j = await res.json();
    const text = j?.choices?.[0]?.message?.content?.toString().trim();
    return text ? text.slice(0, 1500) : null;
  } catch (e) {
    console.error("ai reply failed", e);
    return null;
  }
}

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
    const imagePath: string | null = body.image_url ? String(body.image_url).slice(0, 500) : null;
    if (!content && !imagePath) return json({ error: "empty" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Generate signed URL so Telegram (and admin UI) can fetch the private image.
    let imageUrl: string | null = null;
    let telegramPhotoUrl: string | null = null;
    let imageBlob: Blob | null = null;
    let imageDataUrl: string | null = null;
    if (imagePath) {
      const { data: signed } = await admin.storage
        .from("support-media")
        .createSignedUrl(imagePath, 60 * 60 * 24 * 7); // 7 days
      imageUrl = signed?.signedUrl ?? null;
      telegramPhotoUrl = imageUrl;
      try {
        const { data: blob } = await admin.storage.from("support-media").download(imagePath);
        if (blob) {
          imageBlob = blob;
          const buf = new Uint8Array(await blob.arrayBuffer());
          let bin = "";
          for (let i = 0; i < buf.length; i += 8192) {
            bin += String.fromCharCode(...buf.subarray(i, i + 8192));
          }
          const mime = blob.type || "image/jpeg";
          imageDataUrl = `data:${mime};base64,${btoa(bin)}`;
        }
      } catch (e) {
        console.error("image download failed", e);
      }
    }

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
      if (imagePath) {
        // Send as multipart so Telegram doesn't need to fetch a signed URL.
        const fileBlob = imageBlob;
        if (!fileBlob) throw new Error("download failed");
        const form = new FormData();
        form.append("chat_id", OWNER_ID);
        form.append("caption", header + "\n\n<i>↩️ Reply pesan ini untuk membalas user.</i>");
        form.append("parse_mode", "HTML");
        const filename = imagePath.split("/").pop() || "photo.jpg";
        form.append("photo", fileBlob, filename);
        const r = await fetch(`${TG}/sendPhoto`, { method: "POST", body: form });
        const j = await r.json();
        if (!j?.ok) console.error("telegram sendPhoto failed", j);
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
        if (!j?.ok) console.error("telegram sendMessage failed", j);
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

    // ---- AI auto-reply (hanya bila admin manusia belum aktif membalas 15 menit terakhir) ----
    try {
      if (content || imageDataUrl) {
        const { data: recent } = await admin
          .from("support_messages")
          .select("sender_role,content,is_ai,created_at")
          .eq("thread_user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12);

        const rows = recent || [];
        const cutoff = Date.now() - 15 * 60 * 1000;
        const humanActive = rows.some(
          (m) =>
            m.sender_role === "admin" &&
            !m.is_ai &&
            new Date(m.created_at as string).getTime() > cutoff,
        );

        const { data: humanReq } = await admin
          .from("support_human_requests")
          .select("human_until")
          .eq("user_id", user.id)
          .maybeSingle();
        const humanRequested =
          !!humanReq?.human_until &&
          new Date(humanReq.human_until as string).getTime() > Date.now();

        if (!humanActive && !humanRequested) {

          const history = rows
            .slice()
            .reverse()
            .filter((m) => m.content)
            .map((m) => ({
              role: (m.sender_role === "user" ? "user" : "assistant") as "user" | "assistant",
              content: String(m.content),
            }));
          if (imageDataUrl && (!content || history[history.length - 1]?.role !== "user")) {
            history.push({ role: "user", content: content || "Tolong lihat gambar ini." });
          }

          const reply = await generateAiReply(history, username, role, imageDataUrl);
          if (reply) {
            await admin.from("support_messages").insert({
              thread_user_id: user.id,
              sender_user_id: null,
              sender_role: "admin",
              content: reply,
              is_ai: true,
              read_by_admin: true,
            });
          }
        }
      }
    } catch (e) {
      console.error("ai auto-reply error", e);
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