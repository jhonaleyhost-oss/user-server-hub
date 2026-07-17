import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Bell,
  Tag,
  Sparkles,
  Megaphone,
  ScrollText,
  WifiOff,
  UserX,
  Settings2,
  ArrowLeft,
  Crown,
  ShieldCheck,
  Ghost,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { PageTransition } from '@/components/PageTransition';
import GlassCard from '@/components/GlassCard';
import ThemeToggle from '@/components/ThemeToggle';
import AccentColorPicker from '@/components/AccentColorPicker';
import { Button } from '@/components/ui/button';

export const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/manage', label: 'Manajemen', icon: Settings2 },
  { to: '/admin/inactive', label: 'Nonaktif', icon: UserX },
  { to: '/admin/offline-panels', label: 'Offline', icon: WifiOff },
  { to: '/admin/orphan-admin-panels', label: 'Orphan ADP', icon: Ghost },
  { to: '/admin/warranty', label: 'Garansi', icon: ShieldCheck },
  { to: '/admin/broadcast', label: 'Broadcast', icon: Bell },
  { to: '/admin/promos', label: 'Promo', icon: Tag },
  { to: '/admin/ads', label: 'Iklan', icon: Sparkles },
  { to: '/admin/popup', label: 'Popup', icon: Megaphone },
  { to: '/admin/activity', label: 'Log Aktivitas', icon: ScrollText },
];

interface Props {
  title: string;
  description?: string;
  children: ReactNode;
}

const AdminLayout = ({ title, description, children }: Props) => {
  const navigate = useNavigate();

  return (
    <AppShell>
      <PageTransition>
        <div className="min-h-screen py-6 px-4 bg-background">
          <div className="w-full max-w-6xl mx-auto space-y-5">
            {/* Header */}
            <GlassCard className="p-4 sm:p-5 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber/10 via-transparent to-primary/10 pointer-events-none" />
              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/')}
                    className="shrink-0"
                    aria-label="Kembali ke dashboard"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber via-amber/80 to-amber/40 flex items-center justify-center shadow-lg shadow-amber/30 shrink-0">
                    <Crown className="w-5 h-5 text-background" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="font-bold text-lg sm:text-xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent truncate">
                        {title}
                      </h1>
                      <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md bg-amber/15 text-amber border border-amber/30">
                        Admin
                      </span>
                    </div>
                    {description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <AccentColorPicker />
                  <ThemeToggle />
                </div>
              </div>
            </GlassCard>

            {/* Content */}
            <div>{children}</div>

            <p className="text-center text-muted-foreground text-xs mt-6">
              Admin Panel &copy; 2026 Jhonaley Panel
            </p>
          </div>
        </div>
      </PageTransition>
    </AppShell>
  );
};

export default AdminLayout;