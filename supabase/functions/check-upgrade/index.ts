import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { austinCheckDeposit } from "../_shared/austin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Legacy fallback for orders created before the Austin Pay migration
const PAKASIR_SLUG = "jhonaley-store";
const PAKASIR_API_KEY = "pRfTaGBOiNZbFIXF9mxwWEpqs1d6Esn6";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { order_id, amount } = await req.json();
    if (!order_id || !amount) {
      return new Response(JSON.stringify({ error: "missing params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: mapping } = await supabase
      .from("austin_payments")
      .select("transaction_id, final_amount")
      .eq("order_id", order_id)
      .maybeSingle();

    let status = "pending";
    let data: unknown = null;

    if (mapping?.transaction_id) {
      const r = await austinCheckDeposit(mapping.transaction_id);
      data = r.data;
      status = r.data?.status || "pending";
    } else {
      // legacy Pakasir order
      const url = `https://app.pakasir.com/api/transactiondetail?project=${PAKASIR_SLUG}&amount=${amount}&order_id=${encodeURIComponent(
        order_id
      )}&api_key=${PAKASIR_API_KEY}`;
      const res = await fetch(url);
      const d = await res.json().catch(() => ({}));
      data = d;
      status = (d as any)?.transaction?.status || (d as any)?.status || "pending";
    }

    const completed = status === "completed" || status === "success" || status === "paid";

    if (mapping?.transaction_id && (completed || status === "expired" || status === "cancel")) {
      await supabase
        .from("austin_payments")
        .update({ status: completed ? "paid" : status, updated_at: new Date().toISOString() })
        .eq("order_id", order_id);
    }

    let activation: unknown = null;
    let kind = "upgrade";
    if (completed) {
      const oid = String(order_id);
      let rpcName = "activate_reseller";
      if (oid.startsWith("AD-")) {
        rpcName = "activate_ad_rental";
        kind = "ad_rental";
      } else if (oid.startsWith("ADP-")) {
        rpcName = "activate_adp_server";
        kind = "adp_server";
      }
      const { data: act, error: actErr } = await supabase.rpc(rpcName, {
        _order_id: order_id,
      });
      if (actErr) {
        return new Response(JSON.stringify({ status, completed, error: actErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      activation = act;
    }

    return new Response(JSON.stringify({ status, completed, activation, kind, raw: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});