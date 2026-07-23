import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Trash2, MessageCircle, Circle, CornerUpLeft, X, ImagePlus, Loader2, ArrowDown, Pencil, Check, CheckCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import VerifiedBadge from "@/components/VerifiedBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar, Server, Shield } from "lucide-react";

interface ChatMessage {
  id: string;
  user_id: string;
  content: string | null;
  created_at: string;
  reply_to_id: string | null;
  image_url: string | null;
  deleted?: boolean | null;
  deleted_by?: string | null;
  edited_at?: string | null;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  reseller_plan?: string | null;
  reseller_permanent?: boolean | null;
  panel_count?: number | null;
  created_at?: string | null;
}

interface PresenceState {
  user_id: string;
  online_at: string;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
};

const formatDayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Hari Ini";
  if (sameDay(d, yest)) return "Kemarin";
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString("id-ID", { weekday: "long" });
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
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
  const { onlineUserIds } = useOnlinePresence();
  const onlineUsers = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [pending, setPending] = useState<Array<{ id: string; file: File; preview: string }>>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ProfileLite | null>(null);
  const [showJumpBtn, setShowJumpBtn] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [reads, setReads] = useState<Record<string, string[]>>({});
  const [readersDialogFor, setReadersDialogFor] = useState<string | null>(null);
  const [readTick, setReadTick] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const atBottomRef = useRef<boolean>(true);
  const pageVisibleRef = useRef<boolean>(true);
  const markingRef = useRef<Set<string>>(new Set());
  const lastSentAtRef = useRef<number>(0);
  const MAX_FILES = 6;
  const MAX_SIZE = 5 * 1024 * 1024;
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = setTimeout(() => setCooldownLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldownLeft]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  // Load public profile info (name, avatar, role) for all users via RPC
  const refreshProfiles = async () => {
    const { data, error } = await supabase.rpc("get_public_users").range(0, 99999);
    if (error || !data) return;
    setTotalMembers((data as any[]).length);
    setProfiles((prev) => {
      const next = { ...prev };
      for (const p of data as Array<{
        user_id: string;
        full_name: string | null;
        avatar_url: string | null;
        role: string;
        reseller_plan?: string | null;
        reseller_permanent?: boolean | null;
        panel_count?: number | null;
        created_at?: string | null;
      }>) {
        next[p.user_id] = {
          user_id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          role: p.role,
          reseller_plan: p.reseller_plan ?? null,
          reseller_permanent: p.reseller_permanent ?? null,
          panel_count: Number(p.panel_count ?? 0),
          created_at: p.created_at ?? null,
        };
      }
      return next;
    });
  };

  // Fallback: fetch specific profiles by ids (used when a message's author
  // isn't in the RPC result, e.g. when PostgREST caps the RPC row count).
  const fetchProfilesByIds = async (ids: string[]) => {
    const missing = Array.from(new Set(ids)).filter((id) => id && !profiles[id]);
    if (!missing.length) return;
    const { data: profs, error } = await supabase.rpc("get_public_users_by_ids" as any, {
      _user_ids: missing,
    } as any);
    if (error) return;
    if (!profs) return;
    setProfiles((prev) => {
      const next = { ...prev };
      for (const p of profs as Array<any>) {
        next[p.user_id] = {
          user_id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          role: p.role ?? "free",
          reseller_plan: p.reseller_plan ?? null,
          reseller_permanent: !!p.reseller_permanent,
          panel_count: Number(p.panel_count ?? 0),
          created_at: p.created_at ?? null,
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
        toast.error("Gagal memuat pesan", { id: "chat-load-error" });
        setLoading(false);
        return;
      }
      const ordered = (data ?? []).slice().reverse() as ChatMessage[];
      setMessages(ordered);
      await refreshProfiles();
      await fetchProfilesByIds(ordered.map((m) => m.user_id));
      // Load existing reads for these messages
      const ids = ordered.map((m) => m.id);
      if (ids.length) {
        const { data: rd } = await supabase
          .from("message_reads")
          .select("message_id, user_id")
          .in("message_id", ids);
        if (rd) {
          const map: Record<string, string[]> = {};
          for (const r of rd as Array<{ message_id: string; user_id: string }>) {
            (map[r.message_id] ||= []).push(r.user_id);
          }
          setReads(map);
        }
      }
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
          if (!profiles[m.user_id]) {
            await fetchProfilesByIds([m.user_id]);
          }
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          if (updated.deleted && lightbox && payload.old && (payload.old as ChatMessage).image_url === lightbox) {
            setLightbox(null);
          }
        }
      )
      .on("presence", { event: "sync" }, () => {
        // presence handled globally via useOnlinePresence
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reads" },
        async (payload) => {
          const r = payload.new as { message_id: string; user_id: string };
          setReads((prev) => {
            const arr = prev[r.message_id] || [];
            if (arr.includes(r.user_id)) return prev;
            return { ...prev, [r.message_id]: [...arr, r.user_id] };
          });
          if (!profiles[r.user_id]) {
            await refreshProfiles();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        async () => {
          await refreshProfiles();
        }
      )
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

  // Auto-scroll when at bottom; otherwise leave position alone
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 120) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, typingUsers]);

  // After initial load, force scroll to bottom (twice — once immediately,
  // again after images settle so layout shifts don't leave us at the top).
  useEffect(() => {
    if (loading) return;
    const el = scrollRef.current;
    if (!el) return;
    const jump = () => {
      el.scrollTop = el.scrollHeight;
    };
    requestAnimationFrame(jump);
    const t = setTimeout(jump, 350);
    return () => clearTimeout(t);
  }, [loading]);

  // Track scroll position to show/hide jump-to-latest button
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const up = distanceFromBottom > 120;
      atBottomRef.current = !up;
      setShowJumpBtn(up);
      if (!up) setReadTick((t) => t + 1);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loading]);

  // Track page visibility
  useEffect(() => {
    const onVis = () => {
      pageVisibleRef.current = document.visibilityState === "visible" && document.hasFocus();
      if (pageVisibleRef.current) setReadTick((t) => t + 1);
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    window.addEventListener("blur", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.removeEventListener("blur", onVis);
    };
  }, []);

  // Compute unread messages (not mine, not yet read by me)
  const unreadIds = useMemo(() => {
    if (!user) return [] as string[];
    return messages
      .filter(
        (m) =>
          m.user_id !== user.id &&
          !m.deleted &&
          !(reads[m.id] || []).includes(user.id),
      )
      .map((m) => m.id);
  }, [messages, reads, user]);

  const unreadCount = unreadIds.length;

  // Auto-mark as read when at bottom + tab visible
  useEffect(() => {
    if (!user || unreadIds.length === 0) return;
    if (!atBottomRef.current || !pageVisibleRef.current) return;

    const toMark = unreadIds.filter((id) => !markingRef.current.has(id));
    if (toMark.length === 0) return;
    toMark.forEach((id) => markingRef.current.add(id));

    (async () => {
      const rows = toMark.map((id) => ({ message_id: id, user_id: user.id }));
      const { error } = await supabase
        .from("message_reads")
        .upsert(rows, { onConflict: "message_id,user_id", ignoreDuplicates: true });
      if (error) {
        toMark.forEach((id) => markingRef.current.delete(id));
        return;
      }
      setReads((prev) => {
        const next = { ...prev };
        for (const id of toMark) {
          const arr = next[id] || [];
          if (!arr.includes(user.id)) next[id] = [...arr, user.id];
        }
        return next;
      });
    })();
  }, [unreadIds, user, readTick]);

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

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

  const handleImagePick = () => fileInputRef.current?.click();

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !user) return;

    setPending((prev) => {
      const slotsLeft = MAX_FILES - prev.length;
      if (slotsLeft <= 0) {
        toast.error(`Maksimal ${MAX_FILES} foto sekaligus`);
        return prev;
      }
      const accepted: typeof prev = [];
      let rejectedType = 0;
      let rejectedSize = 0;
      for (const file of files.slice(0, slotsLeft)) {
        if (!file.type.startsWith("image/")) { rejectedType++; continue; }
        if (file.size > MAX_SIZE) { rejectedSize++; continue; }
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          preview: URL.createObjectURL(file),
        });
      }
      if (rejectedType) toast.error("Hanya file foto yang diperbolehkan");
      if (rejectedSize) toast.error("Ukuran foto maksimal 5 MB");
      if (files.length > slotsLeft) toast.error(`Hanya ${slotsLeft} foto pertama ditambahkan`);
      return [...prev, ...accepted];
    });
  };

  const removePending = (id: string) => {
    setPending((prev) => {
      const item = prev.find((x) => x.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((x) => x.id !== id);
    });
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const text = input.trim();
    if (!text && pending.length === 0) return;
    if (text.length > 2000) return;
    if (role !== "admin") {
      const now = Date.now();
      const elapsed = now - lastSentAtRef.current;
      if (elapsed < 5000) {
        const left = Math.ceil((5000 - elapsed) / 1000);
        toast.error(`Tunggu ${left}d sebelum kirim pesan lagi`);
        return;
      }
    }
    setSending(true);
    try {
      // Upload all pending images in parallel
      const uploads = await Promise.all(
        pending.map(async ({ file }) => {
          const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("chat-images")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from("chat-images").getPublicUrl(path);
          return pub.publicUrl;
        })
      );

      const replyId = replyTo?.id ?? null;
      const rows: Array<{
        user_id: string;
        content: string | null;
        image_url: string | null;
        reply_to_id: string | null;
      }> = [];

      if (uploads.length === 0) {
        rows.push({ user_id: user.id, content: text, image_url: null, reply_to_id: replyId });
      } else {
        // First image carries the caption (if any), rest are image-only — single batched insert
        uploads.forEach((url, idx) => {
          rows.push({
            user_id: user.id,
            content: idx === 0 ? (text || null) : null,
            image_url: url,
            reply_to_id: idx === 0 ? replyId : null,
          });
        });
      }

      const { error } = await supabase.from("messages").insert(rows);
      if (error) throw error;

      lastSentAtRef.current = Date.now();
      if (role !== "admin") {
        setCooldownLeft(5);
      }
      // Cleanup previews
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
      setInput("");
      setReplyTo(null);
    } catch (err: any) {
      const msg = String(err?.message || "");
      const friendly = /failed to fetch|networkerror|load failed/i.test(msg)
        ? "Tidak ada koneksi internet. Coba lagi setelah online."
        : msg || "Gagal mengirim pesan";
      toast.error(friendly, { id: "chat-send-error" });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    const target = messagesRef.current.find((m) => m.id === id);
    const { error } = await supabase
      .from("messages")
      .update({ deleted: true, content: null, image_url: null, deleted_by: user?.id ?? null })
      .eq("id", id);
    if (error) {
      toast.error("Gagal menghapus pesan");
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, deleted: true, content: null, image_url: null, deleted_by: user?.id ?? null } : m
      )
    );
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

  const startEdit = (m: ChatMessage) => {
    setEditingId(m.id);
    setEditingText(m.content ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const saveEdit = async () => {
    if (!editingId || !user) return;
    const text = editingText.trim();
    if (!text) {
      toast.error("Pesan tidak boleh kosong");
      return;
    }
    if (text.length > 2000) {
      toast.error("Pesan terlalu panjang");
      return;
    }
    const target = messagesRef.current.find((m) => m.id === editingId);
    if (target && target.content === text) {
      cancelEdit();
      return;
    }
    setSavingEdit(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("messages")
        .update({ content: text, edited_at: nowIso })
        .eq("id", editingId)
        .eq("user_id", user.id);
      if (error) throw error;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingId ? { ...m, content: text, edited_at: nowIso } : m,
        ),
      );
      cancelEdit();
    } catch (err: any) {
      const msg = String(err?.message || "");
      const friendly = /failed to fetch|networkerror|load failed/i.test(msg)
        ? "Tidak ada koneksi internet. Coba lagi setelah online."
        : msg || "Gagal mengedit pesan";
      toast.error(friendly, { id: "chat-edit-error" });
    } finally {
      setSavingEdit(false);
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
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/60 border border-border/70 shrink-0">
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
                messages.map((m, idx) => {
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
                  const prev = idx > 0 ? messages[idx - 1] : null;
                  const showDateSep =
                    !prev ||
                    new Date(prev.created_at).toDateString() !==
                      new Date(m.created_at).toDateString();
                  return (
                    <div key={m.id}>
                    {showDateSep && (
                      <div className="flex justify-center my-3">
                        <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-secondary/70 text-muted-foreground border border-border/60">
                          {formatDayLabel(m.created_at)}
                        </span>
                      </div>
                    )}
                    <div
                      id={`msg-${m.id}`}
                      className={`flex items-end gap-2 transition-colors rounded-2xl -mx-1 px-1 py-0.5 ${
                        mine ? "flex-row-reverse" : "flex-row"
                      } ${highlightId === m.id ? "bg-primary/10" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => !mine && p && setSelectedProfile(p)}
                        disabled={mine || !p}
                        className={`relative shrink-0 rounded-full ${
                          !mine && p ? "cursor-pointer hover:opacity-80 transition-opacity" : "cursor-default"
                        }`}
                        aria-label={!mine ? `Lihat profil ${name}` : undefined}
                      >
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
                      </button>
                      <div
                        className={`group max-w-[78%] min-w-0 flex flex-col ${
                          mine ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1.5 mb-0.5 px-1 ${
                            mine ? "flex-row-reverse" : ""
                          }`}
                        >
                          {mine ? (
                            <span className="text-[11px] font-semibold text-foreground truncate max-w-[120px]">
                              Kamu
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => p && setSelectedProfile(p)}
                              disabled={!p}
                              className="text-[11px] font-semibold text-foreground truncate max-w-[120px] hover:text-primary hover:underline transition-colors"
                            >
                              {name}
                            </button>
                          )}
                          <VerifiedBadge
                            role={userRole}
                            plan={p?.reseller_plan}
                            permanent={p?.reseller_permanent}
                            size={14}
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {formatTime(m.created_at)}
                          </span>
                          {m.edited_at && !m.deleted && (
                            <span className="text-[10px] italic text-muted-foreground">
                              diedit
                            </span>
                          )}
                          {mine && !m.deleted && (() => {
                            const readers = (reads[m.id] || []).filter((uid) => uid !== user?.id);
                            const totalOthers = Math.max(0, totalMembers - 1);
                            const allRead = totalOthers > 0 && readers.length >= totalOthers;
                            const someRead = readers.length > 0;
                            return (
                              <button
                                type="button"
                                onClick={() => readers.length > 0 && setReadersDialogFor(m.id)}
                                disabled={readers.length === 0}
                                className={`inline-flex items-center ${readers.length > 0 ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                                aria-label={
                                  allRead
                                    ? "Dibaca semua"
                                    : someRead
                                      ? `Dibaca ${readers.length} orang`
                                      : "Belum dibaca"
                                }
                                title={
                                  allRead
                                    ? "Dibaca semua"
                                    : someRead
                                      ? `Dibaca ${readers.length} orang`
                                      : "Terkirim"
                                }
                              >
                                {someRead ? (
                                  <CheckCheck className={`w-3.5 h-3.5 ${allRead ? "text-sky-500" : "text-muted-foreground"}`} />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-muted-foreground" />
                                )}
                              </button>
                            );
                          })()}
                        </div>
                        <div
                          className={`relative min-w-0 max-w-full px-3.5 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap border ${
                            mine
                              ? "bg-primary/20 text-foreground border-primary/40 rounded-br-md"
                              : userRole === "admin"
                                ? "bg-gradient-to-br from-amber-500/15 via-secondary/70 to-amber-500/10 text-foreground border-amber-400/60 rounded-bl-md shadow-[0_0_0_1px_rgba(251,191,36,0.3),0_4px_24px_-8px_rgba(251,191,36,0.45)] ring-1 ring-amber-400/25"
                                : "bg-secondary/60 text-foreground border-border/70 rounded-bl-md"
                          } ${m.image_url && !m.content ? "!p-1" : ""}`}
                        >
                          {m.deleted ? (
                            <div className="italic text-muted-foreground flex items-center gap-1.5">
                              <Trash2 className="w-3 h-3" />
                              <span>
                                {m.deleted_by && m.deleted_by !== m.user_id
                                  ? "Pesan telah dihapus oleh admin"
                                  : "Pesan ini telah dihapus"}
                              </span>
                            </div>
                          ) : (
                          <>
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
                                {replied.deleted
                                  ? (replied.deleted_by && replied.deleted_by !== replied.user_id
                                      ? "Pesan telah dihapus oleh admin"
                                      : "Pesan ini telah dihapus")
                                  : replied.content || (replied.image_url ? "📷 Foto" : "")}
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
                              className="block overflow-hidden rounded-xl border border-border/60"
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
                            editingId === m.id ? (
                              <div className={`flex flex-col gap-2 min-w-[200px] ${m.image_url ? "mt-1.5 px-2 pb-1" : ""}`}>
                                <textarea
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      saveEdit();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelEdit();
                                    }
                                  }}
                                  rows={2}
                                  maxLength={2000}
                                  autoFocus
                                  disabled={savingEdit}
                                  className="text-sm rounded-lg p-2 bg-background/70 text-foreground border border-border/60 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={cancelEdit}
                                    disabled={savingEdit}
                                    className="h-7 px-2 text-xs"
                                  >
                                    Batal
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={saveEdit}
                                    disabled={savingEdit || !editingText.trim()}
                                    className="h-7 px-2 text-xs"
                                  >
                                    {savingEdit ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <>
                                        <Check className="w-3 h-3 mr-1" /> Simpan
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className={m.image_url ? "mt-1.5 px-2 pb-1" : ""}>
                                {m.content}
                              </div>
                            )
                          )}
                          {editingId !== m.id && (
                            <div className="absolute -bottom-3 -right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyTo(m);
                                  setTimeout(() => inputRef.current?.focus(), 0);
                                }}
                                className="w-6 h-6 rounded-full bg-secondary text-foreground border border-border/80 flex items-center justify-center shadow-md"
                                aria-label="Balas pesan"
                              >
                                <CornerUpLeft className="w-3 h-3" />
                              </button>
                              {mine && m.content && (
                                <button
                                  type="button"
                                  onClick={() => startEdit(m)}
                                  className="w-6 h-6 rounded-full bg-secondary text-foreground border border-border/80 flex items-center justify-center shadow-md"
                                  aria-label="Edit pesan"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              {(mine || role === "admin") && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteTargetId(m.id)}
                                  className="w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md"
                                  aria-label={mine ? "Hapus pesan" : "Hapus pesan pengguna (admin)"}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                          </>
                          )}
                        </div>
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

            <div className="border-t border-border/70 bg-background/40">
              {showJumpBtn && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={jumpToLatest}
                    className="absolute -top-14 right-3 z-10 flex items-center gap-1.5 px-3 h-10 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all animate-in fade-in slide-in-from-bottom-2"
                    aria-label="Lompat ke pesan terbaru"
                  >
                    <ArrowDown className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="text-xs font-semibold">
                        {unreadCount} pesan baru
                      </span>
                    )}
                  </button>
                </div>
              )}
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
              {pending.length > 0 && (
                <div className="flex gap-2 overflow-x-auto px-3 pt-2 pb-1">
                  {pending.map((p) => (
                    <div
                      key={p.id}
                      className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/70 shrink-0 bg-secondary/40"
                    >
                      <img src={p.preview} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePending(p.id)}
                        disabled={sending}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90"
                        aria-label="Hapus foto"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleSend} className="p-2.5 flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelected}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={handleImagePick}
                  disabled={sending || !user || pending.length >= MAX_FILES}
                  className="h-11 w-11 rounded-full shrink-0"
                  aria-label="Kirim foto"
                >
                  <ImagePlus className="w-4 h-4" />
                </Button>
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    sendTyping();
                  }}
                  placeholder={
                    replyTo
                      ? "Tulis balasan..."
                      : pending.length > 0
                      ? "Tambah caption (opsional)..."
                      : "Tulis pesan..."
                  }
                  maxLength={2000}
                  className="flex-1 rounded-full h-11 bg-secondary/60 border-border/70"
                  disabled={sending || !user}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={sending || cooldownLeft > 0 || (!input.trim() && pending.length === 0)}
                  className="h-11 w-11 rounded-full shrink-0"
                  aria-label={cooldownLeft > 0 ? `Tunggu ${cooldownLeft}d` : "Kirim"}
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : cooldownLeft > 0 ? (
                    <span className="text-xs font-semibold tabular-nums">{cooldownLeft}</span>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
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

          <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => !o && setDeleteTargetId(null)}>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Yakin hapus pesan ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  Pesan yang sudah dihapus tidak bisa dikembalikan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (deleteTargetId) handleDelete(deleteTargetId);
                    setDeleteTargetId(null);
                  }}
                >
                  Hapus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={!!readersDialogFor} onOpenChange={(o) => !o && setReadersDialogFor(null)}>
            <DialogContent className="max-w-sm rounded-3xl">
              <DialogHeader>
                <DialogTitle>Dibaca oleh</DialogTitle>
              </DialogHeader>
              {readersDialogFor && (() => {
                const readers = (reads[readersDialogFor] || []).filter((uid) => uid !== user?.id);
                if (readers.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Belum ada yang membaca pesan ini.
                    </p>
                  );
                }
                return (
                  <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
                    {readers.map((uid) => {
                      const rp = profiles[uid];
                      const rname = rp?.full_name?.trim() || "Pengguna";
                      const rinitial = rname.charAt(0).toUpperCase();
                      return (
                        <button
                          key={uid}
                          type="button"
                          onClick={() => {
                            if (rp) {
                              setReadersDialogFor(null);
                              setSelectedProfile(rp);
                            }
                          }}
                          disabled={!rp}
                          className="w-full flex items-center gap-3 p-2 rounded-2xl bg-secondary/40 hover:bg-secondary/70 transition-colors text-left"
                        >
                          {rp?.avatar_url ? (
                            <img
                              src={rp.avatar_url}
                              alt={rname}
                              className="w-9 h-9 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {rinitial}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-foreground truncate">
                                {rname}
                              </span>
                              <VerifiedBadge
                                role={rp?.role ?? "free"}
                                plan={rp?.reseller_plan}
                                permanent={rp?.reseller_permanent}
                                size={12}
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground capitalize">
                              {rp?.role ?? "free"}
                            </p>
                          </div>
                          <CheckCheck className="w-4 h-4 text-sky-500 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>

          <Dialog open={!!selectedProfile} onOpenChange={(o) => !o && setSelectedProfile(null)}>
            <DialogContent className="max-w-sm rounded-3xl">
              <DialogHeader>
                <DialogTitle>Profil Pengguna</DialogTitle>
              </DialogHeader>
              {selectedProfile && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center text-center gap-3 pt-2">
                    {selectedProfile.avatar_url ? (
                      <img
                        src={selectedProfile.avatar_url}
                        alt={selectedProfile.full_name ?? "Pengguna"}
                        className="w-20 h-20 rounded-full object-cover border border-border/50"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white text-2xl">
                        {(selectedProfile.full_name?.trim() || "P").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="inline-flex items-center gap-1.5">
                        <p className="text-lg font-bold text-foreground">
                          {selectedProfile.full_name?.trim() || "Pengguna"}
                        </p>
                        <VerifiedBadge
                          role={selectedProfile.role}
                          plan={selectedProfile.reseller_plan}
                          permanent={selectedProfile.reseller_permanent}
                          size={18}
                        />
                      </div>
                      {onlineUsers.has(selectedProfile.user_id) && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-emerald-500">
                          <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                          <span className="font-semibold">Online sekarang</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-secondary/60 to-secondary/20 border border-white/5 shadow-inner">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Server className="w-4 h-4 text-primary" />
                        Panel Dibuat
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {selectedProfile.panel_count ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-secondary/60 to-secondary/20 border border-white/5 shadow-inner">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Shield className="w-4 h-4 text-accent" />
                        Role
                      </div>
                      <span className="text-sm font-semibold text-foreground capitalize">
                        {selectedProfile.role}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-secondary/60 to-secondary/20 border border-white/5 shadow-inner">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 text-amber" />
                        Bergabung
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {selectedProfile.created_at
                          ? new Date(selectedProfile.created_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </PageTransition>
    </AppShell>
  );
};

export default Chat;