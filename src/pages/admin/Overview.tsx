import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Server,
  HardDrive,
  Wifi,
  Bell,
  Tag,
  Sparkles,
  Megaphone,
  ScrollText,
  WifiOff,
  UserX,
  Settings2,
  ArrowRight,
  Ghost,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import GlassCard from '@/components/GlassCard';
import AdminRevenue from '@/components/AdminRevenue';
import { supabase } from '@/integrations/supabase/client';

interface QuickStats {
  users: number;
  servers: number;
  panels: number;
  serversOnline: number;
}

const NAV_CARDS = [
  { to: '/admin/manage', label: 'Manajemen Data', desc: 'User, server, panel, device', icon: Settings2, color: 'text-primary bg-primary/10' },
  { to: '/admin/inactive', label: 'Akun Nonaktif', desc: 'Akun idle >1 bulan', icon: UserX, color: 'text-rose-400 bg-rose-500/10' },
  { to: '/admin/offline-panels', label: 'Panel Offline', desc: 'Scan & hapus panel mati', icon: WifiOff, color: 'text-amber bg-amber/10' },
  { to: '/admin/orphan-admin-panels', label: 'Orphan ADP', desc: 'Hapus Admin Panel orphan', icon: Ghost, color: 'text-rose-400 bg-rose-500/10' },
  { to: '/admin/broadcast', label: 'Broadcast', desc: 'Pesan ke seluruh user', icon: Bell, color: 'text-blue-400 bg-blue-500/10' },
  { to: '/admin/promos', label: 'Promo Codes', desc: 'Kelola kode promo', icon: Tag, color: 'text-emerald-400 bg-emerald-500/10' },
  { to: '/admin/ads', label: 'Sewa Iklan', desc: 'Manajemen iklan user', icon: Sparkles, color: 'text-purple-400 bg-purple-500/10' },
  { to: '/admin/popup', label: 'Popup', desc: 'Popup announcement', icon: Megaphone, color: 'text-orange-400 bg-orange-500/10' },
  { to: '/admin/activity', label: 'Log Aktivitas', desc: 'Audit trail sistem', icon: ScrollText, color: 'text-cyan-400 bg-cyan-500/10' },
];

const Overview = () => {
  const [stats, setStats] = useState<QuickStats>({ users: 0, servers: 0, panels: 0, serversOnline: 0 });

  useEffect(() => {
    (async () => {
      const [u, s, p] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('pterodactyl_servers').select('id', { count: 'exact', head: true }),
        supabase.from('user_panels').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        users: u.count ?? 0,
        servers: s.count ?? 0,
        panels: p.count ?? 0,
        serversOnline: 0,
      });

      // Try live server statuses
      try {
        const { data: srv } = await supabase.from('pterodactyl_servers').select('id');
        if (srv && srv.length > 0) {
          const res = await supabase.functions.invoke('check-server-status', {
            body: { serverIds: srv.map((x: any) => x.id) },
          });
          const statuses = res.data?.statuses || [];
          const online = statuses.filter((x: any) => x.isOnline).length;
          setStats((prev) => ({ ...prev, serversOnline: online }));
        }
      } catch {}
    })();
  }, []);

  const STAT_CARDS = [
    { icon: Users, label: 'Pengguna', value: stats.users, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { icon: Server, label: 'Server', value: stats.servers, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    { icon: HardDrive, label: 'Panel', value: stats.panels, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { icon: Wifi, label: 'Server Online', value: stats.serversOnline, color: 'text-amber', bg: 'bg-amber/10', border: 'border-amber/20' },
  ];

  return (
    <AdminLayout title="Admin Overview" description="Ringkasan sistem, pendapatan & navigasi cepat">
      <div className="space-y-5">
        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map((s) => (
            <GlassCard key={s.label} className={`p-4 border ${s.border}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg} ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-bold">{s.value}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider truncate">{s.label}</div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Revenue analytics */}
        <GlassCard className="p-4 sm:p-6">
          <AdminRevenue />
        </GlassCard>

        {/* Navigation cards */}
        <div>
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3 px-1">Navigasi</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {NAV_CARDS.map((c) => (
              <Link key={c.to} to={c.to} className="group">
                <GlassCard className="p-4 h-full hover:border-primary/40 transition-all">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${c.color}`}>
                    <c.icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{c.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Overview;