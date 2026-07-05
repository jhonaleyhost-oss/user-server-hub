import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Mail, CheckCircle2, XCircle } from 'lucide-react';

type State = 'loading' | 'valid' | 'invalid' | 'already' | 'success' | 'error';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>('loading');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) setState('valid');
        else if (data.reason === 'already_unsubscribed') setState('already');
        else setState('invalid');
      })
      .catch(() => setState('error'));
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) setState('success');
      else if (data?.reason === 'already_unsubscribed') setState('already');
      else setState('error');
    } catch {
      setState('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md p-8 glass-card text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-7 h-7 text-primary" />
          </div>
        </div>

        {state === 'loading' && (
          <>
            <h1 className="text-xl font-semibold">Memeriksa link...</h1>
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" />
          </>
        )}

        {state === 'valid' && (
          <>
            <h1 className="text-xl font-semibold">Berhenti berlangganan</h1>
            <p className="text-sm text-muted-foreground">
              Kamu akan berhenti menerima email dari Jhonaley Store. Lanjutkan?
            </p>
            <Button className="w-full" onClick={confirm} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Konfirmasi Unsubscribe'}
            </Button>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 mx-auto text-green-500" />
            <h1 className="text-xl font-semibold">Berhasil unsubscribe</h1>
            <p className="text-sm text-muted-foreground">
              Kamu tidak akan menerima email pemberitahuan lagi.
            </p>
          </>
        )}

        {state === 'already' && (
          <>
            <CheckCircle2 className="w-10 h-10 mx-auto text-muted-foreground" />
            <h1 className="text-xl font-semibold">Sudah unsubscribe</h1>
            <p className="text-sm text-muted-foreground">Email ini sudah tidak berlangganan.</p>
          </>
        )}

        {(state === 'invalid' || state === 'error') && (
          <>
            <XCircle className="w-10 h-10 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold">Link tidak valid</h1>
            <p className="text-sm text-muted-foreground">
              Link unsubscribe kedaluwarsa atau tidak dikenali.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}