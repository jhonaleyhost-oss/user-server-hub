import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface MembershipStatus {
  reseller_expires_at: string | null;
  reseller_permanent: boolean;
  adp_server_expires_at: string | null;
  adp_server_permanent: boolean;
  /** Latest completed order plan, e.g. "1bln" | "perm" | "adp_1bln" | "adp_perm" */
  last_plan?: string | null;
}

export function useMembershipStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<MembershipStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }
    const [{ data }, { data: order }] = await Promise.all([
      supabase
        .from("profiles")
        .select("reseller_expires_at,reseller_permanent,adp_server_expires_at,adp_server_permanent")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("reseller_orders")
        .select("plan,paid_at,created_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (data) setStatus({ ...(data as MembershipStatus), last_plan: order?.plan ?? null });
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { status, loading, refetch: load };
}

export function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export function formatRemaining(iso: string | null, permanent: boolean): string {
  if (permanent) return "Permanen";
  if (!iso) return "—";
  const d = daysLeft(iso) ?? 0;
  if (d <= 0) return "Expired";
  if (d === 1) return "1 hari lagi";
  if (d < 30) return `${d} hari lagi`;
  const m = Math.floor(d / 30);
  const r = d % 30;
  return r > 0 ? `${m} bln ${r} hr lagi` : `${m} bulan lagi`;
}

export function formatExpiryShort(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
