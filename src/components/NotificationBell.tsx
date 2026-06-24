import { useState } from "react";
import { Bell, ExternalLink, CheckCheck, Megaphone } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { RichText } from "@/components/RichText";

export default function NotificationBell() {
  const { items, unread, markAllRead, markOneRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-lg ring-2 ring-background animate-pulse">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] max-w-[calc(100vw-1rem)] p-0 bg-popover border-border shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm">Notifikasi</h3>
            {unread > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive text-[10px] font-bold">
                {unread} baru
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <CheckCheck className="w-3 h-3" /> Tandai semua
            </button>
          )}
        </div>
        <ScrollArea className="h-[60vh]">
          {items.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Belum ada notifikasi</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.is_read) markOneRead(n.id);
                    if (n.link_url) {
                      if (n.link_url.startsWith("http")) window.open(n.link_url, "_blank");
                      else navigate(n.link_url);
                      setOpen(false);
                    }
                  }}
                  className={`w-full text-left p-3 hover:bg-accent/40 transition-colors block ${
                    !n.is_read ? "bg-primary/[0.04]" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    {!n.is_read && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                    )}
                    <div className="flex-1 min-w-0">
                      {n.banner_url && (
                        <img
                          src={n.banner_url}
                          alt=""
                          className="w-full h-24 object-cover rounded-md mb-2 border border-border"
                        />
                      )}
                      <p className={`text-sm font-semibold leading-tight mb-1 ${n.is_read ? "text-foreground/80" : "text-foreground"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground leading-snug line-clamp-3 mb-1.5 whitespace-pre-wrap">
                        <RichText text={n.body} />
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: idLocale })}</span>
                        {n.link_url && (
                          <span className="flex items-center gap-0.5 text-primary font-medium">
                            Buka <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}