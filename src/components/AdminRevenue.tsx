import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { TrendingUp, Wallet, Crown, Megaphone, Heart, Trophy, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
} from "recharts";

interface RevenueData {
  total: number;
  reseller: number;
  ads: number;
  tips: number;
  orders_count: number;
  days: number;
  daily: Array<{ day: string; reseller: number; ads: number; tips: number; total: number }>;
  top_spenders: Array<{ user_id: string; name: string; avatar_url: string | null; total: number }>;
}

const RANGES = [7, 30, 90];

export default function AdminRevenue() {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (d: number) => {
    setLoading(true);
    const { data: res, error } = await (supabase.rpc as any)("get_revenue_stats", { _days: d });
    if (!error && res) setData(res as RevenueData);
    setLoading(false);
  };

  useEffect(() => { load(range); }, [range]);

  const fmt = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");
  const fmtShort = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "jt";
    if (n >= 1_000) return (n / 1_000).toFixed(0) + "rb";
    return String(n);
  };

  if (loading || !data) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Analytics Pendapatan</h3>
          <p className="text-xs text-muted-foreground">{data.orders_count} transaksi dalam {data.days} hari terakhir</p>
        </div>
        <div className="flex gap-1 p-1 bg-secondary/40 rounded-lg">
          {RANGES.map(r => (
            <Button key={r} variant={range === r ? "default" : "ghost"} size="sm" onClick={() => setRange(r)} className="h-7 text-xs">
              {r} hari
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Total</span></div>
          <p className="text-xl font-bold text-foreground">{fmt(data.total)}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2"><Crown className="w-4 h-4 text-amber" /><span className="text-xs text-muted-foreground">Reseller</span></div>
          <p className="text-xl font-bold text-foreground">{fmt(data.reseller)}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2"><Megaphone className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Iklan</span></div>
          <p className="text-xl font-bold text-foreground">{fmt(data.ads)}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2"><Heart className="w-4 h-4 text-rose-400" /><span className="text-xs text-muted-foreground">Donasi</span></div>
          <p className="text-xl font-bold text-foreground">{fmt(data.tips)}</p>
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <h4 className="font-bold text-sm mb-3">Trend Harian</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.daily}>
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtShort} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => fmt(Number(v))}
              />
              <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gTotal)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h4 className="font-bold text-sm mb-3">Breakdown per Sumber</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtShort} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => fmt(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="reseller" stackId="a" fill="hsl(var(--amber))" name="Reseller" />
              <Bar dataKey="ads" stackId="a" fill="hsl(var(--primary))" name="Iklan" />
              <Bar dataKey="tips" stackId="a" fill="#f43f5e" name="Donasi" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-5 h-5 text-amber" />
          <h4 className="font-bold text-sm">Top Spender (10 besar)</h4>
        </div>
        {data.top_spenders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Belum ada data</p>
        ) : (
          <div className="space-y-2">
            {data.top_spenders.map((s, i) => (
              <div key={s.user_id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 border border-border">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 0 ? "bg-amber/20 text-amber" : i === 1 ? "bg-muted-foreground/20 text-muted-foreground" : i === 2 ? "bg-orange-500/20 text-orange-400" : "bg-secondary text-muted-foreground"
                }`}>{i + 1}</span>
                {s.avatar_url ? (
                  <img src={s.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-white">{s.name.charAt(0).toUpperCase()}</div>
                )}
                <p className="flex-1 text-sm font-medium truncate">{s.name}</p>
                <p className="text-sm font-bold text-primary">{fmt(s.total)}</p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}