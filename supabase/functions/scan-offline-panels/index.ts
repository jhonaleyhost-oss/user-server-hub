import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 8000) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { data: isAdminData } = await supabase.rpc('is_admin', { _user_id: user.id });
    if (!isAdminData) throw new Error('Admin only');

    const { serverId } = await req.json();
    if (!serverId) throw new Error('Missing serverId');

    const { data: server, error: srvErr } = await supabase
      .from('pterodactyl_servers')
      .select('id, name, domain, plta_key, pltc_key')
      .eq('id', serverId)
      .single();
    if (srvErr || !server) throw new Error('Server tidak ditemukan');

    const { data: panels, error: panelErr } = await supabase
      .from('user_panels')
      .select('id, username, email, ptero_server_id, ptero_user_id, created_at, user_id, ram, cpu, disk, panel_type')
      .eq('server_id', serverId)
      .order('created_at', { ascending: false });
    if (panelErr) throw new Error(panelErr.message);

    let serverAlive = false;
    // Bulk fetch ALL servers from Pterodactyl via pagination
    const pteroServerMap = new Map<number, { suspended: boolean; uuid: string; ownerUserId: number | null; name: string }>();
    try {
      let page = 1;
      const perPage = 100;
      // Hard cap on pages to avoid runaway loops
      for (let i = 0; i < 50; i++) {
        const r = await fetchWithTimeout(
          `${server.domain}/api/application/servers?per_page=${perPage}&page=${page}`,
          { headers: { 'Authorization': `Bearer ${server.plta_key}`, 'Accept': 'application/json' } },
          10000,
        );
        if (!r.ok) { serverAlive = page > 1; break; }
        serverAlive = true;
        const body = await r.json();
        const data = body?.data || [];
        for (const s of data) {
          const attr = s?.attributes;
          if (!attr?.id) continue;
          pteroServerMap.set(Number(attr.id), {
            suspended: !!attr.suspended,
            uuid: String(attr.uuid || ''),
            ownerUserId: attr.user != null ? Number(attr.user) : null,
            name: String(attr.name || ''),
          });
        }
        const totalPages = body?.meta?.pagination?.total_pages ?? 1;
        if (page >= totalPages) break;
        page++;
      }
    } catch { /* serverAlive stays false if first page failed */ }

    // Bulk fetch all Ptero users so we can verify username/email of each server's owner
    const pteroUserMap = new Map<number, { username: string; email: string }>();
    if (serverAlive) {
      try {
        let page = 1;
        for (let i = 0; i < 50; i++) {
          const r = await fetchWithTimeout(
            `${server.domain}/api/application/users?per_page=100&page=${page}`,
            { headers: { 'Authorization': `Bearer ${server.plta_key}`, 'Accept': 'application/json' } },
            10000,
          );
          if (!r.ok) break;
          const body = await r.json();
          for (const u of (body?.data || [])) {
            const a = u?.attributes;
            if (a?.id) {
              pteroUserMap.set(Number(a.id), {
                username: String(a.username || '').toLowerCase(),
                email: String(a.email || '').toLowerCase(),
              });
            }
          }
          const totalPages = body?.meta?.pagination?.total_pages ?? 1;
          if (page >= totalPages) break;
          page++;
        }
      } catch { /* ignore */ }
    }

    // Fetch profiles map for owner name
    const userIds = Array.from(new Set((panels || []).map(p => p.user_id)));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, full_name')
      .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);
    const profileMap: Record<string, { email: string; full_name: string | null }> = {};
    for (const p of (profiles || [])) profileMap[p.user_id] = { email: p.email, full_name: p.full_name };

    type Result = {
      id: string; username: string; email: string; owner_email: string | null; owner_name: string | null;
      ptero_server_id: number | null;
      status: 'orphan' | 'suspended' | 'power_off' | 'unreachable' | 'online' | 'unknown' | 'untracked';
      panel_type: string | null; ram: number; cpu: number; disk: number; created_at: string;
      untracked?: boolean; ptero_user_id?: number | null;
    };
    const results: Result[] = [];

    if (!serverAlive) {
      // Server itself dead — semua panel di server ini dianggap unreachable
      for (const p of (panels || [])) {
        results.push({
          id: p.id, username: p.username, email: p.email,
          owner_email: profileMap[p.user_id]?.email ?? null,
          owner_name: profileMap[p.user_id]?.full_name ?? null,
          ptero_server_id: p.ptero_server_id, status: 'unreachable',
          panel_type: p.panel_type, ram: p.ram, cpu: p.cpu, disk: p.disk, created_at: p.created_at,
        });
      }
    } else {
      // Classify each panel using the bulk map (no per-panel HTTP). Optional power-state check after.
      const onlineUuids: { panelIdx: number; uuid: string }[] = [];
      for (const p of (panels || [])) {
        let status: Result['status'];
        let uuid = '';
        if (!p.ptero_server_id) {
          status = 'orphan';
        } else {
          const info = pteroServerMap.get(Number(p.ptero_server_id));
          if (!info) status = 'orphan';
          else if (info.suspended) status = 'suspended';
          else {
            // Verify server owner's username/email matches the panel — guards against reused server IDs
            const owner = info.ownerUserId != null ? pteroUserMap.get(info.ownerUserId) : null;
            const dbUsername = String(p.username || '').toLowerCase();
            const dbEmail = String(p.email || '').toLowerCase();
            const usernameMatch = !!owner && !!dbUsername && owner.username === dbUsername;
            const emailMatch = !!owner && !!dbEmail && owner.email === dbEmail;
            if (pteroUserMap.size > 0 && !usernameMatch && !emailMatch) {
              status = 'orphan';
            } else {
              status = 'online';
              uuid = info.uuid;
            }
          }
        }
        const idx = results.length;
        results.push({
          id: p.id, username: p.username, email: p.email,
          owner_email: profileMap[p.user_id]?.email ?? null,
          owner_name: profileMap[p.user_id]?.full_name ?? null,
          ptero_server_id: p.ptero_server_id, status,
          panel_type: p.panel_type, ram: p.ram, cpu: p.cpu, disk: p.disk, created_at: p.created_at,
        });
        if (status === 'online' && uuid && server.pltc_key) {
          onlineUuids.push({ panelIdx: idx, uuid });
        }
      }

      // Power-state probe — high concurrency. Probe failure = power_off (client API down = server off).
      const POWER_CONCURRENCY = 60;
      for (let i = 0; i < onlineUuids.length; i += POWER_CONCURRENCY) {
        const batch = onlineUuids.slice(i, i + POWER_CONCURRENCY);
        await Promise.all(batch.map(async ({ panelIdx, uuid }) => {
          try {
            const cr = await fetchWithTimeout(
              `${server.domain}/api/client/servers/${uuid}/resources`,
              { headers: { 'Authorization': `Bearer ${server.pltc_key}`, 'Accept': 'application/json' } },
              8000,
            );
            if (!cr.ok) return; // 403/404 etc — keep online
            const cb = await cr.json();
            const state = String(cb?.attributes?.current_state || '').toLowerCase();
            if (state === 'offline' || state === 'stopped') {
              results[panelIdx].status = 'power_off';
            }
          } catch { /* keep online on probe failure */ }
        }));
      }
    }

    let skippedAdminOwned = 0;
    // ===== Deteksi server Pterodactyl yang TIDAK ada di database (untracked/ghost) =====
    if (serverAlive) {
      const knownIds = new Set<number>();
      for (let from = 0; from < 100000; from += 1000) {
        const { data: chunk } = await supabase
          .from('user_panels').select('ptero_server_id')
          .not('ptero_server_id', 'is', null)
          .range(from, from + 999);
        for (const p of (chunk || [])) if (p.ptero_server_id) knownIds.add(Number(p.ptero_server_id));
        if (!chunk || chunk.length < 1000) break;
      }
      const { data: adminSrv } = await supabase
        .from('admin_panel_servers').select('ptero_server_id');
      for (const p of (adminSrv || [])) if (p.ptero_server_id) knownIds.add(Number(p.ptero_server_id));
      // Jangan sentuh server milik user Admin Panel (mereka bikin server sendiri)
      const protectedUserIds = new Set<number>();
      const { data: apList } = await supabase.from('admin_panels').select('ptero_user_id');
      for (const a of (apList || [])) if (a.ptero_user_id) protectedUserIds.add(Number(a.ptero_user_id));
      const { data: apSub } = await supabase.from('admin_panel_subusers').select('ptero_user_id');
      for (const a of (apSub || [])) if (a.ptero_user_id) protectedUserIds.add(Number(a.ptero_user_id));

      skippedAdminOwned = 0;
      const untrackedProbe: { idx: number; uuid: string }[] = [];
      for (const [sid, info] of pteroServerMap.entries()) {
        if (knownIds.has(sid)) continue;
        if (info.ownerUserId != null && protectedUserIds.has(info.ownerUserId)) { skippedAdminOwned++; continue; }
        const owner = info.ownerUserId != null ? pteroUserMap.get(info.ownerUserId) : null;
        const idx = results.length;
        results.push({
          id: `ptero:${sid}`,
          username: owner?.username || info.name || `server-${sid}`,
          email: owner?.email || '',
          owner_email: null,
          owner_name: 'Tidak ada di database',
          ptero_server_id: sid,
          status: info.suspended ? 'suspended' : 'untracked',
          panel_type: null, ram: 0, cpu: 0, disk: 0,
          created_at: new Date().toISOString(),
          untracked: true,
          ptero_user_id: info.ownerUserId,
        });
        if (!info.suspended && info.uuid && server.pltc_key) untrackedProbe.push({ idx, uuid: info.uuid });
      }

      const CONC = 60;
      for (let i = 0; i < untrackedProbe.length; i += CONC) {
        const batch = untrackedProbe.slice(i, i + CONC);
        await Promise.all(batch.map(async ({ idx, uuid }) => {
          try {
            const cr = await fetchWithTimeout(
              `${server.domain}/api/client/servers/${uuid}/resources`,
              { headers: { 'Authorization': `Bearer ${server.pltc_key}`, 'Accept': 'application/json' } },
              8000,
            );
            if (!cr.ok) return;
            const cb = await cr.json();
            const state = String(cb?.attributes?.current_state || '').toLowerCase();
            if (state === 'offline' || state === 'stopped') results[idx].status = 'power_off';
          } catch { /* keep untracked */ }
        }));
      }
    }

    const untrackedCount = results.filter(r => r.untracked).length;
    const orphanCount = results.filter(r => r.status === 'orphan').length;
    const suspendedCount = results.filter(r => r.status === 'suspended').length;
    const powerOffCount = results.filter(r => r.status === 'power_off').length;
    const unreachableCount = results.filter(r => r.status === 'unreachable').length;

    return new Response(JSON.stringify({
      success: true,
      serverAlive,
      serverName: server.name,
      total: results.length,
      orphanCount,
      untrackedCount,
      pteroTotalServers: pteroServerMap.size,
      skippedAdminOwned,
      dbPanelCount: (panels || []).length,
      suspendedCount,
      powerOffCount,
      unreachableCount,
      offlineCount: results.filter(r => r.status !== 'online').length,
      onlineCount: results.filter(r => r.status === 'online').length,
      panels: results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});