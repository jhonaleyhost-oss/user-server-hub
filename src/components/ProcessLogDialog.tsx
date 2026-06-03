import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Terminal, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  logs: string[];
  success?: boolean;
}

const ProcessLogDialog = ({
  open,
  onOpenChange,
  title = 'Log Proses',
  description,
  logs,
  success,
}: Props) => {
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever logs update (live streaming)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logs.join('\n'));
      toast({ title: 'Disalin', description: 'Log proses disalin ke clipboard.' });
    } catch {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Tidak bisa menyalin log.' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" />
            {title}
            {success !== undefined && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  success
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {success ? 'BERHASIL' : 'GAGAL'}
              </span>
            )}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div
          ref={scrollRef}
          className="bg-black/80 border border-border rounded-lg p-3 max-h-[50vh] min-h-[200px] overflow-y-auto font-mono text-xs text-green-300 space-y-0.5"
        >
          {logs.length === 0 ? (
            <div className="text-muted-foreground">Tidak ada log.</div>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={copyLogs}>
            <Copy className="w-3 h-3 mr-1" /> Salin
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProcessLogDialog;