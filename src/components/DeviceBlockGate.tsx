import { useEffect, useState, useCallback } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { ShieldBan, Send, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

const CACHE_KEY = 'device_blocked_reason';

interface BlockState {
  reason: string | null;
}

async function fetchDeviceBlockStatus(): Promise<BlockState | null> {
  let fingerprint: string | null = null;
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    fingerprint = result.visitorId;
  } catch {
    // fingerprint gagal — tetap cek via IP di server
  }

  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-device`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.blocked) return { reason: data.reason ?? null };
    return null;
  } catch {
    return null;
  }
}

const DeviceBlockGate = () => {
  const { user, signOut } = useAuth();
  const [blocked, setBlocked] = useState<BlockState | null>(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) return { reason: cached || null };
    } catch {
      /* ignore */
    }
    return null;
  });
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      const result = await fetchDeviceBlockStatus();
      if (result) {
        try {
          sessionStorage.setItem(CACHE_KEY, result.reason ?? '');
        } catch {
          /* ignore */
        }
        setBlocked(result);
        if (user) {
          await signOut().catch(() => {});
        }
      } else {
        try {
          sessionStorage.removeItem(CACHE_KEY);
        } catch {
          /* ignore */
        }
        setBlocked(null);
      }
    } finally {
      setChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Cek saat mount & setiap kali sesi user berubah (mis. baru login)
  useEffect(() => {
    void check();
  }, [check]);

  // Cek ulang berkala (tiap 5 menit) agar blokir baru langsung aktif
  useEffect(() => {
    const t = setInterval(() => void check(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [check]);

  if (!blocked) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 sm:p-8 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center mx-auto mb-5">
          <ShieldBan className="w-8 h-8 text-destructive" />
        </div>

        <h1 className="text-xl font-bold text-foreground mb-2">
          Perangkat Diblokir
        </h1>
        <p className="text-sm text-muted-foreground mb-5">
          Perangkat/jaringan ini diblokir karena terkait dengan akun yang
          di-suspend. Kamu tidak bisa login atau membuat akun baru dari
          perangkat ini.
        </p>

        {blocked.reason && (
          <div className="rounded-xl border border-border bg-secondary/40 p-4 mb-5 text-left">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Alasan
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {blocked.reason}
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          <Button
            className="w-full"
            onClick={() =>
              window.open('https://t.me/jhonaleystorecs', '_blank')
            }
          >
            <Send className="w-4 h-4 mr-2" />
            Hubungi CS Telegram
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={checking}
            onClick={() => void check()}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`}
            />
            {checking ? 'Memeriksa...' : 'Cek Ulang Status'}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground mt-5">
          Merasa ini kesalahan? Hubungi CS dengan menyertakan email akun kamu.
        </p>
      </div>
    </div>
  );
};

export default DeviceBlockGate;
