import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ResellerStatus {
  is_reseller: boolean;
  permanent: boolean;
  expires_at: string | null;
  days_left: number | null;
}

export function useResellerStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ResellerStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (supabase.rpc as any)("get_my_reseller_status").then(({ data }: any) => {
      if (cancelled) return;
      if (data && data.length > 0) setStatus(data[0] as ResellerStatus);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { status, loading };
}

export function formatResellerRemaining(s: ResellerStatus | null): string {
  if (!s || !s.is_reseller) return "—";
  if (s.permanent) return "Permanen";
  if (!s.expires_at) return "Permanen";
  const days = s.days_left ?? 0;
  if (days <= 0) return "Expired";
  if (days === 1) return "1 hari lagi";
  if (days < 30) return `${days} hari lagi`;
  const months = Math.floor(days / 30);
  const rem = days % 30;
  return rem > 0 ? `${months} bln ${rem} hr lagi` : `${months} bulan lagi`;
}

export function formatExpiryDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}