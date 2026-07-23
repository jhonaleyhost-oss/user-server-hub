import { Activity as ActivityIcon, ChevronLeft, ChevronRight } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FeedItem } from "./types";
import { ActivityCard } from "./ActivityCard";

interface Props {
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  paginated: FeedItem[];
  filtered: FeedItem[];
  page: number;
  setPage: (u: (p: number) => number) => void;
  totalPages: number;
  planMap: Record<string, { plan: string | null; permanent: boolean }>;
  pageSize: number;
  emptyText: string;
  searchPlaceholder: string;
}

export const ActivityFeedList = ({
  loading, search, setSearch, paginated, filtered, page, setPage,
  totalPages, planMap, pageSize, emptyText, searchPlaceholder,
}: Props) => (
  <>
    <GlassCard className="!rounded-3xl p-3 mb-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={searchPlaceholder}
        className="rounded-full h-10 bg-secondary/60 border-border/50"
      />
    </GlassCard>

    {loading ? (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassCard key={i} className="!rounded-2xl p-4 animate-pulse h-24"><span /></GlassCard>
        ))}
      </div>
    ) : filtered.length === 0 ? (
      <GlassCard className="!rounded-3xl p-10 text-center">
        <ActivityIcon className="w-12 h-12 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          {search.trim() ? "Tidak ada yang cocok dengan pencarian." : emptyText}
        </p>
      </GlassCard>
    ) : (
      <div className="space-y-2.5">
        {paginated.map((a) => (
          <ActivityCard key={`${a.kind}-${a.id}`} item={a} planMap={planMap} />
        ))}
      </div>
    )}

    {!loading && filtered.length > pageSize && (
      <GlassCard className="!rounded-full p-2 mt-3 flex items-center justify-between gap-2">
        <Button
          type="button" variant="outline" size="icon"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="h-9 w-9 rounded-full shrink-0" aria-label="Sebelumnya"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-xs text-muted-foreground text-center flex-1">
          Halaman <span className="font-semibold text-foreground">{page}</span> / {totalPages}
          <span className="hidden sm:inline"> • {filtered.length} total</span>
        </div>
        <Button
          type="button" variant="outline" size="icon"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="h-9 w-9 rounded-full shrink-0" aria-label="Berikutnya"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </GlassCard>
    )}
  </>
);

export default ActivityFeedList;