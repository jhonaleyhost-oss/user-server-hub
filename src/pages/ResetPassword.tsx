import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, KeyRound, CheckCircle2 } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import GlassCard from '@/components/GlassCard';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import AccentColorPicker from '@/components/AccentColorPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const completedRef = useState({ done: false })[0];
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Mark recovery mode so the rest of the app treats user as logged out.
    // Stored in localStorage so closing the tab without finishing still
    // forces a sign-out on next visit (prevents account hijack via stale recovery session).
    localStorage.setItem('pwd_recovery', '1');

    // Recovery flow: Supabase sets a session from URL hash automatically
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
      setChecking(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
      // If user navigated away without completing the reset, sign out
      // so the recovery session cannot be reused to access the account.
      if (!completedRef.done) {
        localStorage.removeItem('pwd_recovery');
        supabase.auth.signOut().catch(() => {});
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Password Terlalu Pendek',
        description: 'Password minimal 6 karakter.',
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Password Tidak Cocok',
        description: 'Konfirmasi password tidak sesuai.',
      });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Gagal Reset Password',
          description: error.message,
        });
      } else {
        completedRef.done = true;
        localStorage.removeItem('pwd_recovery');
        toast({
          title: 'Password Berhasil Direset',
          description: 'Silakan login dengan password baru Anda.',
        });
        await supabase.auth.signOut();
        navigate('/auth');
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Terjadi kesalahan. Silakan coba lagi.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <AccentColorPicker />
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center mb-8"
          >
            <Logo size="lg" />
          </motion.div>

          <GlassCard className="p-8" delay={0.1}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
                <KeyRound className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Reset Password
              </h1>
              <p className="text-muted-foreground text-sm">
                Buat password baru untuk akun Anda
              </p>
            </div>

            {checking ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Memverifikasi link...
              </div>
            ) : !hasSession ? (
              <div className="text-center py-4">
                <p className="text-sm text-destructive mb-4">
                  Link reset password tidak valid atau sudah kedaluwarsa.
                </p>
                <Button onClick={() => navigate('/auth')} className="btn-primary">
                  Kembali ke Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-sm font-medium text-muted-foreground">
                    Password Baru
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="input-glass pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-sm font-medium text-muted-foreground">
                    Konfirmasi Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="input-glass pl-10"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Simpan Password Baru</span>
                    </>
                  )}
                </Button>
              </form>
            )}
          </GlassCard>

          <p className="text-center text-muted-foreground text-xs mt-8">
            &copy; 2026 Jhonaley Panel. All Rights Reserved.
          </p>
        </div>
      </div>
    </PageTransition>
  );
};

export default ResetPassword;