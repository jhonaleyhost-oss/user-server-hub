import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAKASIR_SLUG = "jhonaley-store";
const PAKASIR_API_KEY = "pRfTaGBOiNZbFIXF9mxwWEpqs1d6Esn6";

// Pakasir webhook receiver.
// Configure di dashboard Pakasir: URL =
//   https://<project>.functions.supabase.co/pakasir-webhook
// Pakasir akan POST JSON (mis: { order_id, amount, status, project, ... }).
// Untuk keamanan, kita re-verify ke API Pakasir sebelum mengaktifkan reseller.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let payload: any = {};
    const ctype = req.headers.get("content-type") || "";
    if (ctype.includes("application/json")) {
      payload = await req.json().catch(() => ({}));
    } else {
      const text = await req.text();
      try {
        payload = JSON.parse(text);
      } catch {
        // try urlencoded
        const params = new URLSearchParams(text);
        payload = Object.fromEntries(params.entries());
      }
    }

    const order_id: string | undefined =
      payload.order_id || payload.orderId || payload?.transaction?.order_id;
    const amount: number | undefined = Number(
      payload.amount || payload?.transaction?.amount || 0
    );

    console.log("[pakasir-webhook] incoming", { order_id, amount, payload });

    if (!order_id || !amount) {
      return new Response(JSON.stringify({ ok: false, error: "missing order_id/amount" }), {
        status: 200, // tetap 200 agar Pakasir tidak retry-spam
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Re-verify status ke Pakasir
    const url = `https://app.pakasir.com/api/transactiondetail?project=${PAKASIR_SLUG}&amount=${amount}&order_id=${encodeURIComponent(
      order_id
    )}&api_key=${PAKASIR_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    const status = data?.transaction?.status || data?.status || "pending";
    const completed =
      status === "completed" || status === "success" || status === "paid";

    console.log("[pakasir-webhook] verify", { order_id, status, completed });

    if (!completed) {
      return new Response(JSON.stringify({ ok: true, status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Route by order_id prefix: TIP- => tip jar, lainnya => reseller upgrade
    if (order_id.startsWith("TIP-")) {
      const { error: tipErr } = await supabase
        .from("tips")
        .update({ status: "completed" })
        .eq("order_id", order_id)
        .neq("status", "completed");
      if (tipErr) {
        console.error("[pakasir-webhook] tip update error", tipErr);
        return new Response(JSON.stringify({ ok: false, error: tipErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("[pakasir-webhook] tip completed", order_id);
      return new Response(JSON.stringify({ ok: true, status, kind: "tip" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: act, error: actErr } = await supabase.rpc("activate_reseller", {
      _order_id: order_id,
    });
    if (actErr) {
      console.error("[pakasir-webhook] activate_reseller error", actErr);
      return new Response(JSON.stringify({ ok: false, error: actErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[pakasir-webhook] activated", act);
    return new Response(JSON.stringify({ ok: true, status, kind: "upgrade", activation: act }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[pakasir-webhook] exception", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});