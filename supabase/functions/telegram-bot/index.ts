// Telegram Bot for Jhonaley Store Cpanel admin operations.
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

// Simple per-chat state for multi-step wizards
type State = { action: string; step: number; data: Record<string, string> };
const states = new Map<number, State>();

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

function mainMenu() {
  return {
    inline_keyboard: [
      [
        { text: "👥 Users", callback_data: "users:1" },
        { text: "⭐ Resellers", callback_data: "resellers" },
      ],
      [
        { text: "🖥️ Servers", callback_data: "servers" },
        { text: "📊 Stats", callback_data: "stats" },
      ],
      [
        { text: "➕ Add Reseller", callback_data: "wiz:addreseller" },
        { text: "➕ Add Server", callback_data: "wiz:addserver" },
      ],
      [
        { text: "🔑 Set Server Key", callback_data: "wiz:setkey" },
        { text: "💳 Set Pakasir Key", callback_data: "wiz:setpakasir" },
      ],
      [
        { text: "🅰️ Set PTLA", callback_data: "wiz:setptla" },
        { text: "🅲 Set PTLC", callback_data: "wiz:setptlc" },
      ],
      [
        { text: "🌐 Set URL", callback_data: "wiz:seturl" },
        { text: "🔐 Change Password", callback_data: "wiz:changepw" },
      ],
      [
        { text: "🗑️ Delete Panel", callback_data: "wiz:delpanel" },
        { text: "🗑️ Delete User", callback_data: "wiz:deluser" },
      ],
      [
        { text: "♻️ Reset All IP/FP", callback_data: "confirm:resetdevices" },
        { text: "❓ Help", callback_data: "help" },
      ],
    ],
  };
}

function isOwner(id: number | string): boolean {
  return String(id) === String(OWNER_ID);
}

async function sendMenu(chatId: number, text = "🤖 <b>Jhonaley Admin Bot</b>\nPilih aksi di bawah:") {
  await tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: mainMenu(),
  });
}

// ===== Feature handlers =====

async function listUsers(chatId: number, page: number, msgId?: number) {
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

  // Get roles in batch
  const ids = (data || []).map((u) => u.user_id);
  const { data: roles } = await admin.from("user_roles").select("user_id,role").in("user_id", ids);
  const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));

  let text = `👥 <b>Users</b> (Page ${page}/${totalPages} • Total: ${total})\n\n`;
  for (const u of data || []) {
    const role = roleMap.get(u.user_id) || "free";
    text += `• <b>${esc(u.full_name || "-")}</b>\n  ${esc(u.email)}\n  Role: <code>${role}</code>\n  <code>${u.user_id}</code>\n\n`;
  }
  if (!data?.length) text += "<i>Tidak ada user.</i>";

  const nav: Array<{ text: string; callback_data: string }> = [];
  if (page > 1) nav.push({ text: "⬅️ Prev", callback_data: `users:${page - 1}` });
  if (page < totalPages) nav.push({ text: "Next ➡️", callback_data: `users:${page + 1}` });

  const kb = { inline_keyboard: [nav, [{ text: "🏠 Menu", callback_data: "menu" }]] };
  const payload = { chat_id: chatId, text, parse_mode: "HTML", reply_markup: kb };
  if (msgId) await tg("editMessageText", { ...payload, message_id: msgId });
  else await tg("sendMessage", payload);
}

async function listResellers(chatId: number, msgId?: number) {
  const { data: roles, error } = await admin
    .from("user_roles")
    .select("user_id")
    .in("role", ["reseller", "admin"]);
  if (error) return sendErr(chatId, error.message);
  const ids = (roles || []).map((r) => r.user_id);
  if (!ids.length) {
    return tg("sendMessage", { chat_id: chatId, text: "Belum ada reseller." });
  }
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
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]] },
  };
  if (msgId) await tg("editMessageText", { ...payload, message_id: msgId });
  else await tg("sendMessage", payload);
}

async function listServers(chatId: number, msgId?: number) {
  const { data, error } = await admin
    .from("pterodactyl_servers")
    .select("id,name,domain,server_type,is_active")
    .order("created_at", { ascending: false });
  if (error) return sendErr(chatId, error.message);
  let text = `🖥️ <b>Servers</b> (${data?.length || 0})\n\n`;
  for (const s of data || []) {
    text += `• <b>${esc(s.name)}</b> ${s.is_active ? "🟢" : "🔴"}\n  ${esc(s.domain)}\n  Type: <code>${esc(s.server_type)}</code>\n  ID: <code>${s.id}</code>\n\n`;
  }
  if (!data?.length) text += "<i>Belum ada server.</i>";
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]] },
  };
  if (msgId) await tg("editMessageText", { ...payload, message_id: msgId });
  else await tg("sendMessage", payload);
}

