import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { austinCancelDeposit } from "../_shared/austin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id || typeof order_id !== "string") return json({ error: "missing order_id" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, service);

    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    // Ownership check across both order kinds
    const { data: order } = await supabase
      .from("reseller_orders")
      .select("order_id, status, user_id")
      .eq("order_id", order_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: rental } = order
      ? { data: null as any }
      : await supabase
          .from("ad_rentals")
          .select("id, status, user_id")
          .eq("order_id", order_id)
          .eq("user_id", user.id)
          .maybeSingle();

    if (!order && !rental) return json({ error: "order tidak ditemukan" }, 404);
    if ((order?.status ?? rental?.status) === "completed" || (order?.status ?? rental?.status) === "active") {
      return json({ error: "Pembayaran sudah selesai, tidak bisa dibatalkan" }, 400);
    }

    // Cancel on Austin side (best effort)
    let providerCancelled = false;
    const { data: payment } = await supabase
      .from("austin_payments")
      .select("transaction_id, status")
      .eq("order_id", order_id)
      .maybeSingle();

    if (payment?.transaction_id) {
      try {
        const res = await austinCancelDeposit(payment.transaction_id);
        providerCancelled = !!res?.ok;
      } catch (e) {
        console.error("[cancel-qris] austin cancel failed", e);
      }
      await supabase
        .from("austin_payments")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("order_id", order_id);
    }

    if (order) {
      await supabase
        .from("reseller_orders")
        .update({ status: "cancelled" })
        .eq("order_id", order_id)
        .eq("user_id", user.id);
    } else if (rental) {
      await supabase
        .from("ad_rentals")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", rental.id)
        .eq("user_id", user.id);
    }

    return json({ success: true, provider_cancelled: providerCancelled });
  } catch (e) {
    console.error("[cancel-qris]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
