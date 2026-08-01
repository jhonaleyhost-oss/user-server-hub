// Austin Payment Gateway (https://austinstore.id) client helper.
// Auth: X-API-Key + HMAC-SHA256 signature (X-Signature / X-Timestamp).

export const AUSTIN_BASE = "https://austinstore.id";

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

  const res = await fetch(`${AUSTIN_BASE}${path}`, {
    method,
    headers,
    body: body || undefined,
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { success: false, message: text.slice(0, 500) };
  }
  if (!res.ok) {
    console.error(`[austin] ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  }
  return { ok: res.ok && data?.success !== false, status: res.status, data };
}

/** Create a dynamic QRIS deposit. Returns final amount (incl. unique fee) + QR payload. */
export async function austinCreateDeposit(amount: number) {
  return await austinRequest("POST", "/api/v1/deposit/create", { amount });
}

/** Poll payment status: paid | pending | expired | cancel */
export async function austinCheckDeposit(transactionId: string) {
  return await austinRequest("GET", `/api/v1/deposit/check/${encodeURIComponent(transactionId)}`);
}

export async function austinCancelDeposit(transactionId: string) {
  return await austinRequest("POST", `/api/v1/deposit/cancel/${encodeURIComponent(transactionId)}`);
}