import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Lock, Upload, Save, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import GlassCard from "@/components/GlassCard";
import { PageTransition } from "@/components/PageTransition";

export default function Profile() {
  const { user } = useAuth();
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
    if (!fullName.trim()) {
      toast.error("Username tidak boleh kosong");
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        avatar_url: avatarUrl || null,
      })
      .eq("user_id", user.id);
    setSavingProfile(false);
    if (error) toast.error("Gagal menyimpan: " + error.message);
    else {
      window.dispatchEvent(new Event("profile:updated"));
      toast.success("Profil berhasil diperbarui");
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
    }
  };

  const handleSaveEmail = async () => {
    if (!email.trim() || email === user?.email) {
      toast.error("Masukkan email baru yang berbeda");
      return;
    }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setSavingEmail(false);
    if (error) toast.error("Gagal: " + error.message);
    else toast.success("Cek email baru kamu untuk konfirmasi");
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
    }
  };

  const initial = (fullName || email || "U").charAt(0).toUpperCase();

  return (
    <AppShell>
      <PageTransition>
        <div className="max-w-2xl mx-auto space-y-6 pb-8">
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
        </div>
      </PageTransition>
    </AppShell>
  );
}