// Austin Payment Gateway (https://austinstore.id) client helper.
// Auth: X-API-Key + HMAC-SHA256 signature (X-Signature / X-Timestamp).

export const AUSTIN_BASE = "https://austinstore.id";

// ---------------------------------------------------------------------------
// API version switch (admin-controlled via public.app_settings key
// `austin_api_version`, value "v1" | "v2"). Cached briefly per isolate.
// ---------------------------------------------------------------------------
let cachedVersion: { v: "v1" | "v2"; at: number } | null = null;

export async function getAustinVersion(): Promise<"v1" | "v2"> {
  if (cachedVersion && Date.now() - cachedVersion.at < 30_000) return cachedVersion.v;
  let v: "v1" | "v2" = "v2";
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && key) {
      const r = await fetch(
        `${url}/rest/v1/app_settings?key=eq.austin_api_version&select=value`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      const j = await r.json();
      if (Array.isArray(j) && j[0]?.value === "v1") v = "v1";
    }
  } catch (e) {
    console.error("[austin] version lookup failed", e);
  }
  cachedVersion = { v, at: Date.now() };
  return v;
}

// ---------------------------------------------------------------------------
// Austin Pay only supports IPv4 whitelisting, but the edge runtime frequently
// egresses over IPv6. We therefore resolve the A record ourselves and speak
// HTTP/1.1 over an explicit IPv4 TLS socket.
// ---------------------------------------------------------------------------

let cachedIp: { ip: string; at: number } | null = null;

async function resolveIPv4(hostname: string): Promise<string> {
  if (cachedIp && Date.now() - cachedIp.at < 5 * 60_000) return cachedIp.ip;
  let ip: string | undefined;
  try {
    const recs = await Deno.resolveDns(hostname, "A");
    ip = recs[0];
  } catch {
    // Fallback: DNS-over-HTTPS
    const r = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
      { headers: { accept: "application/dns-json" } },
    );
    const j = await r.json();
    ip = (j?.Answer ?? []).find((a: any) => a.type === 1)?.data;
  }
  if (!ip) throw new Error(`Cannot resolve IPv4 for ${hostname}`);
  cachedIp = { ip, at: Date.now() };
  return ip;
}

function dechunk(body: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  const dec = new TextDecoder();
  while (i < body.length) {
    let lineEnd = i;
    while (lineEnd < body.length - 1 && !(body[lineEnd] === 13 && body[lineEnd + 1] === 10)) lineEnd++;
    const size = parseInt(dec.decode(body.subarray(i, lineEnd)).trim(), 16);
    if (!Number.isFinite(size) || size === 0) break;
    const start = lineEnd + 2;
    for (let k = start; k < start + size && k < body.length; k++) out.push(body[k]);
    i = start + size + 2;
  }
  return new Uint8Array(out);
}

async function ipv4Fetch(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
): Promise<{ status: number; text: string }> {
  const u = new URL(url);
  const ip = await resolveIPv4(u.hostname);
  // Connect the TCP socket to the explicit IPv4 address, then upgrade to TLS
  // using the real hostname so SNI / cert validation still work.
  const tcp = await Deno.connect({ hostname: ip, port: 443 });
  const conn = await Deno.startTls(tcp, { hostname: u.hostname });

  try {
    const bodyBytes = init.body ? new TextEncoder().encode(init.body) : new Uint8Array(0);
    const headerLines = [
      `${init.method} ${u.pathname}${u.search} HTTP/1.1`,
      `Host: ${u.hostname}`,
      "Connection: close",
      "Accept: application/json",
      ...Object.entries(init.headers).map(([k, v]) => `${k}: ${v}`),
      `Content-Length: ${bodyBytes.length}`,
      "",
      "",
    ].join("\r\n");

    const head = new TextEncoder().encode(headerLines);
    const payload = new Uint8Array(head.length + bodyBytes.length);
    payload.set(head, 0);
    payload.set(bodyBytes, head.length);

    let written = 0;
    while (written < payload.length) written += await conn.write(payload.subarray(written));

    const chunks: Uint8Array[] = [];
    const buf = new Uint8Array(16384);
    while (true) {
      const n = await conn.read(buf);
      if (n === null) break;
      chunks.push(buf.slice(0, n));
    }
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const raw = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { raw.set(c, off); off += c.length; }

    // Split headers / body
    let sep = -1;
    for (let i = 0; i < raw.length - 3; i++) {
      if (raw[i] === 13 && raw[i + 1] === 10 && raw[i + 2] === 13 && raw[i + 3] === 10) { sep = i; break; }
    }
    if (sep === -1) throw new Error("Malformed HTTP response from Austin");

    const headerText = new TextDecoder().decode(raw.subarray(0, sep));
    const status = parseInt(headerText.split("\r\n")[0].split(" ")[1] ?? "0", 10);
    let bodyRaw = raw.subarray(sep + 4);
    if (/transfer-encoding:\s*chunked/i.test(headerText)) bodyRaw = dechunk(bodyRaw);

    return { status, text: new TextDecoder().decode(bodyRaw) };
  } finally {
    try { conn.close(); } catch { /* already closed */ }
  }
}

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

export async function austinRequest<T = any>(
  method: "GET" | "POST",
  path: string,
  bodyObj?: unknown,
): Promise<{ ok: boolean; status: number; data: T | any }> {
  const apiKey = Deno.env.get("AUSTIN_API_KEY");
  const apiSecret = Deno.env.get("AUSTIN_API_SECRET");
  if (!apiKey) throw new Error("AUSTIN_API_KEY is not configured");

  const body = bodyObj ? JSON.stringify(bodyObj) : "";
  const timestamp = Date.now().toString();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };
  if (apiSecret) {
    headers["X-Timestamp"] = timestamp;
    headers["X-Signature"] = await sign(`${method}\n${path}\n${body}\n${timestamp}`, apiSecret);
  }

  const res = await ipv4Fetch(`${AUSTIN_BASE}${path}`, {
    method,
    headers,
    body: body || undefined,
  });
  const text = res.text;
  const okStatus = res.status >= 200 && res.status < 300;
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { success: false, message: text.slice(0, 500) };
  }
  if (!okStatus) {
    console.error(`[austin] ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  }
  return { ok: okStatus && data?.success !== false, status: res.status, data };
}

/** Create a dynamic QRIS deposit. Returns final amount (incl. unique fee) + QR payload. */
export async function austinCreateDeposit(amount: number) {
  const v = await getAustinVersion();
  return await austinRequest("POST", `/api/${v}/deposit/create`, { amount });
}

/** Poll payment status: paid | pending | expired | cancel (selected version first, then the other) */
export async function austinCheckDeposit(transactionId: string) {
  const id = encodeURIComponent(transactionId);
  const v = await getAustinVersion();
  const other = v === "v2" ? "v1" : "v2";
  const first = await austinRequest("GET", `/api/${v}/deposit/check/${id}`);
  if (first.ok) return first;
  return await austinRequest("GET", `/api/${other}/deposit/check/${id}`);
}

export async function austinCancelDeposit(transactionId: string) {
  const id = encodeURIComponent(transactionId);
  const v = await getAustinVersion();
  const other = v === "v2" ? "v1" : "v2";
  const first = await austinRequest("POST", `/api/${v}/deposit/cancel/${id}`);
  if (first.ok) return first;
  return await austinRequest("POST", `/api/${other}/deposit/cancel/${id}`);
}