async function showStats(chatId: number, msgId?: number) {
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
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]] },
  };
  if (msgId) await tg("editMessageText", { ...payload, message_id: msgId });
  else await tg("sendMessage", payload);
}

async function resetAllDevices(chatId: number) {
  const { error } = await admin
    .from("profiles")
    .update({ ip_address: null, device_fingerprint: null })
    .not("user_id", "is", null);
  if (error) return sendErr(chatId, error.message);
  // also clear blocked_devices archive
  await admin.from("blocked_devices").delete().not("id", "is", null);
  await tg("sendMessage", {
    chat_id: chatId,
    text: "✅ Semua IP / Fingerprint telah direset.",
    reply_markup: mainMenu(),
  });
}

async function addReseller(chatId: number, email: string, days: number) {
  const { data: prof, error } = await admin
    .from("profiles")
    .select("user_id,email")
    .ilike("email", email)
    .maybeSingle();
  if (error || !prof) return sendErr(chatId, `User dengan email ${email} tidak ditemukan.`);

  const permanent = days <= 0;
  const expiresAt = permanent ? null : new Date(Date.now() + days * 86400000).toISOString();

  await admin
    .from("profiles")
    .update({ reseller_permanent: permanent, reseller_expires_at: expiresAt })
    .eq("user_id", prof.user_id);

  // Update role (single role)
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

  await tg("sendMessage", {
    chat_id: chatId,
    text: `✅ <b>${esc(prof.email)}</b> sekarang reseller${permanent ? " (Permanent)" : ` selama ${days} hari`}.`,
    parse_mode: "HTML",
    reply_markup: mainMenu(),
  });
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
  await tg("sendMessage", {
    chat_id: chatId,
    text: `✅ Server <b>${esc(name)}</b> ditambahkan.`,
    parse_mode: "HTML",
    reply_markup: mainMenu(),
  });
}

async function setServerKey(chatId: number, serverId: string, plta: string, pltc: string) {
  const { error } = await admin
    .from("pterodactyl_servers")
    .update({ plta_key: plta, pltc_key: pltc })
    .eq("id", serverId);
  if (error) return sendErr(chatId, error.message);
  await tg("sendMessage", {
    chat_id: chatId,
    text: `✅ API key untuk server <code>${esc(serverId)}</code> diperbarui.`,
    parse_mode: "HTML",
    reply_markup: mainMenu(),
  });
}

async function updateServerField(chatId: number, serverId: string, patch: Record<string, string>, label: string) {
  const { error } = await admin
    .from("pterodactyl_servers")
    .update(patch)
    .eq("id", serverId);
  if (error) return sendErr(chatId, error.message);
  await tg("sendMessage", {
    chat_id: chatId,
    text: `✅ ${label} untuk server <code>${esc(serverId)}</code> diperbarui.`,
    parse_mode: "HTML",
    reply_markup: mainMenu(),
  });
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
  await tg("sendMessage", {
    chat_id: chatId,
    text: `✅ Password <b>${esc(prof.email)}</b> berhasil diubah.`,
    parse_mode: "HTML",
    reply_markup: mainMenu(),
  });
}

async function setPakasirKey(chatId: number, key: string) {
  await admin.from("app_settings").upsert(
    { key: "PAKASIR_API_KEY", value: key },
    { onConflict: "key" },
  );
  await tg("sendMessage", {
    chat_id: chatId,
    text: "✅ Pakasir API key disimpan.",
    reply_markup: mainMenu(),
  });
}

async function deletePanelById(chatId: number, panelId: string) {
  // Find panel + server keys for cascade delete in Pterodactyl
  const { data: panel, error } = await admin
    .from("user_panels")
    .select("id,ptero_user_id,ptero_server_id,server_id,username")
    .eq("id", panelId)
    .maybeSingle();
  if (error || !panel) return sendErr(chatId, "Panel tidak ditemukan.");

  // Try cascade in Pterodactyl
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
  await tg("sendMessage", {
    chat_id: chatId,
    text: `✅ Panel <code>${esc(panel.username)}</code> dihapus.`,
    parse_mode: "HTML",
    reply_markup: mainMenu(),
  });
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
  await tg("sendMessage", {
    chat_id: chatId,
    text: `✅ User <b>${esc(email)}</b> dihapus.`,
    parse_mode: "HTML",
    reply_markup: mainMenu(),
  });
}

