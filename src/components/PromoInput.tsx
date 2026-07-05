import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface AppliedPromo {
  promo_id: string;
  code: string;
  description: string;
  discount: number;
  final_amount: number;
}

interface Props {
  scope: "reseller" | "ads" | "adp";
  amount: number;
  applied: AppliedPromo | null;
  onApply: (p: AppliedPromo | null) => void;
}

export default function PromoInput({ scope, amount, applied, onApply }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const apply = async () => {
    if (!code.trim()) return;
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)("validate_promo_code", {
      _code: code.trim().toUpperCase(),
      _scope: scope,
      _amount: amount,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data?.valid) {
      onApply(null);
      return toast.error(data?.error || "Kode tidak valid");
    }
    onApply({
      promo_id: data.promo_id,
      code: data.code,
      description: data.description,
      discount: data.discount,
      final_amount: data.final_amount,
    });
    toast.success(`Promo "${data.code}" diterapkan! Diskon Rp ${data.discount.toLocaleString("id-ID")}`);
    setCode("");
  };

  if (applied) {
    return (
      <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-emerald-400 font-mono">{applied.code}</p>
              <p className="text-xs text-muted-foreground truncate">Hemat Rp {applied.discount.toLocaleString("id-ID")}</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onApply(null)} className="h-7 gap-1 text-destructive">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
        <Tag className="w-3 h-3" /> Punya kode promo?
      </label>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="MASUKKAN KODE"
          className="font-mono uppercase"
          onKeyDown={(e) => e.key === "Enter" && apply()}
        />
        <Button onClick={apply} disabled={loading || !code.trim()} className="btn-primary shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pakai"}
        </Button>
      </div>
    </div>
  );
}