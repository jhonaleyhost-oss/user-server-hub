import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { austinCreateDeposit } from "../_shared/austin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Reuse existing pending QRIS for the same order (avoids duplicate deposits)
    const { data: existing } = await supabase
      .from("austin_payments")
      .select("transaction_id, final_amount, qr_string, expired_at, status")
      .eq("order_id", order_id)
      .maybeSingle();

    if (
      existing &&
      existing.status === "pending" &&
      existing.qr_string &&
      existing.expired_at &&
      new Date(existing.expired_at).getTime() > Date.now() + 20_000
    ) {
      return new Response(
        JSON.stringify({
          order_id,
          transaction_id: existing.transaction_id,
          amount: existing.final_amount,
          qris: existing.qr_string,
          expires_at: existing.expired_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { ok, status, data } = await austinCreateDeposit(Number(amount));
    const dep = data?.deposit ?? data?.data ?? data?.result ?? null;
    if (!ok || !dep?.qr_string) {
      let hint: string | undefined;
      if (status === 403) {
        const ip = await fetch("https://api.ipify.org").then((r) => r.text()).catch(() => "unknown");
        hint = `IP server (${ip}) belum terdaftar di whitelist Austin Pay.`;
      }
      return new Response(
        JSON.stringify({ error: [data?.message || "create failed", hint].filter(Boolean).join(" — "), raw: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("austin_payments").upsert(
      {
        order_id,
        transaction_id: dep.transaction_id,
        base_amount: Number(amount),
        final_amount: Number(dep.amount ?? amount),
        qr_string: dep.qr_string,
        expired_at: dep.expired_at,
        status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "order_id" }
    );

    return new Response(
      JSON.stringify({
        order_id,
        transaction_id: dep.transaction_id,
        amount: Number(dep.amount ?? amount),
        qris: dep.qr_string,
        qr_image: dep.qr_image ?? null,
        expires_at: dep.expired_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[create-qris] error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});