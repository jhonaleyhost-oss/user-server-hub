import { Cpu, MemoryStick, HardDrive, Activity, Network } from 'lucide-react';

export interface ServerStats {
  state?: string;
  cpu_absolute?: number;
  memory_bytes?: number;
  memory_limit_bytes?: number;
  disk_bytes?: number;
  network?: { rx_bytes?: number; tx_bytes?: number };
  uptime?: number;
}

function fmtBytes(b?: number) {
  if (!b || b <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(2)} ${u[i]}`;
}
function fmtUptime(s?: number) {
  if (!s || s <= 0) return '-';
  s = Math.floor(s / 1000);
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

export default function StatsCards({ stats, limits }: { stats: ServerStats; limits?: { memory?: number; disk?: number; cpu?: number } }) {
  const memPctLimit = limits?.memory && limits.memory > 0 ? (((stats.memory_bytes || 0) / (limits.memory * 1024 * 1024)) * 100) : null;
  const diskPctLimit = limits?.disk && limits.disk > 0 ? (((stats.disk_bytes || 0) / (limits.disk * 1024 * 1024)) * 100) : null;

  const cards = [
    { icon: Activity, label: 'Status', value: (stats.state || 'offline').toUpperCase(), accent: stats.state === 'running' ? 'text-emerald' : stats.state === 'starting' ? 'text-amber-400' : 'text-rose-400' },
    { icon: Cpu, label: 'CPU', value: `${(stats.cpu_absolute || 0).toFixed(2)}%`, sub: limits?.cpu ? `limit ${limits.cpu}%` : 'unlimited' },
    { icon: MemoryStick, label: 'Memory', value: fmtBytes(stats.memory_bytes), sub: memPctLimit != null ? `${memPctLimit.toFixed(1)}% / ${limits?.memory}MB` : 'unlimited' },
    { icon: HardDrive, label: 'Disk', value: fmtBytes(stats.disk_bytes), sub: diskPctLimit != null ? `${diskPctLimit.toFixed(1)}% / ${limits?.disk}MB` : 'unlimited' },
    { icon: Network, label: 'Network', value: `${fmtBytes(stats.network?.rx_bytes)} ↓ / ${fmtBytes(stats.network?.tx_bytes)} ↑` },
    { icon: Activity, label: 'Uptime', value: fmtUptime(stats.uptime) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="glass-card rounded-xl p-3 border border-border/40">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <c.icon className="w-3.5 h-3.5" />
            {c.label}
          </div>
          <div className={`mt-1 font-bold text-sm sm:text-base truncate ${c.accent || 'text-foreground'}`}>{c.value}</div>
          {c.sub && <div className="text-[10px] text-muted-foreground truncate">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}