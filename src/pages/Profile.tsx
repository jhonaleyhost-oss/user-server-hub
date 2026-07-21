import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Lock, Upload, Save, Loader2, Trash2, Clock, Infinity as InfinityIcon, Crown, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useResellerStatus, formatResellerRemaining, formatExpiryDate } from "@/hooks/useResellerStatus";
import { useUserRole } from "@/hooks/useUserRole";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import GlassCard from "@/components/GlassCard";
import { PageTransition } from "@/components/PageTransition";

export default function Profile() {
  const { user } = useAuth();
  const { role, isAdmin } = useUserRole();
  const { status: resellerStatus } = useResellerStatus();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);
  const [emailConfirmPassword, setEmailConfirmPassword] = useState("");

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name ?? "");
        setAvatarUrl(data?.avatar_url ?? "");
        setLoading(false);
      });
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    const newName = fullName.trim();
    if (!newName) {
      toast.error("Username tidak boleh kosong");
      return;
    }
    setSavingProfile(true);
    const oldName = (await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()).data?.full_name ?? "";
    if (newName.toLowerCase() !== oldName.toLowerCase()) {
      const { data: taken } = await supabase.rpc("is_name_taken", { _name: newName });
      if (taken) {
        setSavingProfile(false);
        toast.error("Nama sudah terpakai, silakan pilih nama lain");
        return;
      }
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: newName,
        avatar_url: avatarUrl || null,
      })
      .eq("user_id", user.id);
    setSavingProfile(false);
    if (error) {
      if ((error as any).code === "23505" || /unique/i.test(error.message)) {
        toast.error("Nama sudah terpakai, silakan pilih nama lain");
      } else {
        toast.error("Gagal menyimpan: " + error.message);
      }
    } else {
      window.dispatchEvent(new Event("profile:updated"));
      toast.success("Profil berhasil diperbarui");
      if (oldName !== newName) {
        const { error: logErr } = await supabase.from("user_activity_logs").insert({
          user_id: user.id,
          action: "update_username",
          detail: "Mengubah username",
          old_value: oldName,
          new_value: newName,
        });
        if (logErr) console.error("log username err:", logErr);
      }
    }
  };

  const handleUploadAvatar = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Maksimal 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);
      if (dbErr) throw dbErr;

      setAvatarUrl(publicUrl);
      window.dispatchEvent(new Event("profile:updated"));
      toast.success("Foto profil berhasil diunggah");
      const { error: logErr } = await supabase.from("user_activity_logs").insert({
        user_id: user.id,
        action: "update_avatar",
        detail: "Mengubah foto profil",
        new_value: publicUrl,
      });
      if (logErr) console.error("log avatar err:", logErr);
    } catch (err: any) {
      toast.error("Gagal upload: " + (err.message || "unknown"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setUploading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("user_id", user.id);
    setUploading(false);
    if (error) toast.error("Gagal: " + error.message);
    else {
      setAvatarUrl("");
      window.dispatchEvent(new Event("profile:updated"));
      toast.success("Foto profil dihapus");
      const { error: logErr } = await supabase.from("user_activity_logs").insert({
        user_id: user.id,
        action: "remove_avatar",
        detail: "Menghapus foto profil",
      });
      if (logErr) console.error("log remove avatar err:", logErr);
    }
  };

  const handleSaveEmail = () => {
    if (!email.trim() || email === user?.email) {
      toast.error("Masukkan email baru yang berbeda");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Format email tidak valid");
      return;
    }
    setEmailConfirmPassword("");
    setEmailConfirmOpen(true);
  };

  const confirmEmailChange = async () => {
    if (!user?.email) return;
    if (!emailConfirmPassword) {
      toast.error("Masukkan password kamu");
      return;
    }
    setSavingEmail(true);
    const oldEmail = user.email;
    // Verify password by re-authenticating
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: oldEmail,
      password: emailConfirmPassword,
    });
    if (signInErr) {
      setSavingEmail(false);
      toast.error("Password salah");
      return;
    }
    const { error } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: `${window.location.origin}/profile` }
    );
    setSavingEmail(false);
    if (error) {
      toast.error("Gagal: " + error.message);
      return;
    }
    setEmailConfirmOpen(false);
    setEmailConfirmPassword("");
    toast.success("Cek email baru kamu untuk konfirmasi");
    const { error: logErr } = await supabase.from("user_activity_logs").insert({
      user_id: user.id,
      action: "update_email",
      detail: "Meminta perubahan email",
      old_value: oldEmail,
      new_value: email.trim(),
    });
    if (logErr) console.error("log email err:", logErr);
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) toast.error("Gagal: " + error.message);
    else {
      toast.success("Password berhasil diubah");
      setNewPassword("");
      setConfirmPassword("");
      if (user) {
        const { error: logErr } = await supabase.from("user_activity_logs").insert({
          user_id: user.id,
          action: "update_password",
          detail: "Mengubah password",
        });
        if (logErr) console.error("log password err:", logErr);
      }
    }
  };

  const initial = (fullName || email || "U").charAt(0).toUpperCase();

  return (
    <AppShell>
      <PageTransition>
        <div className="max-w-2xl mx-auto space-y-6 pb-8 px-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1"
          >
            <h1 className="text-2xl font-bold text-foreground">Profil Saya</h1>
            <p className="text-sm text-muted-foreground">
              Kelola informasi akun, email, dan password kamu.
            </p>
          </motion.div>

          {/* Avatar preview + Profile form */}
          <GlassCard className="p-5 space-y-5">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover border border-border/50 shadow-md"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white text-2xl shadow-md">
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {fullName || "Belum ada username"}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2 text-xs">
                <User className="w-3.5 h-3.5" /> Username
              </Label>
              <Input
                id="username"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Masukkan username"
                disabled={loading}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs">
                <Upload className="w-3.5 h-3.5" /> Foto Profil
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadAvatar(f);
                }}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || loading}
                  className="flex-1 h-11 gap-2"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {avatarUrl ? "Ganti Foto" : "Upload Foto"}
                </Button>
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemoveAvatar}
                    disabled={uploading || loading}
                    className="h-11 gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                JPG / PNG / WEBP, maksimal 5 MB.
              </p>
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile || loading}
              className="w-full h-11 gap-2"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Profil
            </Button>
          </GlassCard>

          {/* Masa Aktif / Membership */}
          {(resellerStatus?.is_reseller || isAdmin) && (
            <GlassCard className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber" />
                <h2 className="font-semibold text-foreground">Masa Aktif Membership</h2>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border/40">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                  {isAdmin || resellerStatus?.permanent ? (
                    <InfinityIcon className="w-5 h-5 text-white" />
                  ) : (
                    <Clock className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground capitalize">
                    {role} —{" "}
                    <span className={
                      !isAdmin && !resellerStatus?.permanent && (resellerStatus?.days_left ?? 99) <= 2
                        ? "text-destructive"
                        : "text-primary"
                    }>
                      {isAdmin ? "Permanen" : formatResellerRemaining(resellerStatus)}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {isAdmin || resellerStatus?.permanent
                      ? "Akses penuh tanpa batas waktu."
                      : `Berakhir ${formatExpiryDate(resellerStatus?.expires_at ?? null)}`}
                  </p>
                </div>
              </div>
              {!isAdmin && !resellerStatus?.permanent && (
                <Link to="/upgrade">
                  <Button variant="outline" className="w-full h-11 gap-2">
                    <Crown className="w-4 h-4" />
                    Perpanjang Masa Aktif
                  </Button>
                </Link>
              )}
            </GlassCard>
          )}

          {/* Email */}
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Ubah Email</h2>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@domain.com"
                className="h-11"
              />
              <p className="text-[11px] text-muted-foreground">
                Konfirmasi akan dikirim ke email baru.
              </p>
            </div>
            <Button
              onClick={handleSaveEmail}
              disabled={savingEmail}
              variant="outline"
              className="w-full h-11 gap-2"
            >
              {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Update Email
            </Button>
          </GlassCard>

          {/* Password */}
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber" />
              <h2 className="font-semibold text-foreground">Ubah Password</h2>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newpass" className="text-xs">Password Baru</Label>
              <Input
                id="newpass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confpass" className="text-xs">Konfirmasi Password</Label>
              <Input
                id="confpass"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="h-11"
              />
            </div>
            <Button
              onClick={handleSavePassword}
              disabled={savingPassword}
              variant="outline"
              className="w-full h-11 gap-2"
            >
              {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Update Password
            </Button>
          </GlassCard>

          {/* Logout */}
          <GlassCard className="p-5 space-y-4 border-rose-500/20">
            <div className="flex items-center gap-2">
              <LogOut className="w-4 h-4 text-rose-400" />
              <h2 className="font-semibold text-foreground">Keluar Akun</h2>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Logout dari perangkat ini. Kamu bisa masuk kembali kapan saja.
            </p>
            <Button
              onClick={handleLogout}
              disabled={loggingOut}
              variant="outline"
              className="w-full h-11 gap-2 text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
            >
              {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              Log Out
            </Button>
          </GlassCard>
        </div>
      </PageTransition>

      <Dialog open={emailConfirmOpen} onOpenChange={(o) => { setEmailConfirmOpen(o); if (!o) setEmailConfirmPassword(""); }}>
        <DialogContent className="bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Konfirmasi Password
            </DialogTitle>
            <DialogDescription>
              Untuk keamanan, masukkan password kamu sebelum mengubah email
              dari <span className="font-semibold text-foreground">{user?.email}</span> ke{" "}
              <span className="font-semibold text-primary">{email}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-pass" className="text-xs">Password kamu</Label>
            <Input
              id="confirm-pass"
              type="password"
              value={emailConfirmPassword}
              onChange={(e) => setEmailConfirmPassword(e.target.value)}
              placeholder="Masukkan password saat ini"
              className="h-11"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && !savingEmail) confirmEmailChange(); }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setEmailConfirmOpen(false)}
              disabled={savingEmail}
              className="h-11"
            >
              Batal
            </Button>
            <Button
              onClick={confirmEmailChange}
              disabled={savingEmail || !emailConfirmPassword}
              className="h-11 gap-2"
            >
              {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Konfirmasi & Kirim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}