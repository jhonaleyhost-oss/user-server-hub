import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Trash2, MessageCircle, Circle, CornerUpLeft, X, ImagePlus, Loader2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  user_id: string;
  content: string | null;
  created_at: string;
  reply_to_id: string | null;
  image_url: string | null;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

interface PresenceState {
  user_id: string;
  online_at: string;
}

const roleStyle = (role: string) => {
  switch (role) {
    case "admin":
      return "bg-amber/15 text-amber border-amber/30";
    case "reseller":
      return "bg-primary/15 text-primary border-primary/30";
    case "premium":
      return "bg-accent/15 text-accent border-accent/30";
    default:
      return "bg-secondary text-muted-foreground border-border";
  }
};

const roleLabel = (role: string) => {
  switch (role) {
    case "admin":
      return "Admin";
    case "reseller":
      return "Reseller";
    case "premium":
      return "Premium";
    default:
      return "Free";
  }
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
};

const Chat = () => {
  const { user, loading: authLoading } = useAuth();
  const { role } = useUserRole();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  // Hide Tidio chat widget on this page
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-hide-tidio", "true");
    style.innerHTML = `#tidio-chat, #tidio-chat-iframe, iframe[title*="Tidio"] { display: none !important; visibility: hidden !important; }`;
    document.head.appendChild(style);
    try {
      (window as any).tidioChatApi?.hide?.();
    } catch {}
    return () => {
      style.remove();
      try {
        (window as any).tidioChatApi?.show?.();
      } catch {}
    };
  }, []);

  // Load public profile info (name, avatar, role) for all users via RPC
  const refreshProfiles = async () => {
    const { data, error } = await supabase.rpc("get_public_users");
    if (error || !data) return;
    setProfiles((prev) => {
      const next = { ...prev };
      for (const p of data as Array<{
        user_id: string;
        full_name: string | null;
        avatar_url: string | null;
        role: string;
      }>) {
        next[p.user_id] = {
          user_id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          role: p.role,
        };
      }
      return next;
    });
  };

  // Fetch initial messages
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (error) {
        toast.error("Gagal memuat pesan");
        setLoading(false);
        return;
      }
      const ordered = (data ?? []).slice().reverse() as ChatMessage[];
      setMessages(ordered);
      await refreshProfiles();
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Realtime: messages, presence, typing
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("global-chat", {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (!profiles[m.user_id]) await refreshProfiles();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const old = payload.old as { id: string; image_url?: string | null };
          setMessages((prev) => prev.filter((m) => m.id !== old.id));
          if (old.image_url && old.image_url === lightbox) setLightbox(null);
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, PresenceState[]>;
        setOnlineUsers(new Set(Object.keys(state)));
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const uid = (payload as { user_id: string }).user_id;
        if (!uid || uid === user.id) return;
        setTypingUsers((prev) => ({ ...prev, [uid]: Date.now() }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    // Cleanup typing entries every 2s (3s timeout)
    const interval = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (now - v < 3000) next[k] = v;
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auto scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, typingUsers]);

  const sendTyping = () => {
    const now = Date.now();
    if (!channelRef.current || !user) return;
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user.id },
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const text = input.trim();
    if (!text || text.length > 2000) return;
    setSending(true);
    const { error } = await supabase
      .from("messages")
      .insert({ user_id: user.id, content: text, reply_to_id: replyTo?.id ?? null });
    setSending(false);
    if (error) {
      toast.error(error.message || "Gagal mengirim pesan");
      return;
    }
    setInput("");
    setReplyTo(null);
  };

  const handleImagePick = () => fileInputRef.current?.click();

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Hanya file foto yang diperbolehkan");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("chat-images").getPublicUrl(path);
      const { error: insErr } = await supabase.from("messages").insert({
        user_id: user.id,
        content: null,
        image_url: pub.publicUrl,
        reply_to_id: replyTo?.id ?? null,
      });
      if (insErr) throw insErr;
      setReplyTo(null);
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengunggah foto");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const target = messagesRef.current.find((m) => m.id === id);
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus pesan");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (lightbox && target?.image_url === lightbox) setLightbox(null);

    // Cleanup storage object so the photo file is also removed.
    if (target?.image_url) {
      const marker = "/storage/v1/object/public/chat-images/";
      const idx = target.image_url.indexOf(marker);
      if (idx !== -1) {
        const path = target.image_url.slice(idx + marker.length);
        await supabase.storage.from("chat-images").remove([path]).catch(() => {});
      }
    }
  };

  const typingNames = useMemo(() => {
    return Object.keys(typingUsers)
      .map((uid) => {
        const p = profiles[uid];
        return p?.full_name?.trim() || "Seseorang";
      })
      .slice(0, 3);
  }, [typingUsers, profiles]);

  const onlineCount = onlineUsers.size;

  const displayName = (uid: string) => {
    const p = profiles[uid];
    return p?.full_name?.trim() || "Pengguna";
  };

  const scrollToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    setTimeout(() => setHighlightId((curr) => (curr === id ? null : curr)), 1500);
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="p-3 sm:p-4 max-w-3xl mx-auto flex flex-col h-[calc(100svh-3.5rem)] md:h-svh">
          <GlassCard className="!rounded-3xl p-4 mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-foreground truncate">Chat Global</h1>
                <p className="text-xs text-muted-foreground truncate">
                  Ngobrol bareng semua pengguna
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/60 border border-border/50 shrink-0">
              <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
              <span className="text-xs font-semibold text-foreground">{onlineCount} online</span>
            </div>
          </GlassCard>

          <GlassCard className="!rounded-3xl flex-1 min-h-0 flex flex-col overflow-hidden">
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Memuat pesan...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-12">
                  <MessageCircle className="w-12 h-12 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Belum ada pesan. Jadilah yang pertama!
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.user_id === user?.id;
                  const p = profiles[m.user_id];
                  const name = displayName(m.user_id);
                  const online = onlineUsers.has(m.user_id);
                  const initial = name.charAt(0).toUpperCase();
                  const userRole = p?.role ?? "free";
                  const replied = m.reply_to_id
                    ? messages.find((x) => x.id === m.reply_to_id)
                    : null;
                  const repliedName = replied ? displayName(replied.user_id) : null;
                  return (
                    <div
                      key={m.id}
                      id={`msg-${m.id}`}
                      className={`flex items-end gap-2 transition-colors rounded-2xl -mx-1 px-1 py-0.5 ${
                        mine ? "flex-row-reverse" : "flex-row"
                      } ${highlightId === m.id ? "bg-primary/10" : ""}`}
                    >
                      <div className="relative shrink-0">
                        {p?.avatar_url ? (
                          <img
                            src={p.avatar_url}
                            alt={name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold">
                            {initial}
                          </div>
                        )}
                        {online && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                        )}
                      </div>
                      <div
                        className={`group max-w-[78%] flex flex-col ${
                          mine ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1.5 mb-0.5 px-1 ${
                            mine ? "flex-row-reverse" : ""
                          }`}
                        >
                          <span className="text-[11px] font-semibold text-foreground truncate max-w-[120px]">
                            {mine ? "Kamu" : name}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${roleStyle(
                              userRole
                            )}`}
                          >
                            {roleLabel(userRole)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatTime(m.created_at)}
                          </span>
                        </div>
                        <div
                          className={`relative px-3.5 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap border ${
                            mine
                              ? "bg-primary/20 text-foreground border-primary/30 rounded-br-md"
                              : "bg-secondary/60 text-foreground border-border/50 rounded-bl-md"
                          } ${m.image_url && !m.content ? "!p-1" : ""}`}
                        >
                          {replied && (
                            <button
                              type="button"
                              onClick={() => scrollToMessage(replied.id)}
                              className={`block w-full text-left mb-1.5 px-2 py-1 rounded-lg bg-background/40 border-l-2 border-primary/60 hover:bg-background/60 transition-colors ${
                                m.image_url && !m.content ? "mx-0" : ""
                              }`}
                            >
                              <div className="text-[10px] font-semibold text-primary truncate">
                                {repliedName}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {replied.content || (replied.image_url ? "📷 Foto" : "")}
                              </div>
                            </button>
                          )}
                          {!replied && m.reply_to_id && (
                            <div className="block mb-1.5 px-2 py-1 rounded-lg bg-background/40 border-l-2 border-muted text-[11px] text-muted-foreground italic">
                              Pesan asli sudah dihapus
                            </div>
                          )}
                          {m.image_url && (
                            <button
                              type="button"
                              onClick={() => setLightbox(m.image_url!)}
                              className="block overflow-hidden rounded-xl border border-border/40"
                            >
                              <img
                                src={m.image_url}
                                alt="foto"
                                loading="lazy"
                                className="max-w-[220px] max-h-[280px] object-cover w-auto h-auto"
                              />
                            </button>
                          )}
                          {m.content && (
                            <div className={m.image_url ? "mt-1.5 px-2 pb-1" : ""}>
                              {m.content}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setReplyTo(m);
                              setTimeout(() => inputRef.current?.focus(), 0);
                            }}
                            className={`absolute -top-2 w-6 h-6 rounded-full bg-secondary text-foreground border border-border/60 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shadow-md ${
                              mine ? "-left-9" : "-right-9"
                            }`}
                            aria-label="Balas pesan"
                          >
                            <CornerUpLeft className="w-3 h-3" />
                          </button>
                          {(mine || role === "admin") && (
                            <button
                              type="button"
                              onClick={() => handleDelete(m.id)}
                              className={`absolute -top-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shadow-md ${
                                mine ? "-left-2" : "-right-2"
                              }`}
                              aria-label={mine ? "Hapus pesan" : "Hapus pesan pengguna (admin)"}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {typingNames.length > 0 && (
                <div className="flex items-center gap-2 pl-10 text-xs text-muted-foreground">
                  <span className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce" />
                  </span>
                  <span className="truncate">
                    {typingNames.join(", ")} sedang mengetik...
                  </span>
                </div>
              )}
            </div>

            <div className="border-t border-border/50 bg-background/40">
              {replyTo && (
                <div className="flex items-center gap-2 px-3 pt-2">
                  <div className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-secondary/60 border-l-2 border-primary/60">
                    <div className="text-[10px] font-semibold text-primary truncate">
                      Membalas {displayName(replyTo.user_id)}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {replyTo.content}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="w-7 h-7 rounded-full bg-secondary/60 hover:bg-secondary flex items-center justify-center shrink-0"
                    aria-label="Batal balas"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <form onSubmit={handleSend} className="p-2.5 flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelected}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={handleImagePick}
                  disabled={uploading || !user}
                  className="h-11 w-11 rounded-full shrink-0"
                  aria-label="Kirim foto"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImagePlus className="w-4 h-4" />
                  )}
                </Button>
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    sendTyping();
                  }}
                  placeholder={replyTo ? "Tulis balasan..." : "Tulis pesan..."}
                  maxLength={2000}
                  className="flex-1 rounded-full h-11 bg-secondary/60 border-border/50"
                  disabled={sending || !user}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={sending || !input.trim()}
                  className="h-11 w-11 rounded-full shrink-0"
                  aria-label="Kirim"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </GlassCard>

          {lightbox && (
            <div
              onClick={() => setLightbox(null)}
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in"
            >
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-secondary/80 hover:bg-secondary flex items-center justify-center"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={lightbox}
                alt="foto"
                className="max-w-full max-h-full object-contain rounded-xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      </PageTransition>
    </AppShell>
  );
};

export default Chat;