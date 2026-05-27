import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAKASIR_SLUG = "jhonaley-store";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { amount, order_id } = await req.json();
    if (!amount || !order_id) {
      return new Response(JSON.stringify({ error: "missing params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Create transaction
    const r1 = await fetch("https://app.pakasir.com/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: PAKASIR_SLUG, amount, order_id }),
    });
    const d1 = await r1.json();
    const tx = d1?.transaction;
    if (!tx?.id) {
      return new Response(JSON.stringify({ error: "create failed", raw: d1 }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Set payment method to qris to get payment_number (EMV QRIS payload)
    const r2 = await fetch(`https://app.pakasir.com/api/transactions/${tx.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_method: "qris" }),
    });
    const d2 = await r2.json();
    const t2 = d2?.transaction;
    const qris = t2?.payment_number;
    if (!qris) {
      return new Response(JSON.stringify({ error: "qris failed", raw: d2 }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        order_id: t2.order_id,
        amount: t2.amount,
        qris,
        expires_at: t2.payment_number_expires_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});