import { useEffect, useState, useCallback } from 'react';
import { usePteroProxy } from '@/hooks/usePteroProxy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Variable {
  name: string;
  description: string;
  env_variable: string;
  default_value: string;
  server_value: string;
  is_editable: boolean;
  rules: string;
}

export default function Startup({ panelId }: { panelId: string }) {
  const { call } = usePteroProxy(panelId);
  const { toast } = useToast();
  const [vars, setVars] = useState<Variable[]>([]);
  const [startupCmd, setStartupCmd] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await call<any>('startup');
    setLoading(false);
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal load startup', description: String(r.data || r.error) }); return; }
    const arr = (r.data?.data || []).map((d: any) => d.attributes as Variable);
    setVars(arr);
    setStartupCmd(r.data?.meta?.startup_command || '');
  }, [call, toast]);

  useEffect(() => { load(); }, [load]);

  const updateVar = async (v: Variable, value: string) => {
    setSavingKey(v.env_variable);
    const r = await call('startup/variable', {
      method: 'PUT', body: { key: v.env_variable, value },
    });
    setSavingKey(null);
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal simpan', description: String(r.data || r.error) }); return; }
    toast({ title: 'Tersimpan' });
    setVars((cur) => cur.map((x) => x.env_variable === v.env_variable ? { ...x, server_value: value } : x));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <div className="text-xs text-muted-foreground">Variabel startup dapat di-edit untuk yang diizinkan</div>
      </div>
      {startupCmd && (
        <div className="glass-card rounded-xl p-3 border border-border/40">
          <div className="text-xs text-muted-foreground mb-1">Startup Command</div>
          <div className="font-mono text-xs break-all">{startupCmd}</div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {vars.map((v) => (
          <VarRow key={v.env_variable} v={v} saving={savingKey === v.env_variable} onSave={(val) => updateVar(v, val)} />
        ))}
        {vars.length === 0 && !loading && (
          <div className="text-sm text-muted-foreground">Tidak ada variabel.</div>
        )}
      </div>
    </div>
  );
}

function VarRow({ v, onSave, saving }: { v: Variable; saving: boolean; onSave: (val: string) => void }) {
  const [val, setVal] = useState(v.server_value || '');
  useEffect(() => { setVal(v.server_value || ''); }, [v.server_value]);
  return (
    <div className="glass-card rounded-xl p-3 border border-border/40 space-y-2">
      <div>
        <div className="text-sm font-semibold">{v.name}</div>
        <div className="text-[11px] text-muted-foreground">{v.description}</div>
        <div className="text-[10px] font-mono text-muted-foreground/70">{v.env_variable}</div>
      </div>
      <div className="flex gap-2">
        <Input value={val} disabled={!v.is_editable} onChange={(e) => setVal(e.target.value)} className="font-mono text-xs" />
        <Button size="sm" disabled={!v.is_editable || saving || val === v.server_value} onClick={() => onSave(val)}>
          <Save className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}