import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import SupportChatPopup from "@/components/SupportChatPopup";

const HIDDEN_PREFIXES = ["/support", "/auth", "/chat"];

export default function SupportChatButton() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const unread = useUnreadCounts();
  const [open, setOpen] = useState(false);

  if (!user) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const badge = unread.support ?? 0;

  const handleClick = () => {
    if (isAdmin) {
      navigate("/support");
      return;
    }
    setOpen((v) => !v);
  };

  return (
    <>
      {!isAdmin && <SupportChatPopup open={open} onClose={() => setOpen(false)} />}
      <button
        onClick={handleClick}
        aria-label="Live Chat Support"
        className="fixed bottom-5 right-5 z-40 group flex items-center gap-2 pl-4 pr-4 h-14 rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-2xl shadow-primary/40 hover:scale-105 active:scale-95 transition-transform"
      >
        <span className="relative flex items-center justify-center">
          {open && !isAdmin ? (
            <X className="h-6 w-6" strokeWidth={2.4} />
          ) : (
            <MessageCircle className="h-6 w-6" strokeWidth={2.4} />
          )}
          {badge > 0 && !open && (
            <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </span>
        {!open && <span className="hidden sm:inline text-sm font-semibold pr-1">Live Chat</span>}
        {!open && (
          <span className="absolute inset-0 rounded-full ring-2 ring-primary/40 animate-ping pointer-events-none opacity-60" />
        )}
      </button>
    </>
  );
}