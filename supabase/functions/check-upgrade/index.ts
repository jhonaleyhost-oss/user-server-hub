import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const url = `https://app.pakasir.com/api/transactiondetail?project=${PAKASIR_SLUG}&amount=${amount}&order_id=${encodeURIComponent(
      order_id
    )}&api_key=${PAKASIR_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));

    const status = data?.transaction?.status || data?.status || "pending";
    const completed = status === "completed" || status === "success" || status === "paid";

    let activation: unknown = null;
    if (completed) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: act, error: actErr } = await supabase.rpc("activate_reseller", {
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

    return new Response(JSON.stringify({ status, completed, activation, raw: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});