import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Plus, Trash2, Loader2, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import GlassCard from '@/components/GlassCard';

interface PopupButton {
  label: string;
  url: string;
}

interface PopupData {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  is_active: boolean;
  buttons: PopupButton[];
}

const AdminPopupManager = () => {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchPopup = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('popup_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (data) {
      const buttons = Array.isArray(data.buttons)
        ? (data.buttons as unknown as PopupButton[])
        : [];
      setPopup({ ...data, buttons });
    }
    setLoading(false);
  };

  useEffect(() => { fetchPopup(); }, []);

  const handleSave = async () => {
    if (!popup) return;
    setSaving(true);

    const payload = {
      title: popup.title,
      content: popup.content,
      image_url: popup.image_url || null,
      is_active: popup.is_active,
      buttons: popup.buttons as unknown as Record<string, unknown>[],
    };

    let error;
    if (popup.id) {
      ({ error } = await supabase.from('popup_settings').update(payload).eq('id', popup.id));
    } else {
      ({ error } = await supabase.from('popup_settings').insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: error.message });
    } else {
      toast({ title: 'Berhasil', description: 'Popup berhasil disimpan.' });
      fetchPopup();
    }
  };

  const addButton = () => {
    if (!popup) return;
    setPopup({ ...popup, buttons: [...popup.buttons, { label: '', url: '' }] });
  };

  const removeButton = (index: number) => {
    if (!popup) return;
    setPopup({ ...popup, buttons: popup.buttons.filter((_, i) => i !== index) });
  };

  const updateButton = (index: number, field: 'label' | 'url', value: string) => {
    if (!popup) return;
    const updated = [...popup.buttons];
    updated[index] = { ...updated[index], [field]: value };
    setPopup({ ...popup, buttons: updated });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!popup) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">Belum ada popup. Buat sekarang?</p>
        <Button onClick={() => setPopup({ id: '', title: 'Promo', content: '', image_url: null, is_active: true, buttons: [] })}>
          <Plus className="w-4 h-4 mr-2" /> Buat Popup
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toggle Active */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30">
        <div className="flex items-center gap-2">
          {popup.is_active ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-medium text-foreground">
            Popup {popup.is_active ? 'Aktif' : 'Nonaktif'}
          </span>
        </div>
        <Switch checked={popup.is_active} onCheckedChange={(v) => setPopup({ ...popup, is_active: v })} />
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Judul Popup</Label>
        <Input
          value={popup.title}
          onChange={(e) => setPopup({ ...popup, title: e.target.value })}
          className="input-glass"
          placeholder="Judul popup..."
        />
      </div>

      {/* Image URL */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Image className="w-3.5 h-3.5" /> URL Gambar (opsional)
        </Label>
        <Input
          value={popup.image_url || ''}
          onChange={(e) => setPopup({ ...popup, image_url: e.target.value || null })}
          className="input-glass"
          placeholder="https://example.com/image.jpg"
        />
        {popup.image_url && (
          <img src={popup.image_url} alt="Preview" className="w-full max-h-32 object-cover rounded-lg mt-2" />
        )}
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">
          Konten (gunakan **teks** untuk bold)
        </Label>
        <Textarea
          value={popup.content}
          onChange={(e) => setPopup({ ...popup, content: e.target.value })}
          className="input-glass min-h-[200px] font-mono text-xs"
          placeholder="Tulis konten popup di sini..."
        />
      </div>

      {/* Buttons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Tombol Link</Label>
          <Button variant="outline" size="sm" onClick={addButton} className="gap-1 text-xs">
            <Plus className="w-3 h-3" /> Tambah
          </Button>
        </div>
        {popup.buttons.map((btn, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1 space-y-1">
              <Input
                value={btn.label}
                onChange={(e) => updateButton(i, 'label', e.target.value)}
                className="input-glass text-xs"
                placeholder="Label tombol"
              />
              <Input
                value={btn.url}
                onChange={(e) => updateButton(i, 'url', e.target.value)}
                className="input-glass text-xs"
                placeholder="https://..."
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => removeButton(i)} className="text-destructive mt-1">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="w-full btn-primary gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Simpan Popup
      </Button>
    </div>
  );
};

export default AdminPopupManager;