async function sendErr(chatId: number, msg: string) {
  await tg("sendMessage", { chat_id: chatId, text: `❌ ${msg}` });
}

// ===== Wizard system =====

const WIZARDS: Record<string, { prompts: string[]; finish: (chatId: number, data: Record<string, string>) => Promise<void> }> = {
  addreseller: {
    prompts: [
      "Masukkan <b>email user</b> yang akan dijadikan reseller:",
      "Berapa <b>durasi (hari)</b>? Ketik <code>0</code> untuk Permanent.",
    ],
    finish: async (chatId, d) => {
      const days = parseInt(d.step1, 10) || 0;
      await addReseller(chatId, d.step0.trim(), days);
    },
  },
  addserver: {
    prompts: [
      "Nama server (mis. <code>Server Indonesia</code>):",
      "Domain panel (mis. <code>https://panel.example.com</code>):",
      "API key <b>PTLA</b> (Application):",
      "API key <b>PTLC</b> (Client):",
    ],
    finish: async (chatId, d) => {
      await addServer(chatId, d.step0.trim(), d.step1.trim(), d.step2.trim(), d.step3.trim());
    },
  },
  setkey: {
    prompts: [
      "Server ID (UUID) — gunakan tombol 🖥️ Servers untuk lihat:",
      "API key <b>PTLA</b> baru:",
      "API key <b>PTLC</b> baru:",
    ],
    finish: async (chatId, d) => {
      await setServerKey(chatId, d.step0.trim(), d.step1.trim(), d.step2.trim());
    },
  },
  setptla: {
    prompts: [
      "Server ID (UUID):",
      "API key <b>PTLA</b> baru:",
    ],
    finish: async (chatId, d) => {
      await updateServerField(chatId, d.step0.trim(), { plta_key: d.step1.trim() }, "PTLA");
    },
  },
  setptlc: {
    prompts: [
      "Server ID (UUID):",
      "API key <b>PTLC</b> baru:",
    ],
    finish: async (chatId, d) => {
      await updateServerField(chatId, d.step0.trim(), { pltc_key: d.step1.trim() }, "PTLC");
    },
  },
  seturl: {
    prompts: [
      "Server ID (UUID):",
      "Domain/URL baru (mis. <code>https://panel.example.com</code>):",
    ],
    finish: async (chatId, d) => {
      await updateServerField(chatId, d.step0.trim(), { domain: d.step1.trim().replace(/\/+$/, "") }, "Domain");
    },
  },
  changepw: {
    prompts: [
      "Email user yang akan diganti passwordnya:",
      "Password <b>baru</b>:",
    ],
    finish: async (chatId, d) => {
      await changeUserPassword(chatId, d.step0.trim(), d.step1.trim());
    },
  },
  setpakasir: {
    prompts: ["Masukkan <b>Pakasir API Key</b>:"],
    finish: async (chatId, d) => {
      await setPakasirKey(chatId, d.step0.trim());
    },
  },
  delpanel: {
    prompts: ["Masukkan <b>Panel ID</b> (UUID) yang akan dihapus:"],
    finish: async (chatId, d) => {
      await deletePanelById(chatId, d.step0.trim());
    },
  },
  deluser: {
    prompts: ["Masukkan <b>email user</b> yang akan dihapus:"],
    finish: async (chatId, d) => {
      await deleteUserByEmail(chatId, d.step0.trim());
    },
  },
};

async function startWizard(chatId: number, action: string) {
  const w = WIZARDS[action];
  if (!w) return;
  states.set(chatId, { action, step: 0, data: {} });
  await tg("sendMessage", {
    chat_id: chatId,
    text: `📝 ${w.prompts[0]}\n\n<i>Ketik /cancel untuk membatalkan.</i>`,
    parse_mode: "HTML",
  });
}

