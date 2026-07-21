import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const SUPPORT_EMAIL = "danangvalentpratama@gmail.com";
const SITE_NAME = "jhonaleycpanel";
const SENDER_DOMAIN = "web.jhonaleystore.id";
const FROM_DOMAIN = "web.jhonaleystore.id";

const MAX_DAILY_PER_EMAIL = 3;
const MAX_HOURLY_PER_IP = 5;

const BodySchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100, "Nama maksimal 100 karakter"),
  email: z.string().trim().email("Email tidak valid").max(255, "Email terlalu panjang"),
  category: z.enum(["general", "technical", "billing", "partnership"], {
    message: "Pilih kategori yang sesuai",
  }),
  message: z.string().trim().min(10, "Pesan minimal 10 karakter").max(2000, "Pesan maksimal 2000 karakter"),
});

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, 400);
    }

    const { name, email, category, message } = parsed.data;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "";

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: ipHourCount } = await admin
      .from("contact_submissions")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ipAddress)
      .gte("created_at", oneHourAgo);

    if ((ipHourCount ?? 0) >= MAX_HOURLY_PER_IP) {
      return json({ error: "Terlalu banyak pengiriman. Silakan coba lagi nanti." }, 429);
    }

    const { count: emailDayCount } = await admin
      .from("contact_submissions")
      .select("*", { count: "exact", head: true })
      .eq("email", email.toLowerCase())
      .gte("created_at", oneDayAgo);

    if ((emailDayCount ?? 0) >= MAX_DAILY_PER_EMAIL) {
      return json({ error: "Terlalu banyak pengiriman dari email ini. Silakan coba lagi besok." }, 429);
    }

    const { data: inserted, error: insertError } = await admin
      .from("contact_submissions")
      .insert({
        name,
        email: email.toLowerCase(),
        category,
        message,
        ip_address: ipAddress,
        user_agent: userAgent,
        forwarded_to_email: SUPPORT_EMAIL,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("contact insert error", insertError);
      return json({ error: "Gagal menyimpan pesan" }, 500);
    }

    const categoryLabels: Record<string, string> = {
      general: "Pertanyaan Umum",
      technical: "Kendala Teknis",
      billing: "Pembayaran / Upgrade",
      partnership: "Kerja Sama / Partnership",
    };

    const messageId = crypto.randomUUID();
    const subject = `[Jhonaley Store] Pesan ${categoryLabels[category]} dari ${name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>Pesan Kontak Baru</h2>
        <p><strong>Nama:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Kategori:</strong> ${escapeHtml(categoryLabels[category])}</p>
        <p><strong>Pesan:</strong></p>
        <div style="border-left: 4px solid #3b82f6; padding-left: 12px; margin: 12px 0;">
          ${escapeHtml(message).replace(/\n/g, "<br>")}
        </div>
        <hr>
        <p style="font-size: 12px; color: #666;">Dikirim dari landing page Jhonaley Store · IP: ${escapeHtml(ipAddress)}</p>
      </div>
    `;
    const text = `Pesan Kontak Baru\n\nNama: ${name}\nEmail: ${email}\nKategori: ${categoryLabels[category]}\nPesan:\n${message}\n\nDikirim dari landing page Jhonaley Store · IP: ${ipAddress}`;

    await admin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "contact_support",
      recipient_email: SUPPORT_EMAIL,
      status: "pending",
    });

    const { error: enqueueError } = await admin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: SUPPORT_EMAIL,
        reply_to: email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: "contact_support",
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("enqueue error", enqueueError);
      await admin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "contact_support",
        recipient_email: SUPPORT_EMAIL,
        status: "failed",
        error_message: "Failed to enqueue email",
      });
      return json({ error: "Gagal mengirim pesan" }, 500);
    }

    return json({ success: true, id: inserted.id });
  } catch (e) {
    console.error("contact-support error", e);
    return json({ error: "Terjadi kesalahan server" }, 500);
  }
});
