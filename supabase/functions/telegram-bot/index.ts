// Telegram Bot for Jhonaley Store Cpanel admin operations (command-only).
// Webhook endpoint: POST /functions/v1/telegram-bot
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const OWNER_ID = Deno.env.get("TELEGRAM_OWNER_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function tg(method: string, payload: Record<string, unknown>) {
  const r = await fetch(`${TG}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isOwner(id: number | string): boolean {
  return String(id) === String(OWNER_ID);
}

function send(chatId: number, text: string) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
}

const HELP_TEXT =
  "<b>🤖 Jhonaley Admin Bot — Commands</b>\n\n" +
  "<b>📋 Lihat Data</b>\n" +
  "/users [page]\n/resellers\n/servers\n/stats\n\n" +
  "<b>⭐ Reseller</b>\n" +
  "/addreseller <code>email,hari</code> (0=permanent)\n\n" +
  "<b>🖥️ Server</b>\n" +
  "/addserver <code>nama,domain,plta,pltc</code>\n" +
  "/setptla <code>serverId,plta</code>\n" +
  "/setptlc <code>serverId,pltc</code>\n" +
  "/seturl <code>serverId,url</code>\n\n" +
  "<b>💳 Pakasir</b>\n" +
  "/setpakasir <code>apikey,slug</code>\n\n" +
  "<b>👤 User</b>\n" +
  "/changepw <code>email,passwordbaru</code>\n" +
  "/deluser <code>email</code>\n" +
  "/delpanel <code>panelId</code>\n" +
  "/listpanel <code>serverId</code> — list panel di server\n" +
  "/delfreepanel — hapus SEMUA panel milik user role free (server Pterodactyl juga)\n" +
  "/delallusr — hapus SEMUA user kecuali admin\n" +
  "/resetdevices — reset semua IP/FP\n\n" +
  "<b>💬 Support</b>\nReply pesan support dari user untuk membalas (text/foto otomatis diteruskan).\n\n" +
  "/help — bantuan ini";

// ===== Feature handlers =====

async function listUsers(chatId: number, page: number) {
  const perPage = 5;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, count, error } = await admin
    .from("profiles")
    .select("user_id,email,full_name,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) return sendErr(chatId, error.message);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const ids = (data || []).map((u) => u.user_id);
  const { data: roles } = await admin.from("user_roles").select("user_id,role").in("user_id", ids);
  const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));
  let text = `👥 <b>Users</b> (Page ${page}/${totalPages} • Total: ${total})\n\n`;
  for (const u of data || []) {
    const role = roleMap.get(u.user_id) || "free";
    text += `• <b>${esc(u.full_name || "-")}</b>\n  ${esc(u.email)}\n  Role: <code>${role}</code>\n  <code>${u.user_id}</code>\n\n`;
  }
  if (!data?.length) text += "<i>Tidak ada user.</i>";
  if (page < totalPages) text += `\n<i>Halaman berikut: /users ${page + 1}</i>`;
  await send(chatId, text);
}

async function listResellers(chatId: number) {
  const { data: roles, error } = await admin
    .from("user_roles")
    .select("user_id")
    .in("role", ["reseller", "admin"]);
  if (error) return sendErr(chatId, error.message);
  const ids = (roles || []).map((r) => r.user_id);
  if (!ids.length) return send(chatId, "Belum ada reseller.");
  const { data: profs } = await admin
    .from("profiles")
    .select("user_id,email,full_name,reseller_expires_at,reseller_permanent")
    .in("user_id", ids);
  let text = `⭐ <b>Resellers</b> (${profs?.length || 0})\n\n`;
  for (const p of profs || []) {
    const exp = p.reseller_permanent
      ? "♾️ Permanent"
      : p.reseller_expires_at
      ? new Date(p.reseller_expires_at).toLocaleString("id-ID")
      : "-";
    text += `• <b>${esc(p.full_name || "-")}</b>\n  ${esc(p.email)}\n  Expires: ${esc(exp)}\n\n`;
  }
  await send(chatId, text);
}

async function listServers(chatId: number) {
  const { data, error } = await admin
    .from("pterodactyl_servers")
    .select("id,name,domain,server_type,is_active")
    .order("created_at", { ascending: false });
  if (error) return sendErr(chatId, error.message);
  let text = `🖥️ <b>Servers</b> (${data?.length || 0})\n\n`;
  for (const s of data || []) {
    const { data: keys } = await admin.rpc("get_server_keys", { _server_id: s.id });
    const plta = keys?.[0]?.plta_key || "-";
    const pltc = keys?.[0]?.pltc_key || "-";
    text += `• <b>${esc(s.name)}</b> ${s.is_active ? "🟢" : "🔴"}\n  ${esc(s.domain)}\n  Type: <code>${esc(s.server_type)}</code>\n  ID: <code>${s.id}</code>\n  PTLA: <code>${esc(plta)}</code>\n  PTLC: <code>${esc(pltc)}</code>\n\n`;
  }
  if (!data?.length) text += "<i>Belum ada server.</i>";
  await send(chatId, text);
}

async function showStats(chatId: number) {
  const [users, panels, resellers, servers] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("user_panels").select("*", { count: "exact", head: true }),
    admin.from("user_roles").select("*", { count: "exact", head: true }).in("role", ["reseller", "admin"]),
    admin.from("pterodactyl_servers").select("*", { count: "exact", head: true }),
  ]);
  const text =
    `📊 <b>Statistik</b>\n\n` +
    `👥 Users: <b>${users.count ?? 0}</b>\n` +
    `🖥️ Panels: <b>${panels.count ?? 0}</b>\n` +
    `⭐ Resellers: <b>${resellers.count ?? 0}</b>\n` +
    `🌐 Servers: <b>${servers.count ?? 0}</b>`;
  await send(chatId, text);
}

async function resetAllDevices(chatId: number) {
  const { error } = await admin
    .from("profiles")
    .update({ ip_address: null, device_fingerprint: null })
    .not("user_id", "is", null);
  if (error) return sendErr(chatId, error.message);
  await admin.from("blocked_devices").delete().not("id", "is", null);
  await send(chatId, "✅ Semua IP / Fingerprint telah direset.");
}

async function addReseller(chatId: number, email: string, days: number) {
  const { data: prof, error } = await admin
    .from("profiles")
    .select("user_id,email,full_name")
    .ilike("email", email)
    .maybeSingle();
  if (error || !prof) return sendErr(chatId, `User dengan email ${email} tidak ditemukan.`);
  const permanent = days <= 0;
  const expiresAt = permanent ? null : new Date(Date.now() + days * 86400000).toISOString();
  await admin
    .from("profiles")
    .update({ reseller_permanent: permanent, reseller_expires_at: expiresAt })
    .eq("user_id", prof.user_id);
  const { data: existing } = await admin
    .from("user_roles")
    .select("id,role")
    .eq("user_id", prof.user_id)
    .maybeSingle();
  if (existing) {
    if (existing.role !== "admin") {
      await admin.from("user_roles").update({ role: "reseller" }).eq("id", existing.id);
    }
  } else {
    await admin.from("user_roles").insert({ user_id: prof.user_id, role: "reseller" });
  }
  let plan = "manual"; let amount = 0;
  if (permanent) { plan = "perm"; amount = 15000; }
  else if (days === 30) { plan = "1bln"; amount = 5000; }
  else if (days === 60) { plan = "2bln"; amount = 10000; }
  else { plan = `${days}d`; amount = Math.round((days / 30) * 5000); }
  // Record as completed reseller order so it shows in Activity (Upgrade tab)
  const orderId = `BOT-${plan.toUpperCase()}-${prof.user_id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  await admin.from("reseller_orders").insert({
    user_id: prof.user_id,
    order_id: orderId,
    plan,
    amount,
    duration_days: permanent ? null : days,
    username: prof.email,
    status: "completed",
    paid_at: new Date().toISOString(),
    expires_at: expiresAt,
    permanent,
  });
  await send(chatId, `✅ <b>${esc(prof.email)}</b> sekarang reseller${permanent ? " (Permanent)" : ` selama ${days} hari`}.`);
}

async function addServer(chatId: number, name: string, domain: string, plta: string, pltc: string) {
  const { error } = await admin.from("pterodactyl_servers").insert({
    name,
    domain: domain.replace(/\/+$/, ""),
    plta_key: plta,
    pltc_key: pltc,
    server_type: "public",
    is_active: true,
  });
  if (error) return sendErr(chatId, error.message);
  await send(chatId, `✅ Server <b>${esc(name)}</b> ditambahkan.`);
}

async function updateServerField(chatId: number, serverId: string, patch: Record<string, string>, label: string) {
  const { error } = await admin
    .from("pterodactyl_servers")
    .update(patch)
    .eq("id", serverId);
  if (error) return sendErr(chatId, error.message);
  await send(chatId, `✅ ${label} untuk server <code>${esc(serverId)}</code> diperbarui.`);
}

async function changeUserPassword(chatId: number, email: string, newPw: string) {
  const { data: prof } = await admin
    .from("profiles")
    .select("user_id,email")
    .ilike("email", email)
    .maybeSingle();
  if (!prof) return sendErr(chatId, `User ${email} tidak ditemukan.`);
  const { error } = await admin.auth.admin.updateUserById(prof.user_id, { password: newPw });
  if (error) return sendErr(chatId, error.message);
  await send(chatId, `✅ Password <b>${esc(prof.email)}</b> berhasil diubah.`);
}

async function setPakasir(chatId: number, key: string, slug: string) {
  await admin.from("app_settings").upsert(
    [
      { key: "PAKASIR_API_KEY", value: key },
      { key: "PAKASIR_SLUG", value: slug },
    ],
    { onConflict: "key" },
  );
  await send(chatId, `✅ Pakasir API key & slug (<code>${esc(slug)}</code>) disimpan.`);
}

async function deletePanelById(chatId: number, panelId: string) {
  const { data: panel, error } = await admin
    .from("user_panels")
    .select("id,ptero_user_id,ptero_server_id,server_id,username")
    .eq("id", panelId)
    .maybeSingle();
  if (error || !panel) return sendErr(chatId, "Panel tidak ditemukan.");
  try {
    const { data: keys } = await admin.rpc("get_server_keys", { _server_id: panel.server_id });
    const plta = keys?.[0]?.plta_key;
    const { data: srv } = await admin
      .from("pterodactyl_servers")
      .select("domain")
      .eq("id", panel.server_id)
      .maybeSingle();
    if (plta && srv?.domain && panel.ptero_user_id) {
      const base = srv.domain.replace(/\/+$/, "");
      await fetch(`${base}/api/application/users/${panel.ptero_user_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${plta}`, Accept: "application/json" },
      });
    }
  } catch (_) { /* ignore */ }
  await admin.from("user_panels").delete().eq("id", panelId);
  await send(chatId, `✅ Panel <code>${esc(panel.username)}</code> dihapus.`);
}

