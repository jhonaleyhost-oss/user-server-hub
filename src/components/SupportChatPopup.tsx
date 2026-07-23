import { useCallback, useEffect, useRef, useState } from "react";
import { Send, ImagePlus, Loader2, X, MessageCircle, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SupportMessage {
  id: string;
  thread_user_id: string;
  sender_role: "user" | "admin";
  content: string | null;
  image_url: string | null;
  created_at: string;
  edited_at?: string | null;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

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
      <img src={url} alt="lampiran" className="rounded-lg mb-1 max-h-48 object-cover" />
    </a>
  );
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SupportChatPopup({ open, onClose }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("support_messages")
      .select("*")
      .eq("thread_user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) toast.error("Gagal memuat pesan");
    else setMessages((data as SupportMessage[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;
    loadMessages();
  }, [open, user, loadMessages]);

  // Realtime
  useEffect(() => {
    if (!open || !user) return;
    const channel = supabase
      .channel(`support-popup-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_user_id=eq.${user.id}` },
        (payload) => {
          const m = payload.new as SupportMessage;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_messages", filter: `thread_user_id=eq.${user.id}` },
        (payload) => {
          const m = payload.new as SupportMessage;
          setMessages((prev) => prev.map((p) => (p.id === m.id ? { ...p, ...m } : p)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, user]);

  useEffect(() => {
    if (!open || loading) return;
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });
  }, [messages.length, loading, open]);

  // Mark as read
  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("support_messages")
      .update({ read_by_user: true })
      .eq("thread_user_id", user.id)
      .eq("sender_role", "admin")
      .eq("read_by_user", false)
      .then(() => {});
  }, [open, user, messages.length]);

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
    return path;
  };

  const handleSend = async () => {
    if (!user || sending) return;
    const text = input.trim();
    if (!text && !imageFile) return;
    setSending(true);
    try {
      const imageUrl = await uploadImage(user.id);
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

  if (!open) return null;

  return (
    <div
      className="fixed z-50 bottom-24 right-4 sm:right-5 w-[calc(100vw-2rem)] sm:w-[380px] max-w-[380px] animate-in fade-in slide-in-from-bottom-4 duration-200"
      role="dialog"
      aria-label="Live Chat Support"
    >
      <div className="flex flex-col rounded-2xl border border-border/70 bg-background shadow-2xl shadow-primary/30 overflow-hidden h-[70vh] max-h-[560px]">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 bg-gradient-to-r from-primary to-accent text-white shrink-0">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight">Live Chat Support</p>
            <p className="text-[11px] opacity-90 leading-tight">Biasanya dibalas beberapa jam</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-background/30">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
              Belum ada pesan. Mulai percakapan!
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.sender_role === "user";
              const isEditing = editingId === m.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`group relative max-w-[85%] rounded-2xl px-3 py-2 ${
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary text-foreground rounded-bl-sm"
                    }`}
                  >
                    {m.image_url && <SupportImage value={m.image_url} />}
                    {isEditing ? (
                      <div className="flex flex-col gap-2 min-w-[180px]">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={2}
                          className="text-sm rounded-md p-2 bg-background/80 text-foreground border border-border resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 px-2 text-xs">
                            Batal
                          </Button>
                          <Button size="sm" onClick={saveEdit} className="h-7 px-2 text-xs">
                            <Check className="w-3 h-3 mr-1" /> Simpan
                          </Button>
                        </div>
                      </div>
                    ) : (
                      m.content && (
                        <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                      )
                    )}
                    {!isEditing && (
                      <div className={`flex items-center gap-1.5 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                        <p
                          className={`text-[10px] ${
                            mine ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          {formatTime(m.created_at)}
                        </p>
                        {m.edited_at && (
                          <span
                            className={`text-[10px] italic ${
                              mine ? "text-primary-foreground/70" : "text-muted-foreground"
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
        <div className="border-t border-border/40 p-2 shrink-0 bg-background/70">
          {imagePreview && (
            <div className="relative inline-block mb-2 ml-1">
              <img
                src={imagePreview}
                alt=""
                className="h-14 w-14 object-cover rounded-lg border border-border"
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
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}