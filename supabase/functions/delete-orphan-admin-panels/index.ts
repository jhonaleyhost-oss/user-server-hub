import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const logs: string[] = [];
  const log = (m: string) => { const l = `[${new Date().toISOString().split('T')[1].split('.')[0]}] ${m}`; logs.push(l); console.log(l); };
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: aErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (aErr || !user) throw new Error('Unauthorized');
    const { data: isAdm } = await supabase.rpc('is_admin', { _user_id: user.id });
    if (!isAdm) throw new Error('Admin only');

    const { panelIds } = await req.json();
    if (!Array.isArray(panelIds) || panelIds.length === 0) throw new Error('panelIds kosong');
    log(`Menghapus ${panelIds.length} admin panel dari database...`);

    await supabase.from('admin_panel_servers').delete().in('admin_panel_id', panelIds);
    await supabase.from('admin_panel_subusers').delete().in('admin_panel_id', panelIds);
    const { error: dErr, count } = await supabase
      .from('admin_panels').delete({ count: 'exact' }).in('id', panelIds);
    if (dErr) throw new Error(dErr.message);
    log(`Berhasil menghapus ${count ?? panelIds.length} baris admin_panels`);

    return new Response(JSON.stringify({
      success: true,
      message: `Berhasil menghapus ${count ?? panelIds.length} admin panel orphan.`,
      deleted: count ?? panelIds.length,
      logs,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    log(`ERROR: ${msg}`);
    return new Response(JSON.stringify({ success: false, error: msg, logs }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});