async function handleWizardInput(chatId: number, text: string) {
  const state = states.get(chatId)!;
  const w = WIZARDS[state.action];
  state.data[`step${state.step}`] = text;
  state.step += 1;
  if (state.step >= w.prompts.length) {
    states.delete(chatId);
    await w.finish(chatId, state.data);
  } else {
    await tg("sendMessage", {
      chat_id: chatId,
      text: `📝 ${w.prompts[state.step]}`,
      parse_mode: "HTML",
    });
  }
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
    // Callback queries (button taps)
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const msgId = cq.message.message_id;
      const fromId = cq.from.id;
      if (!isOwner(fromId)) {
        await tg("answerCallbackQuery", { callback_query_id: cq.id, text: "Akses ditolak", show_alert: true });
        return new Response("ok");
      }
      await tg("answerCallbackQuery", { callback_query_id: cq.id });
      const data: string = cq.data || "";

      if (data === "menu") {
        await tg("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text: "🤖 <b>Jhonaley Admin Bot</b>\nPilih aksi di bawah:",
          parse_mode: "HTML",
          reply_markup: mainMenu(),
        });
      } else if (data.startsWith("users:")) {
        await listUsers(chatId, parseInt(data.split(":")[1], 10) || 1, msgId);
      } else if (data === "resellers") {
        await listResellers(chatId, msgId);
      } else if (data === "servers") {
        await listServers(chatId, msgId);
      } else if (data === "stats") {
        await showStats(chatId, msgId);
      } else if (data.startsWith("wiz:")) {
        await startWizard(chatId, data.slice(4));
      } else if (data === "confirm:resetdevices") {
        await tg("sendMessage", {
          chat_id: chatId,
          text: "⚠️ Yakin reset SEMUA IP & Fingerprint user?",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Ya, Reset", callback_data: "do:resetdevices" },
              { text: "❌ Batal", callback_data: "menu" },
            ]],
          },
        });
      } else if (data === "do:resetdevices") {
        await resetAllDevices(chatId);
      } else if (data === "help") {
        await tg("sendMessage", {
          chat_id: chatId,
          text:
            "<b>Commands:</b>\n" +
            "/menu — Buka menu\n" +
            "/users [page] — List users (5/page)\n" +
            "/resellers — List resellers\n" +
            "/servers — List servers\n" +
            "/stats — Statistik\n" +
            "/addreseller — Tambah reseller (wizard)\n" +
            "/addserver — Tambah server (wizard)\n" +
            "/setkey — Update PTLA/PTLC server (wizard)\n" +
            "/setpakasir — Set Pakasir API key (wizard)\n" +
            "/delpanel — Hapus panel (wizard)\n" +
            "/deluser — Hapus user (wizard)\n" +
            "/resetdevices — Reset semua IP/FP\n" +
            "/cancel — Batalkan wizard",
          parse_mode: "HTML",
        });
      }
      return new Response("ok");
    }

    const msg = update.message;
    if (!msg) return new Response("ok");
    const chatId = msg.chat.id;
    const fromId = msg.from.id;
    const text: string = (msg.text || "").trim();

    if (!isOwner(fromId)) {
      await tg("sendMessage", { chat_id: chatId, text: "🚫 Akses ditolak. Bot ini hanya untuk owner." });
      return new Response("ok");
    }

    // Cancel wizard
    if (text === "/cancel") {
      states.delete(chatId);
      await tg("sendMessage", { chat_id: chatId, text: "❌ Dibatalkan.", reply_markup: mainMenu() });
      return new Response("ok");
    }

    // Active wizard?
    if (states.has(chatId) && !text.startsWith("/")) {
      await handleWizardInput(chatId, text);
      return new Response("ok");
    }

    // Commands
    const [cmd, ...args] = text.split(/\s+/);
    switch (cmd) {
      case "/start":
      case "/menu":
        await sendMenu(chatId);
        break;
      case "/users":
        await listUsers(chatId, parseInt(args[0], 10) || 1);
        break;
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
        await startWizard(chatId, "addreseller");
        break;
      case "/addserver":
        await startWizard(chatId, "addserver");
        break;
      case "/setkey":
        await startWizard(chatId, "setkey");
        break;
      case "/setptla":
        await startWizard(chatId, "setptla");
        break;
      case "/setptlc":
        await startWizard(chatId, "setptlc");
        break;
      case "/seturl":
        await startWizard(chatId, "seturl");
        break;
      case "/changepw": {
        const joined = args.join(" ");
        const parts = joined.includes(",") ? joined.split(",") : args;
        const email = (parts[0] || "").trim();
        const newpw = (parts[1] || "").trim();
        if (!email || !newpw) {
          await startWizard(chatId, "changepw");
        } else {
          await changeUserPassword(chatId, email, newpw);
        }
        break;
      }
      case "/setpakasir":
        await startWizard(chatId, "setpakasir");
        break;
      case "/delpanel":
        await startWizard(chatId, "delpanel");
        break;
      case "/deluser":
        await startWizard(chatId, "deluser");
        break;
      case "/resetdevices":
        await resetAllDevices(chatId);
        break;
      default:
        await sendMenu(chatId, "Perintah tidak dikenali. Gunakan menu:");
    }
  } catch (e) {
    console.error("bot error", e);
  }
  return new Response("ok");
});