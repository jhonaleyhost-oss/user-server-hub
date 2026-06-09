import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export interface AdButton { label: string; url: string }
export interface AdRentalRow {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  buttons: AdButton[];
}

interface Props { rental: AdRentalRow; onSaved?: (r: AdRentalRow) => void }

const AdEditor = ({ rental, onSaved }: Props) => {
  const [data, setData] = useState<AdRentalRow>(rental);
  const [saving, setSaving] = useState(false);

  useEffect(() => setData(rental), [rental.id]);

  const update = (patch: Partial<AdRentalRow>) => setData((d) => ({ ...d, ...patch }));

  const addBtn = () => update({ buttons: [...data.buttons, { label: '', url: '' }] });
  const rmBtn = (i: number) => update({ buttons: data.buttons.filter((_, j) => j !== i) });
  const setBtn = (i: number, f: 'label' | 'url', v: string) => {
    const list = [...data.buttons];
    list[i] = { ...list[i], [f]: v };
    update({ buttons: list });
  };

  const save = async () => {
    if (!data.title.trim()) return toast.error('Judul wajib diisi');
    if (!data.content.trim()) return toast.error('Konten iklan wajib diisi');
    if (data.content.length > 2000) return toast.error('Konten maks 2000 karakter');
    for (const b of data.buttons) {
      if (b.label && !b.url) return toast.error(`URL tombol "${b.label}" kosong`);
      if (b.url && !/^https?:\/\//i.test(b.url)) return toast.error(`URL harus diawali http(s)://`);
    }
    setSaving(true);
    const { error } = await supabase
      .from('ad_rentals')
      .update({
        title: data.title.trim(),
        content: data.content,
        image_url: data.image_url || null,
        buttons: JSON.parse(JSON.stringify(data.buttons)) as any,
      })
      .eq('id', data.id);
    setSaving(false);
    if (error) return toast.error('Gagal simpan: ' + error.message);
    toast.success('Iklan tersimpan');
    onSaved?.(data);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Judul Iklan</Label>
        <Input value={data.title} onChange={(e) => update({ title: e.target.value })} className="input-glass" placeholder="Judul iklan kamu" maxLength={120} />
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5" /> URL Gambar (opsional)
        </Label>
        <Input value={data.image_url || ''} onChange={(e) => update({ image_url: e.target.value || null })} className="input-glass" placeholder="https://example.com/banner.jpg" />
        {data.image_url && (
          <img src={data.image_url} alt="Preview" className="w-full max-h-40 object-cover rounded-lg mt-2 border border-border/40" />
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">
          Konten Iklan (gunakan <span className="font-mono">**teks**</span> untuk bold)
        </Label>
        <Textarea
          value={data.content}
          onChange={(e) => update({ content: e.target.value })}
          className="input-glass min-h-[180px] font-mono text-xs"
          placeholder="Deskripsi iklan, promo, link kontak..."
          maxLength={2000}
        />
        <p className="text-[11px] text-muted-foreground text-right">{data.content.length}/2000</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Tombol Link (opsional)</Label>
          <Button variant="outline" size="sm" onClick={addBtn} className="gap-1 text-xs">
            <Plus className="w-3 h-3" /> Tambah
          </Button>
        </div>
        {data.buttons.map((b, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1 space-y-1">
              <Input value={b.label} onChange={(e) => setBtn(i, 'label', e.target.value)} className="input-glass text-xs" placeholder="Label tombol" maxLength={40} />
              <Input value={b.url} onChange={(e) => setBtn(i, 'url', e.target.value)} className="input-glass text-xs" placeholder="https://..." />
            </div>
            <Button variant="ghost" size="sm" onClick={() => rmBtn(i)} className="text-destructive mt-1">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Button onClick={save} disabled={saving} className="w-full btn-primary gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Simpan Iklan
      </Button>
    </div>
  );
};

export default AdEditor;