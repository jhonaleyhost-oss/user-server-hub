import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProxyResponse<T = any> {
  success: boolean;
  status: number;
  data: T;
  error?: string;
}

export function usePteroProxy(panelId: string | null | undefined) {
  const call = useCallback(async <T = any>(
    path: string,
    opts: { method?: string; body?: any; query?: Record<string, string> } = {},
  ): Promise<ProxyResponse<T>> => {
    if (!panelId) return { success: false, status: 0, data: null as any, error: 'no panelId' };
    const { data, error } = await supabase.functions.invoke('ptero-proxy', {
      body: { panelId, path, method: opts.method || 'GET', body: opts.body, query: opts.query },
    });
    if (error) return { success: false, status: 0, data: null as any, error: error.message };
    return data as ProxyResponse<T>;
  }, [panelId]);

  return { call };
}