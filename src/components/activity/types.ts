export interface PanelActivity {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  username: string;
  ram: number;
  cpu: number;
  disk: number;
  server_name: string | null;
  server_domain: string | null;
  panel_type: string | null;
  created_at: string;
}

export interface SignupActivity {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
}

export interface UpgradeActivity {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  plan: string;
  amount: number;
  duration_days: number | null;
  paid_at: string | null;
  expires_at: string | null;
  permanent: boolean;
  created_at: string;
}

export interface AdminCleanupActivity {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  count: number;
  server_name: string;
  created_at: string;
}

export interface PanelDeleteActivity {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: null;
  role: string;
  username: string;
  panel_type: string;
  server_name: string;
  created_at: string;
}

export interface AdminPanelActivity {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: null;
  role: string;
  username: string;
  server_name: string;
  created_at: string;
}

export interface UserDeleteActivity {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: null;
  role: string;
  email: string;
  created_at: string;
}

export interface AdEvent {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: null;
  role: string;
  event: 'ad_rental' | 'ad_expired' | 'role_expired';
  title: string;
  amount: number | null;
  created_at: string;
}

export type FeedItem =
  | ({ kind: "panel" } & PanelActivity)
  | ({ kind: "signup" } & SignupActivity)
  | ({ kind: "upgrade" } & UpgradeActivity)
  | ({ kind: "admin_cleanup" } & AdminCleanupActivity)
  | ({ kind: "panel_deleted" } & PanelDeleteActivity)
  | ({ kind: "admin_panel" } & AdminPanelActivity)
  | ({ kind: "user_deleted" } & UserDeleteActivity)
  | ({ kind: "ad" } & AdEvent);

export const formatSpec = (n: number) => (n === 0 ? "Unlimited" : `${n}`);

export const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}d lalu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  const d = Math.floor(h / 24);
  return `${d}h lalu`;
};