async function deleteUserByEmail(chatId: number, email: string) {
  const { data: prof } = await admin
    .from("profiles")
    .select("user_id,email")
    .ilike("email", email)
    .maybeSingle();
  if (!prof) return sendErr(chatId, `User ${email} tidak ditemukan.`);
  if (prof.email === "jhonaleyhost@gmail.com") {
    return sendErr(chatId, "Tidak bisa hapus admin utama.");
  }
  await admin.from("user_panels").delete().eq("user_id", prof.user_id);
  await admin.from("user_roles").delete().eq("user_id", prof.user_id);
  await admin.from("profiles").delete().eq("user_id", prof.user_id);
  const { error } = await admin.auth.admin.deleteUser(prof.user_id);
  if (error) return sendErr(chatId, error.message);
  await send(chatId, `✅ User <b>${esc(email)}</b> dihapus.`);
}

async function deleteAllUsers(chatId: number) {
  // Get all admin user_ids to exclude
  const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  const adminIds = new Set((admins || []).map((a) => a.user_id));
  const { data: profs } = await admin
    .from("profiles")
    .select("user_id,email");
  const targets = (profs || []).filter(
    (p) => !adminIds.has(p.user_id) && p.email !== "jhonaleyhost@gmail.com",
  );
  await send(chatId, `⏳ Menghapus ${targets.length} user...`);
  let ok = 0, fail = 0;
  for (const t of targets) {
    try {
      await admin.from("user_panels").delete().eq("user_id", t.user_id);
      await admin.from("user_roles").delete().eq("user_id", t.user_id);
      await admin.from("profiles").delete().eq("user_id", t.user_id);
      const { error } = await admin.auth.admin.deleteUser(t.user_id);
      if (error) fail++; else ok++;
    } catch { fail++; }
  }
  await send(chatId, `✅ Selesai. Berhasil: <b>${ok}</b>, Gagal: <b>${fail}</b>.`);
}

