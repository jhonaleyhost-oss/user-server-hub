import { useEffect, useState, useCallback, useRef } from 'react';
import { usePteroProxy } from '@/hooks/usePteroProxy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Folder, File as FileIcon, ChevronRight, RefreshCw, Upload, FilePlus, FolderPlus,
  ArrowLeft, Download, Trash2, Save, X, Pencil,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FileEntry {
  name: string;
  mode: string;
  size: number;
  is_file: boolean;
  is_symlink: boolean;
  mimetype: string;
  modified_at: string;
}

function fmtBytes(b: number) {
  if (!b) return '-';
  const u = ['B','KB','MB','GB']; let i = 0; let n = b;
  while (n >= 1024 && i < u.length-1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

function langFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    json: 'json', yml: 'yaml', yaml: 'yaml',
    py: 'python', html: 'html', css: 'css', md: 'markdown',
    sh: 'shell', bash: 'shell', env: 'shell', toml: 'ini', ini: 'ini',
    sql: 'sql', xml: 'xml',
  };
  return map[ext] || 'plaintext';
}

export default function Files({ panelId }: { panelId: string }) {
  const { call } = usePteroProxy(panelId);
  const { toast } = useToast();
  const [path, setPath] = useState('/');
  const [items, setItems] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{ name: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await call<{ data: { attributes: FileEntry }[] }>('files/list', { query: { directory: path } });
    setLoading(false);
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal load files', description: r.data?.errors?.[0]?.detail || r.error }); return; }
    const arr = (r.data?.data || []).map((d: any) => d.attributes as FileEntry);
    arr.sort((a, b) => (a.is_file === b.is_file ? a.name.localeCompare(b.name) : a.is_file ? 1 : -1));
    setItems(arr);
  }, [call, path, toast]);

  useEffect(() => { load(); }, [load]);

  const goInto = (name: string) => {
    const next = (path.endsWith('/') ? path : path + '/') + name;
    setPath(next);
  };
  const goUp = () => {
    if (path === '/' || path === '') return;
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    setPath('/' + parts.join('/'));
  };

  const openFile = async (name: string) => {
    const fullPath = (path.endsWith('/') ? path : path + '/') + name;
    const r = await call('files/contents', { query: { file: fullPath } });
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal buka file', description: String(r.data || r.error) }); return; }
    const content = typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2);
    setEditing({ name: fullPath, content });
  };

  const saveFile = async () => {
    if (!editing) return;
    setSaving(true);
    const r = await call('files/write', {
      method: 'POST',
      query: { file: editing.name },
      body: editing.content,
    });
    setSaving(false);
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal simpan', description: String(r.data || r.error) }); return; }
    toast({ title: 'Tersimpan' });
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    const r = await call('files/delete', { method: 'POST', body: { root: path, files: [deleteTarget] } });
    setDeleteTarget(null);
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal hapus', description: String(r.data || r.error) }); return; }
    toast({ title: 'Terhapus' });
    load();
  };

  const doRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    const r = await call('files/rename', {
      method: 'PUT',
      body: { root: path, files: [{ from: renameTarget, to: renameValue.trim() }] },
    });
    setRenameTarget(null); setRenameValue('');
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal rename', description: String(r.data || r.error) }); return; }
    load();
  };

  const newFolder = async () => {
    const name = prompt('Nama folder baru:');
    if (!name) return;
    const r = await call('files/create-folder', { method: 'POST', body: { root: path, name } });
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal', description: String(r.data || r.error) }); return; }
    load();
  };

  const newFile = async () => {
    const name = prompt('Nama file baru:');
    if (!name) return;
    const fullPath = (path.endsWith('/') ? path : path + '/') + name;
    const r = await call('files/write', { method: 'POST', query: { file: fullPath }, body: '' });
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal', description: String(r.data || r.error) }); return; }
    load();
  };

  const uploadFiles = async (files: FileList) => {
    // Get upload signed url
    const r = await call<{ attributes: { url: string } }>('files/upload');
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal upload', description: String(r.data || r.error) }); return; }
    const uploadUrl = (r.data as any)?.attributes?.url;
    if (!uploadUrl) { toast({ variant: 'destructive', title: 'Upload URL kosong' }); return; }
    const fullUrl = `${uploadUrl}&directory=${encodeURIComponent(path)}`;
    const form = new FormData();
    for (const f of Array.from(files)) form.append('files', f, f.name);
    const resp = await fetch(fullUrl, { method: 'POST', body: form });
    if (!resp.ok) { toast({ variant: 'destructive', title: 'Upload gagal', description: `${resp.status}` }); return; }
    toast({ title: 'Upload selesai' });
    load();
  };

  const downloadFile = async (name: string) => {
    const fullPath = (path.endsWith('/') ? path : path + '/') + name;
    const r = await call<{ attributes: { url: string } }>('files/download', { query: { file: fullPath } });
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal', description: String(r.data || r.error) }); return; }
    const url = (r.data as any)?.attributes?.url;
    if (url) window.open(url, '_blank');
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setEditing(null)}><X className="w-4 h-4 mr-1" /> Tutup</Button>
          <Button size="sm" onClick={saveFile} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
          <div className="font-mono text-xs text-muted-foreground truncate">{editing.name}</div>
        </div>
        <div className="rounded-xl overflow-hidden border border-border/40" style={{ height: '500px' }}>
          <Editor
            theme="vs-dark"
            language={langFromName(editing.name)}
            value={editing.content}
            onChange={(v) => setEditing((cur) => cur ? { ...cur, content: v || '' } : cur)}
            options={{ fontSize: 12, minimap: { enabled: false }, wordWrap: 'on' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={goUp} disabled={path === '/'}><ArrowLeft className="w-4 h-4" /></Button>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
        <Button size="sm" variant="outline" onClick={newFile}><FilePlus className="w-4 h-4 mr-1" /> File</Button>
        <Button size="sm" variant="outline" onClick={newFolder}><FolderPlus className="w-4 h-4 mr-1" /> Folder</Button>
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4 mr-1" /> Upload</Button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
        <div className="ml-auto text-xs font-mono text-muted-foreground truncate max-w-[60%]">{path}</div>
      </div>

      <div className="rounded-xl border border-border/40 divide-y divide-border/30 bg-background/30">
        {items.length === 0 && !loading && (
          <div className="p-6 text-center text-sm text-muted-foreground">Folder kosong</div>
        )}
        {items.map((it) => (
          <div key={it.name} className="flex items-center gap-3 p-2.5 hover:bg-secondary/40 transition-colors">
            {it.is_file ? <FileIcon className="w-4 h-4 text-muted-foreground" /> : <Folder className="w-4 h-4 text-primary" />}
            <button
              className="flex-1 text-left text-sm truncate"
              onClick={() => it.is_file ? openFile(it.name) : goInto(it.name)}
            >
              {it.name}
            </button>
            <span className="text-[10px] text-muted-foreground w-16 text-right">{it.is_file ? fmtBytes(it.size) : ''}</span>
            <button onClick={() => { setRenameTarget(it.name); setRenameValue(it.name); }} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
            {it.is_file && <button onClick={() => downloadFile(it.name)} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"><Download className="w-3.5 h-3.5" /></button>}
            <button onClick={() => setDeleteTarget(it.name)} className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus "{deleteTarget}"?</AlertDialogTitle>
            <AlertDialogDescription>Aksi tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Rename "{renameTarget}"</AlertDialogTitle>
          </AlertDialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doRename}>Simpan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}