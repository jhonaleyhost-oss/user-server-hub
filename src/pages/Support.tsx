import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, ImagePlus, Loader2, ArrowLeft, MessageCircle, LifeBuoy, X, Pencil, Check } from "lucide-react";
import AppShell from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import VerifiedBadge from "@/components/VerifiedBadge";

interface SupportMessage {
  id: string;
  thread_user_id: string;
  sender_role: "user" | "admin";
  content: string | null;
  image_url: string | null;
  created_at: string;
  edited_at?: string | null;
  sender_user_id?: string | null;
}

interface Thread {
  thread_user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  last_message: string;
  last_message_at: string;
  last_sender_role: string;
  unread_admin: number;
  reseller_plan?: string | null;
  reseller_permanent?: boolean | null;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

// Convert stored image_url (raw path OR legacy public URL) to a fresh signed URL.
const extractPath = (val: string): string | null => {
  if (!val) return null;
  if (!val.startsWith("http")) return val;
  const marker = "/support-media/";
  const i = val.indexOf(marker);
  if (i === -1) return null;
  return val.substring(i + marker.length).split("?")[0];
};

const SupportImage = ({ value }: { value: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const path = extractPath(value);
    if (!path) return;
    supabase.storage
      .from("support-media")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [value]);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt="lampiran" className="rounded-lg mb-1 max-h-64 object-cover" />
    </a>
  );
};

const Support = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [planMap, setPlanMap] = useState<Record<string, { plan: string | null; permanent: boolean }>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.rpc("get_public_users").then(({ data }) => {
      if (!data) return;
      const map: Record<string, { plan: string | null; permanent: boolean }> = {};
      for (const u of data as Array<{
        user_id: string;
        reseller_plan: string | null;
        reseller_permanent: boolean;
      }>) {
        map[u.user_id] = {
          plan: u.reseller_plan ?? null,
          permanent: !!u.reseller_permanent,
        };
      }
      setPlanMap(map);
    });
  }, [isAdmin]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // For regular users, thread = own user id
  useEffect(() => {
    if (!user || roleLoading) return;
    if (!isAdmin) setActiveThread(user.id);
  }, [user, isAdmin, roleLoading]);

  // Load thread list (admin only)
  const loadThreads = useCallback(async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase.rpc("get_support_threads");
    if (error) {
      toast.error("Gagal memuat percakapan");
      return;
    }
    setThreads((data as Thread[]) || []);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) loadThreads();
  }, [isAdmin, loadThreads]);

  // Load messages for active thread
  useEffect(() => {
    if (!activeThread) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("support_messages")
      .select("*")
      .eq("thread_user_id", activeThread)
      .order("created_at", { ascending: true })
      .limit(500)
      .then(({ data, error }) => {
        if (error) toast.error("Gagal memuat pesan");
        else setMessages((data as SupportMessage[]) || []);
        setLoading(false);
      });
  }, [activeThread]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("support-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload) => {
          const m = payload.new as SupportMessage;
          if (m.thread_user_id === activeThread) {
            setMessages((prev) =>
              prev.some((p) => p.id === m.id) ? prev : [...prev, m],
            );
          }
          if (isAdmin) loadThreads();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_messages" },
        (payload) => {
          const m = payload.new as SupportMessage;
          if (m.thread_user_id === activeThread) {
            setMessages((prev) => prev.map((p) => (p.id === m.id ? { ...p, ...m } : p)));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeThread, isAdmin, loadThreads]);

  // Auto-scroll
  useEffect(() => {
    if (loading) return;
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });
  }, [messages.length, loading, activeThread]);

  // Mark as read
  useEffect(() => {
    if (!activeThread || !user) return;
    if (isAdmin) {
      supabase
        .from("support_messages")
        .update({ read_by_admin: true })
        .eq("thread_user_id", activeThread)
        .eq("read_by_admin", false)
        .then(() => loadThreads());
    } else {
      supabase
        .from("support_messages")
        .update({ read_by_user: true })
        .eq("thread_user_id", user.id)
        .eq("sender_role", "admin")
        .eq("read_by_user", false);
    }
  }, [activeThread, isAdmin, user, messages.length, loadThreads]);

  const handlePickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Foto maks 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadImage = async (uid: string): Promise<string | null> => {
    if (!imageFile) return null;
    const ext = imageFile.name.split(".").pop() || "jpg";
    const path = `${uid}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("support-media")
      .upload(path, imageFile, { contentType: imageFile.type });
    if (error) {
      toast.error("Gagal upload foto");
      return null;
    }
    // Bucket privat — simpan path mentah, render pakai signed URL
    return path;
  };

  const handleSend = async () => {
    if (!user || sending) return;
    const text = input.trim();
    if (!text && !imageFile) return;
    setSending(true);
    try {
      if (isAdmin) {
        if (!activeThread) return;
        const imageUrl = await uploadImage(activeThread);
        const { error } = await supabase.from("support_messages").insert({
          thread_user_id: activeThread,
          sender_user_id: user.id,
          sender_role: "admin",
          content: text || null,
          image_url: imageUrl,
          read_by_admin: true,
        });
        if (error) throw error;
      } else {
        const imageUrl = await uploadImage(user.id);
        // Call edge function to forward to Telegram
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const { data: sess } = await supabase.auth.getSession();
        const res = await fetch(`${supabaseUrl}/functions/v1/support-send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${sess.session?.access_token}`,
          },
          body: JSON.stringify({ content: text, image_url: imageUrl }),
        });
        const j = await res.json();
        if (!res.ok || !j.success) throw new Error(j.error || "Gagal kirim");
      }
      setInput("");
      clearImage();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim");
    } finally {
      setSending(false);
    }
  };

  const startEdit = (m: SupportMessage) => {
    setEditingId(m.id);
    setEditingText(m.content || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const text = editingText.trim();
    if (!text) {
      toast.error("Pesan tidak boleh kosong");
      return;
    }
    const id = editingId;
    const { error } = await supabase
      .from("support_messages")
      .update({ content: text, edited_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Gagal mengedit pesan");
      return;
    }
    setMessages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, content: text, edited_at: new Date().toISOString() } : p,
      ),
    );
    cancelEdit();
  };

  if (authLoading || roleLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const activeMeta = threads.find((t) => t.thread_user_id === activeThread);

  return (
    <AppShell>
      <PageTransition>
        <div className="p-3 sm:p-6 max-w-6xl mx-auto">
          <div className="mb-4 flex items-center gap-3">
            <LifeBuoy className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Support</h1>
              <p className="text-xs text-muted-foreground">
                {isAdmin
                  ? "Kelola keluhan dari pengguna"
                  : "Kirim keluhan / pertanyaan ke admin"}
              </p>
            </div>
          </div>

          <div className={`grid gap-4 ${isAdmin ? "md:grid-cols-[320px_1fr]" : ""}`}>
            {/* Thread list (admin) */}
            {isAdmin && (
              <GlassCard
                className={`p-0 overflow-hidden ${activeThread ? "hidden md:block" : ""}`}
              >
                <div className="p-3 border-b border-border/40">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Percakapan ({threads.length})
                  </p>
                </div>
                <div className="max-h-[70vh] overflow-y-auto">
                  {threads.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Belum ada percakapan.
                    </div>
                  ) : (
                    threads.map((t) => (
                      <button
                        key={t.thread_user_id}
                        onClick={() => setActiveThread(t.thread_user_id)}
                        className={`w-full text-left p-3 border-b border-border/30 hover:bg-secondary/50 transition-colors flex gap-3 ${
                          activeThread === t.thread_user_id ? "bg-secondary/60" : ""
                        }`}
                      >
                        {t.avatar_url ? (
                          <img
                            src={t.avatar_url}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shrink-0">
                            {(t.full_name || t.email || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold truncate">
                              {t.full_name || t.email?.split("@")[0]}
                            </p>
                            {t.unread_admin > 0 && (
                              <span className="text-[10px] bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 font-bold shrink-0">
                                {t.unread_admin}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {t.last_sender_role === "admin" ? "Kamu: " : ""}
                            {t.last_message || "—"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <VerifiedBadge
                              role={t.role}
                              plan={planMap[t.thread_user_id]?.plan}
                              permanent={planMap[t.thread_user_id]?.permanent}
                              size={14}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {formatTime(t.last_message_at)}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </GlassCard>
            )}

            {/* Chat panel */}
            {(!isAdmin || activeThread) && (
              <GlassCard className="p-0 overflow-hidden flex flex-col h-[75vh]">
                {/* Header */}
                <div className="p-3 border-b border-border/40 flex items-center gap-3 shrink-0">
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden h-8 w-8"
                      onClick={() => setActiveThread(null)}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  )}
                  {isAdmin && activeMeta ? (
                    <>
                      {activeMeta.avatar_url ? (
                        <img
                          src={activeMeta.avatar_url}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
                          {(activeMeta.full_name || activeMeta.email || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {activeMeta.full_name || activeMeta.email?.split("@")[0]}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {activeMeta.email}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold">Chat dengan Admin</p>
                      <p className="text-[11px] text-muted-foreground">
                        Biasanya dibalas dalam beberapa jam
                      </p>
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-background/30">
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      Belum ada pesan. Mulai percakapan!
                    </div>
                  ) : (
                    messages.map((m) => {
                      const mine = isAdmin
                        ? m.sender_role === "admin"
                        : m.sender_role === "user";
                      const isEditing = editingId === m.id;
                      return (
                        <div
                          key={m.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`group relative max-w-[80%] rounded-2xl px-3 py-2 ${
                              mine
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-secondary text-foreground rounded-bl-sm"
                            }`}
                          >
                            {m.image_url && <SupportImage value={m.image_url} />}
                            {isEditing ? (
                              <div className="flex flex-col gap-2 min-w-[200px]">
                                <textarea
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  rows={2}
                                  className="text-sm rounded-md p-2 bg-background/80 text-foreground border border-border resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                                  autoFocus
                                />
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={cancelEdit}
                                    className="h-7 px-2 text-xs"
                                  >
                                    Batal
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={saveEdit}
                                    className="h-7 px-2 text-xs"
                                  >
                                    <Check className="w-3 h-3 mr-1" /> Simpan
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              m.content && (
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {m.content}
                              </p>
                              )
                            )}
                            {!isEditing && (
                              <div
                                className={`flex items-center gap-1.5 mt-1 ${
                                  mine ? "justify-end" : "justify-start"
                                }`}
                              >
                                <p
                                  className={`text-[10px] ${
                                    mine
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {formatTime(m.created_at)}
                                </p>
                                {m.edited_at && (
                                  <span
                                    className={`text-[10px] italic ${
                                      mine
                                        ? "text-primary-foreground/70"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    · diedit
                                  </span>
                                )}
                                {mine && m.content && (
                                  <button
                                    onClick={() => startEdit(m)}
                                    className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                                      mine
                                        ? "text-primary-foreground/70 hover:text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                    title="Edit pesan"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                {/* Composer */}
                <div className="border-t border-border/40 p-2 shrink-0 bg-background/50">
                  {imagePreview && (
                    <div className="relative inline-block mb-2 ml-1">
                      <img
                        src={imagePreview}
                        alt=""
                        className="h-16 w-16 object-cover rounded-lg border border-border"
                      />
                      <button
                        onClick={clearImage}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePickImage}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-10 w-10 shrink-0"
                      disabled={sending}
                    >
                      <ImagePlus className="w-4 h-4" />
                    </Button>
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Tulis pesan..."
                      disabled={sending}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={sending || (!input.trim() && !imageFile)}
                      size="icon"
                      className="h-10 w-10 shrink-0"
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </PageTransition>
    </AppShell>
  );
};

export default Support;