async function deleteAllFreePanels(chatId: number) {
  // Get all user_ids with role 'free'
  const { data: freeRoles, error: rolesErr } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "free");
  if (rolesErr) return sendErr(chatId, rolesErr.message);
  const freeIds = (freeRoles || []).map((r) => r.user_id);
  if (!freeIds.length) return send(chatId, "Tidak ada user role <b>free</b>.");

  const { data: panels, error: panelsErr } = await admin
    .from("user_panels")
    .select("id,server_id,ptero_user_id,ptero_server_id,username")
    .in("user_id", freeIds);
  if (panelsErr) return sendErr(chatId, panelsErr.message);
  if (!panels?.length) return send(chatId, "Tidak ada panel milik user free.");

  await send(chatId, `⏳ Menghapus ${panels.length} panel free...`);

  // Cache server keys/domain per server_id
  const serverCache = new Map<string, { domain: string; plta: string | null }>();
  const getServer = async (sid: string) => {
    if (serverCache.has(sid)) return serverCache.get(sid)!;
    const { data: srv } = await admin
      .from("pterodactyl_servers")
      .select("domain")
      .eq("id", sid)
      .maybeSingle();
    const { data: keys } = await admin.rpc("get_server_keys", { _server_id: sid });
    const entry = { domain: srv?.domain || "", plta: keys?.[0]?.plta_key || null };
    serverCache.set(sid, entry);
    return entry;
  };

  let ok = 0, fail = 0;
  for (const p of panels) {
    try {
      const { domain, plta } = await getServer(p.server_id);
      if (plta && domain) {
        const base = domain.replace(/\/+$/, "");
        // Delete server first (force), then user
        if (p.ptero_server_id) {
          await fetch(`${base}/api/application/servers/${p.ptero_server_id}/force`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${plta}`, Accept: "application/json" },
          });
        }
        if (p.ptero_user_id) {
          await fetch(`${base}/api/application/users/${p.ptero_user_id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${plta}`, Accept: "application/json" },
          });
        }
      }
      const { error: delErr } = await admin.from("user_panels").delete().eq("id", p.id);
      if (delErr) fail++; else ok++;
    } catch { fail++; }
  }
  await send(chatId, `✅ Selesai. Panel free dihapus: <b>${ok}</b>, Gagal: <b>${fail}</b>.`);
}

async function listPanelsByServer(chatId: number, serverId: string) {
  const { data: srv } = await admin
    .from("pterodactyl_servers")
    .select("name,domain")
    .eq("id", serverId)
    .maybeSingle();
  if (!srv) return sendErr(chatId, "Server tidak ditemukan.");
  const { data, error } = await admin
    .from("user_panels")
    .select("id,username,email,ram,cpu,disk,created_at")
    .eq("server_id", serverId)
    .order("created_at", { ascending: false });
  if (error) return sendErr(chatId, error.message);
  let text = `🖥️ <b>${esc(srv.name)}</b>\n${esc(srv.domain)}\nPanels: <b>${data?.length || 0}</b>\n\n`;
  for (const p of data || []) {
    const ram = p.ram === 0 ? "∞" : p.ram;
    const cpu = p.cpu === 0 ? "∞" : p.cpu;
    const disk = p.disk === 0 ? "∞" : p.disk;
    text += `• <b>${esc(p.username)}</b>\n  ${esc(p.email)}\n  RAM/CPU/Disk: <code>${ram}/${cpu}/${disk}</code>\n  ID: <code>${p.id}</code>\n\n`;
  }
  if (!data?.length) text += "<i>Belum ada panel.</i>";
  await send(chatId, text);
}

async function sendErr(chatId: number, msg: string) {
  await tg("sendMessage", { chat_id: chatId, text: `❌ ${msg}` });
}

function splitArgs(text: string): string[] {
  // get part after the first space/newline, then split by comma
  const idx = text.search(/\s/);
  if (idx < 0) return [];
  return text.slice(idx + 1).split(",").map((s) => s.trim()).filter(Boolean);
}

// ===== Webhook entrypoint =====

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response("bad", { status: 400 });
  }

  try {
    const msg = update.message;
    if (!msg) return new Response("ok");
    const chatId = msg.chat.id;
    const fromId = msg.from.id;
    const text: string = (msg.text || "").trim();

    if (!isOwner(fromId)) {
      await send(chatId, "🚫 Akses ditolak. Bot ini hanya untuk owner.");
      return new Response("ok");
    }

    // === Support reply handling ===
    // If this message is a reply to a forwarded user support message, route it back to that user.
    if (msg.reply_to_message) {
      const repliedId = msg.reply_to_message.message_id;
      const { data: original } = await admin
        .from("support_messages")
        .select("thread_user_id")
        .eq("telegram_message_id", repliedId)
        .maybeSingle();
      if (original?.thread_user_id) {
        const caption: string = (msg.caption || "").trim();
        const replyText: string = text || caption;
        let imageUrl: string | null = null;

        // If photo attached, download and upload to storage
        if (Array.isArray(msg.photo) && msg.photo.length > 0) {
          try {
            const largest = msg.photo[msg.photo.length - 1];
            const fileRes = await tg("getFile", { file_id: largest.file_id });
            const filePath = fileRes?.result?.file_path;
            if (filePath) {
              const fileResp = await fetch(
                `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`,
              );
              const bytes = new Uint8Array(await fileResp.arrayBuffer());
              const ext = filePath.split(".").pop() || "jpg";
              const objectName = `${original.thread_user_id}/admin-${Date.now()}.${ext}`;
              const { error: upErr } = await admin.storage
                .from("support-media")
                .upload(objectName, bytes, {
                  contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
                  upsert: false,
                });
              if (!upErr) {
                // Bucket privat — simpan path mentah, signed URL dibuat di client
                imageUrl = objectName;
              }
            }
          } catch (e) {
            console.error("photo forward error", e);
          }
        }

        if (replyText || imageUrl) {
          await admin.from("support_messages").insert({
            thread_user_id: original.thread_user_id,
            sender_user_id: null,
            sender_role: "admin",
            content: replyText || null,
            image_url: imageUrl,
            read_by_admin: true,
          });
          await send(chatId, "✅ Balasan terkirim ke user.");
        } else {
          await send(chatId, "⚠️ Pesan kosong, tidak diteruskan.");
        }
        return new Response("ok");
      }
    }

    // Parse command + comma-separated args
    const cmdMatch = text.match(/^\/([a-zA-Z0-9_]+)(?:@\w+)?/);
    if (!cmdMatch) {
      await send(chatId, "Kirim /help untuk daftar perintah.");
      return new Response("ok");
    }
    const cmd = "/" + cmdMatch[1].toLowerCase();
    const args = splitArgs(text);
    const need = (n: number) => args.length >= n;

    switch (cmd) {
      case "/start":
      case "/menu":
      case "/help":
        await send(chatId, HELP_TEXT);
        break;
      case "/users": {
        const page = parseInt(args[0] || "1", 10) || 1;
        await listUsers(chatId, page);
        break;
      }
      case "/resellers":
        await listResellers(chatId);
        break;
      case "/servers":
        await listServers(chatId);
        break;
      case "/stats":
        await showStats(chatId);
        break;
      case "/addreseller":
        if (!need(2)) { await send(chatId, "Format: <code>/addreseller email,hari</code> (0=permanent)"); break; }
        await addReseller(chatId, args[0], parseInt(args[1], 10) || 0);
        break;
      case "/addserver":
        if (!need(4)) { await send(chatId, "Format: <code>/addserver nama,domain,plta,pltc</code>"); break; }
        await addServer(chatId, args[0], args[1], args[2], args[3]);
        break;
      case "/setptla":
        if (!need(2)) { await send(chatId, "Format: <code>/setptla serverId,plta</code>"); break; }
        await updateServerField(chatId, args[0], { plta_key: args[1] }, "PTLA");
        break;
      case "/setptlc":
        if (!need(2)) { await send(chatId, "Format: <code>/setptlc serverId,pltc</code>"); break; }
        await updateServerField(chatId, args[0], { pltc_key: args[1] }, "PTLC");
        break;
      case "/seturl":
        if (!need(2)) { await send(chatId, "Format: <code>/seturl serverId,url</code>"); break; }
        await updateServerField(chatId, args[0], { domain: args[1].replace(/\/+$/, "") }, "Domain");
        break;
      case "/setpakasir":
        if (!need(2)) { await send(chatId, "Format: <code>/setpakasir apikey,slug</code>"); break; }
        await setPakasir(chatId, args[0], args[1]);
        break;
      case "/changepw":
        if (!need(2)) { await send(chatId, "Format: <code>/changepw email,passwordbaru</code>"); break; }
        await changeUserPassword(chatId, args[0], args[1]);
        break;
      case "/deluser":
        if (!need(1)) { await send(chatId, "Format: <code>/deluser email</code>"); break; }
        await deleteUserByEmail(chatId, args[0]);
        break;
      case "/delpanel":
        if (!need(1)) { await send(chatId, "Format: <code>/delpanel panelId</code>"); break; }
        await deletePanelById(chatId, args[0]);
        break;
      case "/listpanel":
        if (!need(1)) { await send(chatId, "Format: <code>/listpanel serverId</code>"); break; }
        await listPanelsByServer(chatId, args[0]);
        break;
      case "/delallusr":
        await deleteAllUsers(chatId);
        break;
      case "/delfreepanel":
        await deleteAllFreePanels(chatId);
        break;
      case "/resetdevices":
        await resetAllDevices(chatId);
        break;
      default:
        await send(chatId, "Perintah tidak dikenali. Kirim /help.");
    }
  } catch (e) {
    console.error("bot error", e);
  }
  return new Response("ok");
});

function ok(_: unknown) { return; }